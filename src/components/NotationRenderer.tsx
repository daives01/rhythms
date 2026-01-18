import { useEffect, useRef, useState } from "react"
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Tuplet, RenderContext, Dot } from "vexflow"
import type { RuntimeBar, RuntimeOnset, TupletInfo } from "@/types"

interface NotationRendererProps {
  bars: RuntimeBar[]
  currentBar: number
  currentBeat: number
  beatFraction: number
  currentTime: number
}

function barToGrid(bar: RuntimeBar): {
  grid: boolean[]
  slotToOnset: Map<number, typeof bar.onsets[0]>
} {
  const grid = new Array(16).fill(false)
  const slotToOnset = new Map<number, typeof bar.onsets[0]>()

  for (const onset of bar.onsets) {
    // Only process regular (d=4) onsets for the grid
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

      // Check if there's a note after the rests (for rest absorption)
      const hasNoteAfterRests = i + 1 + restCount < 4

      let note: StaveNote
      const onsetSlot = beatStart + i
      const onset = slotToOnset.get(onsetSlot) || null

      if (i === 0 && restCount === 3) {
        note = new StaveNote({ keys: ["c/5"], duration: "q", stemDirection: 1 })
        i += 4
      } else if (i === 0 && restCount === 2 && hasNoteAfterRests) {
        // Dotted 8th: absorb 2 rests when note follows at slot 3
        // e.g., 8th + 16th rest + 16th → dotted 8th + 16th
        note = new StaveNote({ keys: ["c/5"], duration: "8d", stemDirection: 1 })
        Dot.buildAndAttach([note], { all: true })
        i += 3
      } else if (hasNoteAfterRests && restCount >= 1) {
        // 8th note: absorb 1 rest when note follows
        // e.g., 16th + 16th + 16th rest + 16th → 16th + 8th + 16th
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
        // Full beat rest = quarter rest
        note = new StaveNote({ keys: ["b/4"], duration: "qr" })
        i += 4
      } else if (i === 0 && restCount === 3) {
        // 3 sixteenths from beat start = dotted eighth rest
        note = new StaveNote({ keys: ["b/4"], duration: "8dr" })
        Dot.buildAndAttach([note], { all: true })
        i += 3
      } else if (i === 1 && restCount === 3) {
        // 3 sixteenths from slot 1 = dotted eighth rest
        note = new StaveNote({ keys: ["b/4"], duration: "8dr" })
        Dot.buildAndAttach([note], { all: true })
        i += 3
      } else if (i % 2 === 0 && restCount >= 2) {
        // 2 sixteenths on even slot = eighth rest
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

function combineConsecutiveRests(
  notes: StaveNote[]
): StaveNote[] {
  const result: StaveNote[] = []
  let i = 0

  while (i < notes.length) {
    const note = notes[i]
    
    if (!note.isRest()) {
      result.push(note)
      i++
      continue
    }

    // Try to combine consecutive rests
    let j = i + 1
    let totalDuration = getDurationInSixteenths(note.getDuration())

    while (j < notes.length && notes[j].isRest()) {
      totalDuration += getDurationInSixteenths(notes[j].getDuration())
      j++
    }

    // Create combined rest if multiple rests found
    if (j > i + 1) {
      const combined = createCombinedRest(totalDuration)
      if (combined) {
        result.push(combined)
      } else {
        // Fallback: add original rests if combination fails
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
    case "qr": return 4   // quarter rest = 4 sixteenths
    case "8r": return 2   // eighth rest = 2 sixteenths
    case "8dr": return 3  // dotted eighth rest = 3 sixteenths
    case "16r": return 1  // sixteenth rest = 1 sixteenth
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
      // For larger durations, create multiple rests
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

  // Combine consecutive rests within the note array
  const combinedNotes = combineConsecutiveRests(allNotes)

  return { notes: combinedNotes, beamGroups, noteToOnset }
}

// Fixed bar width - large enough for 16 sixteenth notes with tuplets
// VexFlow needs significant space to avoid note overflow
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
  
  // Determine duration based on tuplet subdivision.
  // In your data model:
  // - d=3 => triplet subdivision within the beat (render as eighth-note triplet)
  // - d=5 => quintuplet subdivision (your existing use is 16th quintuplet)
  const subdivisionD = group.onsets[0]?.d ?? numNotes
  const duration = subdivisionD === 3 ? "8" : "16"

  // Build a lookup so we can render rests for missing tuplet positions.
  // Example: "hit + rest + hit" triplet => onsets at n=0 and n=2, but we must
  // still draw a rest at n=1.
  const onsetByIndex = new Map<number, RuntimeOnset>()
  for (const onset of group.onsets) {
    onsetByIndex.set(onset.n, onset)
  }

  // Create exactly numNotes tickables: notes where there are onsets, rests where
  // there are gaps.
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
  
  // Create the tuplet bracket
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
  
  // Check if bar has tuplets
  if (hasTuplets(bar)) {
    // For bars with tuplets, we need a different approach
    // Process beat by beat, handling tuplets specially
    const allNotes: StaveNote[] = []
    const tupletGroups = groupTupletsByBeat(bar)
    
    for (let beat = 0; beat < 4; beat++) {
      const tupletGroup = tupletGroups.find((g) => g.beatIndex === beat)
      
      if (tupletGroup) {
        // This beat has a tuplet
        const { notes, tuplet } = createTupletNotes(tupletGroup, noteToOnset)
        allNotes.push(...notes)
        tupletObjects.push(tuplet)
        
        // Beam tuplet notes, but do NOT beam across rests.
        beamsWithNotes.push(...createBeamsSkippingRests(notes))
      } else {
        // Check for regular onsets on this beat
        const beatOnsets = bar.onsets.filter((o) => o.beatIndex === beat && o.d === 4)
        if (beatOnsets.length === 0) {
          // Add quarter rest
          allNotes.push(new StaveNote({ keys: ["b/4"], duration: "qr" }))
        } else {
          // Process regular onsets for this beat using grid approach
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
    
    // Use explicit width to prevent overflow - leave padding for bar lines
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
    // Original logic for bars without tuplets
    const { grid, slotToOnset } = barToGrid(bar)
    const { notes, beamGroups, noteToOnset: gridNoteToOnset } = gridToVexNotes(grid, slotToOnset)

    if (notes.length === 0) return { noteToOnset: new Map(), beamsWithNotes: [] }

    // Copy to our noteToOnset
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

    // Use explicit width to prevent overflow
    const noteAreaWidth = width - (isFirst ? 80 : 20)
    new Formatter().joinVoices([voice]).format([voice], noteAreaWidth, { alignRests: true })
    voice.draw(ctx, stave)

    for (const { beam } of beamsWithNotes) {
      beam.setContext(ctx).draw()
    }
  }

  return { noteToOnset, beamsWithNotes }
}

export function NotationRenderer({ bars, currentBar, currentBeat, beatFraction, currentTime }: NotationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 150 })
  const barResultsRef = useRef<BarRenderResult[]>([])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(400, rect.width),
          height: 150,
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Fixed bar widths - small screens just see less bars ahead
  const barWidths = bars.map((bar) => 
    bar.barIndex === 0 ? FIXED_FIRST_BAR_WIDTH : FIXED_BAR_WIDTH
  )

  // Add left padding so first bar starts further right (allows immediate scrolling)
  const leftPadding = dimensions.width * 0.15

  // Calculate local positions for rendering (where each bar is drawn in the SVG)
  const barPositions: number[] = []
  let x = leftPadding
  for (const w of barWidths) {
    barPositions.push(x)
    x += w
  }
  const totalWidth = x

  // Render notation - only when bars/dimensions change
  useEffect(() => {
    if (!svgRef.current || bars.length === 0) return

    svgRef.current.innerHTML = ""

    const renderer = new Renderer(svgRef.current, Renderer.Backends.SVG)
    renderer.resize(totalWidth, dimensions.height)
    const ctx = renderer.getContext()

    const allBarResults: BarRenderResult[] = []

    bars.forEach((bar, index) => {
      const isFirst = bar.barIndex === 0
      const barX = barPositions[index]
      const barW = barWidths[index] - 2

      const result = renderBar(ctx, bar, barX, 30, barW, isFirst)
      allBarResults.push(result)
    })

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

      // Fix tuplet bracket spacing - VexFlow adds too much left padding
      svg.querySelectorAll(".vf-tuplet").forEach((tupletGroup) => {
        const rects = tupletGroup.querySelectorAll("rect")
        // VexFlow draws: left horiz, right horiz, left vert, right vert
        // We need to shift the left side elements to the right
        const shiftAmount = 8
        const centerShift = shiftAmount / 2
        if (rects.length >= 3) {
          // Left horizontal line - shift x, reduce width by half (gap moves with center)
          const leftHoriz = rects[0]
          const x = parseFloat(leftHoriz.getAttribute("x") || "0")
          const width = parseFloat(leftHoriz.getAttribute("width") || "0")
          leftHoriz.setAttribute("x", String(x + shiftAmount))
          leftHoriz.setAttribute("width", String(Math.max(0, width - centerShift)))

          // Right horizontal line - shift x to move the gap, reduce width to match
          const rightHoriz = rects[1]
          const rightX = parseFloat(rightHoriz.getAttribute("x") || "0")
          const rightWidth = parseFloat(rightHoriz.getAttribute("width") || "0")
          rightHoriz.setAttribute("x", String(rightX + centerShift))
          rightHoriz.setAttribute("width", String(Math.max(0, rightWidth - centerShift)))

          // Left vertical line - shift x
          const leftVert = rects[2]
          const vertX = parseFloat(leftVert.getAttribute("x") || "0")
          leftVert.setAttribute("x", String(vertX + shiftAmount))
        }

        // Shift the number to re-center it (half the bracket shift)
        const text = tupletGroup.querySelector("text")
        if (text) {
          const textX = parseFloat(text.getAttribute("x") || "0")
          text.setAttribute("x", String(textX + centerShift))
        }
      })
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, dimensions])








  // Apply gold highlighting based on current time
  useEffect(() => {
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
  }, [currentTime])

  // Calculate scroll position based on current position within the bar
  // Find which bar in our bars array corresponds to currentBar
  const currentBarArrayIndex = bars.findIndex(b => b.barIndex === currentBar)

  // The key insight: we need to scroll based on progress through the VISIBLE bars,
  // not absolute bar indices. When the window shifts, the first visible bar becomes
  // the reference point (position 0 in our local coordinate system).
  let scrollPosition = 0
  if (currentBarArrayIndex >= 0) {
    // Position at start of current bar (local coordinates)
    scrollPosition = barPositions[currentBarArrayIndex]

    // Add fractional progress through the current bar
    const currentBarWidth = barWidths[currentBarArrayIndex]
    const beatProgress = (currentBeat + beatFraction) / 4
    scrollPosition += currentBarWidth * beatProgress

    // Offset to keep playhead at ~15% of visible area
    scrollPosition -= dimensions.width * 0.15
  } else if (bars.length > 0 && currentBar > bars[bars.length - 1].barIndex) {
    // Past the last bar - keep scrolling
    scrollPosition = totalWidth - dimensions.width * 0.15
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: dimensions.height }}
    >
      <div
        ref={svgRef}
        className="absolute top-0 left-0"
        style={{
          transform: `translateX(${-scrollPosition}px)`,
          transition: "none",
        }}
      />

      {/* Fade edges for cleaner scroll appearance */}
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
