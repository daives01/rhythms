import { useEffect, useRef, useCallback } from "react"
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Tuplet, RenderContext, Dot } from "vexflow"
import type { RuntimeBar, RuntimeOnset, TupletInfo } from "@/types"

export interface PositionData {
  bar: number
  beat: number
  beatFraction: number
  currentTime: number
}

interface NotationRendererProps {
  bars: RuntimeBar[]
  getPosition: () => PositionData | null
}

function barToGrid(bar: RuntimeBar): {
  grid: boolean[]
  slotToOnset: Map<number, typeof bar.onsets[0]>
} {
  const grid = new Array(16).fill(false)
  const slotToOnset = new Map<number, typeof bar.onsets[0]>()

  for (const onset of bar.onsets) {
    if (onset.d === 4) {
      const slot = onset.beatIndex * 4 + onset.n
      grid[slot] = true
      slotToOnset.set(slot, onset)
    }
  }
  return { grid, slotToOnset }
}

function hasTuplets(bar: RuntimeBar): boolean {
  return bar.onsets.some((o) => o.d !== 4)
}

interface TupletGroup {
  beatIndex: number
  tuplet: TupletInfo
  onsets: RuntimeOnset[]
}

function groupTupletsByBeat(bar: RuntimeBar): TupletGroup[] {
  const groups: TupletGroup[] = []
  const tupletOnsets = bar.onsets.filter((o) => o.tuplet)
  
  for (const onset of tupletOnsets) {
    const existing = groups.find(
      (g) => g.beatIndex === onset.beatIndex && 
             g.tuplet.numNotes === onset.tuplet!.numNotes
    )
    if (existing) {
      existing.onsets.push(onset)
    } else {
      groups.push({
        beatIndex: onset.beatIndex,
        tuplet: onset.tuplet!,
        onsets: [onset],
      })
    }
  }
  
  return groups
}

function processBeat(
  grid: boolean[],
  beatStart: number,
  slotToOnset: Map<number, RuntimeOnset>
): { note: StaveNote; onset: RuntimeOnset | null }[] {
  const result: { note: StaveNote; onset: RuntimeOnset | null }[] = []
  const slots = grid.slice(beatStart, beatStart + 4)

  let i = 0
  while (i < 4) {
    if (slots[i]) {
      let restCount = 0
      while (i + 1 + restCount < 4 && !slots[i + 1 + restCount]) {
        restCount++
      }

      const hasNoteAfterRests = i + 1 + restCount < 4

      let note: StaveNote
      const onsetSlot = beatStart + i
      const onset = slotToOnset.get(onsetSlot) || null

      if (i === 0 && restCount === 3) {
        note = new StaveNote({ keys: ["c/5"], duration: "q", stemDirection: 1 })
        i += 4
      } else if (i === 0 && restCount === 2 && hasNoteAfterRests) {
        note = new StaveNote({ keys: ["c/5"], duration: "8d", stemDirection: 1 })
        Dot.buildAndAttach([note], { all: true })
        i += 3
      } else if (hasNoteAfterRests && restCount >= 1) {
        note = new StaveNote({ keys: ["c/5"], duration: "8", stemDirection: 1 })
        i += 2
      } else if (i % 2 === 0 && restCount >= 1) {
        note = new StaveNote({ keys: ["c/5"], duration: "8", stemDirection: 1 })
        i += 2
      } else {
        note = new StaveNote({ keys: ["c/5"], duration: "16", stemDirection: 1 })
        i += 1
      }

      result.push({ note, onset })
    } else {
      let restCount = 1
      while (i + restCount < 4 && !slots[i + restCount]) {
        restCount++
      }

      let note: StaveNote

      if (i === 0 && restCount === 4) {
        note = new StaveNote({ keys: ["b/4"], duration: "qr" })
        i += 4
      } else if (i === 0 && restCount === 3) {
        note = new StaveNote({ keys: ["b/4"], duration: "8dr" })
        Dot.buildAndAttach([note], { all: true })
        i += 3
      } else if (i === 1 && restCount === 3) {
        note = new StaveNote({ keys: ["b/4"], duration: "8dr" })
        Dot.buildAndAttach([note], { all: true })
        i += 3
      } else if (i % 2 === 0 && restCount >= 2) {
        note = new StaveNote({ keys: ["b/4"], duration: "8r" })
        i += 2
      } else {
        note = new StaveNote({ keys: ["b/4"], duration: "16r" })
        i += 1
      }

      result.push({ note, onset: null })
    }
  }

  return result
}

function combineConsecutiveRests(notes: StaveNote[]): StaveNote[] {
  const result: StaveNote[] = []
  let i = 0

  while (i < notes.length) {
    const note = notes[i]
    
    if (!note.isRest()) {
      result.push(note)
      i++
      continue
    }

    let j = i + 1
    let totalDuration = getDurationInSixteenths(note.getDuration())

    while (j < notes.length && notes[j].isRest()) {
      totalDuration += getDurationInSixteenths(notes[j].getDuration())
      j++
    }

    if (j > i + 1) {
      const combined = createCombinedRest(totalDuration)
      if (combined) {
        result.push(combined)
      } else {
        for (let k = i; k < j; k++) {
          result.push(notes[k])
        }
      }
    } else {
      result.push(note)
    }
    
    i = j
  }

  return result
}

function getDurationInSixteenths(duration: string): number {
  switch (duration) {
    case "qr": return 4
    case "8r": return 2
    case "8dr": return 3
    case "16r": return 1
    default: return 0
  }
}

function createCombinedRest(sixteenths: number): StaveNote | null {
  switch (sixteenths) {
    case 1:
      return new StaveNote({ keys: ["b/4"], duration: "16r" })
    case 2:
      return new StaveNote({ keys: ["b/4"], duration: "8r" })
    case 3: {
      const rest = new StaveNote({ keys: ["b/4"], duration: "8dr" })
      Dot.buildAndAttach([rest], { all: true })
      return rest
    }
    case 4:
      return new StaveNote({ keys: ["b/4"], duration: "qr" })
    default:
      return null
  }
}

function gridToVexNotes(
  grid: boolean[],
  slotToOnset: Map<number, RuntimeOnset>
): {
  notes: StaveNote[]
  beamGroups: StaveNote[][]
  noteToOnset: Map<StaveNote, RuntimeOnset>
} {
  const allNotes: StaveNote[] = []
  const beamGroups: StaveNote[][] = []
  const noteToOnset = new Map<StaveNote, RuntimeOnset>()

  for (let beat = 0; beat < 4; beat++) {
    const beatNotes = processBeat(grid, beat * 4, slotToOnset)

    for (const { note, onset } of beatNotes) {
      allNotes.push(note)
      if (onset) {
        noteToOnset.set(note, onset)
      }
    }

    const beamable = beatNotes
      .filter(({ note: n }) => {
        if (n.isRest()) return false
        const dur = n.getDuration()
        return dur === "16" || dur === "8"
      })
      .map(({ note }) => note)
    beamGroups.push(beamable)
  }

  const combinedNotes = combineConsecutiveRests(allNotes)

  return { notes: combinedNotes, beamGroups, noteToOnset }
}

const FIXED_BAR_WIDTH = 300
const FIXED_FIRST_BAR_WIDTH = 360

interface BarRenderResult {
  noteToOnset: Map<StaveNote, RuntimeOnset>
  beamsWithNotes: { beam: Beam; notes: StaveNote[] }[]
}

function createTupletNotes(
  group: TupletGroup,
  noteToOnset: Map<StaveNote, RuntimeOnset>
): { notes: StaveNote[]; tuplet: Tuplet } {
  const notes: StaveNote[] = []
  const { numNotes, notesOccupied } = group.tuplet
  
  const subdivisionD = group.onsets[0]?.d ?? numNotes
  const duration = subdivisionD === 3 ? "8" : "16"

  const onsetByIndex = new Map<number, RuntimeOnset>()
  for (const onset of group.onsets) {
    onsetByIndex.set(onset.n, onset)
  }

  for (let i = 0; i < numNotes; i++) {
    const onset = onsetByIndex.get(i)
    if (onset) {
      const note = new StaveNote({ keys: ["c/5"], duration, stemDirection: 1 })
      notes.push(note)
      noteToOnset.set(note, onset)
    } else {
      const rest = new StaveNote({ keys: ["b/4"], duration: `${duration}r` })
      notes.push(rest)
    }
  }
  
  const tuplet = new Tuplet(notes, {
    numNotes: numNotes,
    notesOccupied: notesOccupied,
    bracketed: true,
  })
  
  return { notes, tuplet }
}

function createBeamsSkippingRests(
  notes: StaveNote[]
): { beam: Beam; notes: StaveNote[] }[] {
  const results: { beam: Beam; notes: StaveNote[] }[] = []
  let run: StaveNote[] = []

  const flush = () => {
    if (run.length >= 2) {
      results.push({ beam: new Beam(run), notes: run })
    }
    run = []
  }

  for (const n of notes) {
    if (n.isRest()) {
      flush()
      continue
    }
    const dur = n.getDuration()
    if (dur !== "8" && dur !== "16") {
      flush()
      continue
    }
    run.push(n)
  }

  flush()
  return results
}

function renderBar(
  ctx: RenderContext,
  bar: RuntimeBar,
  x: number,
  y: number,
  width: number,
  isFirst: boolean
): BarRenderResult {
  const stave = new Stave(x, y, width)

  if (isFirst) {
    stave.addClef("percussion")
    stave.addTimeSignature("4/4")
  }

  stave.setContext(ctx).draw()

  const noteToOnset = new Map<StaveNote, RuntimeOnset>()
  const beamsWithNotes: { beam: Beam; notes: StaveNote[] }[] = []
  const tupletObjects: Tuplet[] = []
  
  if (hasTuplets(bar)) {
    const allNotes: StaveNote[] = []
    const tupletGroups = groupTupletsByBeat(bar)
    
    for (let beat = 0; beat < 4; beat++) {
      const tupletGroup = tupletGroups.find((g) => g.beatIndex === beat)
      
      if (tupletGroup) {
        const { notes, tuplet } = createTupletNotes(tupletGroup, noteToOnset)
        allNotes.push(...notes)
        tupletObjects.push(tuplet)
        beamsWithNotes.push(...createBeamsSkippingRests(notes))
      } else {
        const beatOnsets = bar.onsets.filter((o) => o.beatIndex === beat && o.d === 4)
        if (beatOnsets.length === 0) {
          allNotes.push(new StaveNote({ keys: ["b/4"], duration: "qr" }))
        } else {
          const beatGrid = new Array(4).fill(false)
          const beatSlotToOnset = new Map<number, RuntimeOnset>()
          for (const onset of beatOnsets) {
            beatGrid[onset.n] = true
            beatSlotToOnset.set(onset.n, onset)
          }
          const beatNotes = processBeat(beatGrid, 0, beatSlotToOnset)
          const beamable: StaveNote[] = []
          for (const { note, onset } of beatNotes) {
            allNotes.push(note)
            if (onset) {
              noteToOnset.set(note, onset)
            }
            if (!note.isRest()) {
              const dur = note.getDuration()
              if (dur === "8" || dur === "16") {
                beamable.push(note)
              }
            }
          }
          if (beamable.length >= 2) {
            beamsWithNotes.push({ beam: new Beam(beamable), notes: beamable })
          }
        }
      }
    }
    
    if (allNotes.length === 0) return { noteToOnset: new Map(), beamsWithNotes: [] }
    
    const voice = new Voice({ numBeats: 4, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables(allNotes)
    
    const noteAreaWidth = width - (isFirst ? 80 : 20)
    new Formatter().joinVoices([voice]).format([voice], noteAreaWidth, { alignRests: true })
    voice.draw(ctx, stave)
    
    for (const { beam } of beamsWithNotes) {
      beam.setContext(ctx).draw()
    }
    
    for (const tuplet of tupletObjects) {
      tuplet.setContext(ctx).draw()
    }
  } else {
    const { grid, slotToOnset } = barToGrid(bar)
    const { notes, beamGroups, noteToOnset: gridNoteToOnset } = gridToVexNotes(grid, slotToOnset)

    if (notes.length === 0) return { noteToOnset: new Map(), beamsWithNotes: [] }

    gridNoteToOnset.forEach((onset, note) => noteToOnset.set(note, onset))

    const voice = new Voice({ numBeats: 4, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables(notes)

    for (const group of beamGroups) {
      if (group.length >= 2) {
        const beam = new Beam(group)
        beamsWithNotes.push({ beam, notes: group })
      }
    }

    const noteAreaWidth = width - (isFirst ? 80 : 20)
    new Formatter().joinVoices([voice]).format([voice], noteAreaWidth, { alignRests: true })
    voice.draw(ctx, stave)

    for (const { beam } of beamsWithNotes) {
      beam.setContext(ctx).draw()
    }
  }

  return { noteToOnset, beamsWithNotes }
}

interface BarLayout {
  barIndex: number
  localX: number
  width: number
}

export function NotationRenderer({ bars, getPosition }: NotationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const barResultsRef = useRef<BarRenderResult[]>([])
  const layoutRef = useRef<{
    barLayouts: BarLayout[]
    leftPadding: number
    totalWidth: number
    containerWidth: number
  } | null>(null)
  const lastHighlightTimeRef = useRef<number>(-1)

  // Compute bar layout once when bars change
  const computeLayout = useCallback((containerWidth: number) => {
    const leftPadding = containerWidth * 0.15
    const barLayouts: BarLayout[] = []
    let x = leftPadding

    for (const bar of bars) {
      const width = bar.barIndex === 0 ? FIXED_FIRST_BAR_WIDTH : FIXED_BAR_WIDTH
      barLayouts.push({ barIndex: bar.barIndex, localX: x, width })
      x += width
    }

    return { barLayouts, leftPadding, totalWidth: x, containerWidth }
  }, [bars])

  // Calculate scroll position for given position data
  const calculateScrollPosition = useCallback((pos: PositionData, layout: typeof layoutRef.current) => {
    if (!layout || layout.barLayouts.length === 0) return 0

    const { barLayouts, leftPadding, totalWidth, containerWidth } = layout
    const barLayout = barLayouts.find(b => b.barIndex === pos.bar)

    if (barLayout) {
      const beatProgress = (pos.beat + pos.beatFraction) / 4
      const scrollPos = barLayout.localX + barLayout.width * beatProgress - containerWidth * 0.15
      return scrollPos
    }

    // Past last bar
    const lastBar = barLayouts[barLayouts.length - 1]
    if (pos.bar > lastBar.barIndex) {
      return totalWidth - containerWidth * 0.15
    }

    // Before first bar
    return leftPadding - containerWidth * 0.15
  }, [])

  // Apply highlighting based on current time
  const applyHighlighting = useCallback((currentTime: number) => {
    const baseColor = "#e8dcc8"
    const goldColor = "#f59e0b"

    const applyColor = (elem: Element | null, color: string) => {
      if (!elem) return
      elem.querySelectorAll("*").forEach((child) => {
        const svg = child as SVGElement
        if (svg.getAttribute("fill") && svg.getAttribute("fill") !== "none") {
          svg.setAttribute("fill", color)
          svg.style.fill = color
        }
        if (svg.getAttribute("stroke") && svg.getAttribute("stroke") !== "none") {
          svg.setAttribute("stroke", color)
          svg.style.stroke = color
        }
      })
    }

    for (const { noteToOnset, beamsWithNotes } of barResultsRef.current) {
      noteToOnset.forEach((onset, note) => {
        const el = note.getSVGElement()
        if (el) applyColor(el, currentTime >= onset.timeSec ? goldColor : baseColor)
      })

      for (const { beam, notes } of beamsWithNotes) {
        const allHit = notes.every((n) => {
          const onset = noteToOnset.get(n)
          return onset && currentTime >= onset.timeSec
        })
        const el = beam.getSVGElement()
        if (el) applyColor(el, allHit ? goldColor : baseColor)
      }
    }
  }, [])

  // Animation loop - runs independently of React renders
  const runAnimationLoop = useCallback(() => {
    const animate = () => {
      const pos = getPosition()
      
      if (pos && svgRef.current && layoutRef.current) {
        // Update scroll position directly on DOM
        const scrollPos = calculateScrollPosition(pos, layoutRef.current)
        svgRef.current.style.transform = `translateX(${-scrollPos}px)`

        // Update highlighting only when time changes significantly (every ~16ms is fine)
        if (Math.abs(pos.currentTime - lastHighlightTimeRef.current) > 0.01) {
          applyHighlighting(pos.currentTime)
          lastHighlightTimeRef.current = pos.currentTime
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [getPosition, calculateScrollPosition, applyHighlighting])

  // Handle resize
  useEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const containerWidth = Math.max(400, rect.width)
      layoutRef.current = computeLayout(containerWidth)
    }

    updateLayout()
    window.addEventListener("resize", updateLayout)
    return () => window.removeEventListener("resize", updateLayout)
  }, [computeLayout])

  // Render VexFlow notation when bars change
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || bars.length === 0) return

    const rect = containerRef.current.getBoundingClientRect()
    const containerWidth = Math.max(400, rect.width)
    const layout = computeLayout(containerWidth)
    layoutRef.current = layout

    svgRef.current.innerHTML = ""

    const renderer = new Renderer(svgRef.current, Renderer.Backends.SVG)
    renderer.resize(layout.totalWidth, 150)
    const ctx = renderer.getContext()

    const allBarResults: BarRenderResult[] = []

    for (const barLayout of layout.barLayouts) {
      const bar = bars.find(b => b.barIndex === barLayout.barIndex)
      if (!bar) continue

      const isFirst = bar.barIndex === 0
      const result = renderBar(ctx, bar, barLayout.localX, 30, barLayout.width - 2, isFirst)
      allBarResults.push(result)
    }

    barResultsRef.current = allBarResults

    const svg = svgRef.current.querySelector("svg")
    if (svg) {
      svg.style.overflow = "visible"
      const color = "#e8dcc8"

      svg.querySelectorAll("*").forEach((el) => {
        const elem = el as SVGElement
        if (elem.hasAttribute("stroke") && elem.getAttribute("stroke") !== "none") {
          elem.setAttribute("stroke", color)
        }
        if (elem.hasAttribute("fill") && elem.getAttribute("fill") !== "none") {
          elem.setAttribute("fill", color)
        }
        if (elem.style) {
          if (elem.style.stroke && elem.style.stroke !== "none") elem.style.stroke = color
          if (elem.style.fill && elem.style.fill !== "none") elem.style.fill = color
        }
      })

      svg.querySelectorAll("text").forEach((el) => {
        el.setAttribute("fill", color)
        el.style.fill = color
      })

      svg.querySelectorAll("path").forEach((el) => {
        el.setAttribute("fill", color)
        el.setAttribute("stroke", color)
      })

      svg.querySelectorAll("line").forEach((el) => {
        el.setAttribute("stroke", color)
      })

      svg.querySelectorAll("rect").forEach((el) => {
        const fill = el.getAttribute("fill")
        if (fill !== "none") el.setAttribute("fill", color)
      })

      // Fix tuplet bracket spacing
      svg.querySelectorAll(".vf-tuplet").forEach((tupletGroup) => {
        const rects = tupletGroup.querySelectorAll("rect")
        const shiftAmount = 8
        const centerShift = shiftAmount / 2
        if (rects.length >= 3) {
          const leftHoriz = rects[0]
          const x = parseFloat(leftHoriz.getAttribute("x") || "0")
          const width = parseFloat(leftHoriz.getAttribute("width") || "0")
          leftHoriz.setAttribute("x", String(x + shiftAmount))
          leftHoriz.setAttribute("width", String(Math.max(0, width - centerShift)))

          const rightHoriz = rects[1]
          const rightX = parseFloat(rightHoriz.getAttribute("x") || "0")
          const rightWidth = parseFloat(rightHoriz.getAttribute("width") || "0")
          rightHoriz.setAttribute("x", String(rightX + centerShift))
          rightHoriz.setAttribute("width", String(Math.max(0, rightWidth - centerShift)))

          const leftVert = rects[2]
          const vertX = parseFloat(leftVert.getAttribute("x") || "0")
          leftVert.setAttribute("x", String(vertX + shiftAmount))
        }

        const text = tupletGroup.querySelector("text")
        if (text) {
          const textX = parseFloat(text.getAttribute("x") || "0")
          text.setAttribute("x", String(textX + centerShift))
        }
      })
    }

    // Reset highlight state when bars change
    lastHighlightTimeRef.current = -1

  }, [bars, computeLayout])

  // Start/stop animation loop
  useEffect(() => {
    runAnimationLoop()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [runAnimationLoop])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: 150 }}
    >
      <div
        ref={svgRef}
        className="absolute top-0 left-0"
        style={{
          willChange: "transform",
          transform: "translateX(0px)",
        }}
      />

      {/* Fade edges */}
      <div
        className="absolute inset-y-0 left-0 w-6 pointer-events-none"
        style={{
          background: "linear-gradient(to right, var(--color-card), transparent)",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-10 pointer-events-none"
        style={{
          background: "linear-gradient(to left, var(--color-card), transparent)",
        }}
      />
    </div>
  )
}
