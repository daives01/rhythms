import { useEffect, useRef, useState } from "react"
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, RenderContext, Dot } from "vexflow"
import type { RuntimeBar, RuntimeOnset } from "@/types"

interface NotationRendererProps {
  bars: RuntimeBar[]
  currentBar: number
  currentBeat: number
  beatFraction: number
  hitVersion: number
}

function shouldHighlightOnset(onset: RuntimeOnset): boolean {
  return onset.hit === true
}

function barToGrid(bar: RuntimeBar): {
  grid: boolean[]
  slotToOnset: Map<number, typeof bar.onsets[0]>
} {
  const grid = new Array(16).fill(false)
  const slotToOnset = new Map<number, typeof bar.onsets[0]>()

  for (const onset of bar.onsets) {
    const slot = onset.beatIndex * 4 + onset.n
    grid[slot] = true
    slotToOnset.set(slot, onset)
  }
  return { grid, slotToOnset }
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

      let note: StaveNote
      const onsetSlot = beatStart + i
      const onset = slotToOnset.get(onsetSlot) || null

      if (i === 0 && restCount === 3) {
        note = new StaveNote({ keys: ["b/4"], duration: "q", stemDirection: 1 })
        i += 4
      } else if (i % 2 === 0 && restCount >= 1) {
        note = new StaveNote({ keys: ["b/4"], duration: "8", stemDirection: 1 })
        i += 2
      } else {
        note = new StaveNote({ keys: ["b/4"], duration: "16", stemDirection: 1 })
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

  return { notes: allNotes, beamGroups, noteToOnset }
}

// Minimum bar width to ensure notes don't overflow
const MIN_BAR_WIDTH = 140
const MIN_FIRST_BAR_WIDTH = 200

// Calculate bar width based on complexity
function calculateBarWidth(bar: RuntimeBar, baseWidth: number, isFirst: boolean): number {
  const numNotes = bar.onsets.length

  // Count sixteenth note positions used (more = more complex)
  let hasOffbeatSixteenths = false
  for (const onset of bar.onsets) {
    if (onset.n % 2 === 1) hasOffbeatSixteenths = true
  }

  // Base width scaled by content - dense bars need substantially more space
  let widthMultiplier = 1.0

  if (numNotes >= 12) widthMultiplier = 1.7
  else if (numNotes >= 8) widthMultiplier = 1.4
  else if (numNotes >= 5) widthMultiplier = 1.15
  else if (numNotes >= 3) widthMultiplier = 1.0
  else widthMultiplier = 0.9

  if (hasOffbeatSixteenths) widthMultiplier += 0.2

  // First bar needs extra space for clef/time sig
  const firstBarExtra = isFirst ? 60 : 0
  const minWidth = isFirst ? MIN_FIRST_BAR_WIDTH : MIN_BAR_WIDTH

  return Math.max(minWidth, Math.round(baseWidth * widthMultiplier + firstBarExtra))
}

interface BarRenderResult {
  noteToOnset: Map<StaveNote, RuntimeOnset>
  beamsWithNotes: { beam: Beam; notes: StaveNote[] }[]
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

  const { grid, slotToOnset } = barToGrid(bar)
  const { notes, beamGroups, noteToOnset } = gridToVexNotes(grid, slotToOnset)

  if (notes.length === 0) return { noteToOnset: new Map(), beamsWithNotes: [] }

  const voice = new Voice({ numBeats: 4, beatValue: 4 })
  voice.setStrict(false)
  voice.addTickables(notes)

  const beamsWithNotes: { beam: Beam; notes: StaveNote[] }[] = []
  for (const group of beamGroups) {
    if (group.length >= 2) {
      const beam = new Beam(group)
      beamsWithNotes.push({ beam, notes: group })
    }
  }

  // Let VexFlow compute optimal spacing within the stave
  new Formatter().joinVoices([voice]).formatToStave([voice], stave)
  voice.draw(ctx, stave)

  for (const { beam } of beamsWithNotes) {
    beam.setContext(ctx).draw()
  }

  return { noteToOnset, beamsWithNotes }
}

export function NotationRenderer({ bars, currentBar, currentBeat, beatFraction, hitVersion }: NotationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 150 })

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

  const baseBarWidth = (dimensions.width - 20) / 4

  // Calculate widths for all bars
  const barWidths = bars.map((bar) => {
    const isFirst = bar.barIndex === 0
    return calculateBarWidth(bar, baseBarWidth, isFirst)
  })

  // Add left padding so first bar starts further right (allows immediate scrolling)
  const leftPadding = dimensions.width * 0.2

  // Calculate local positions for rendering (where each bar is drawn in the SVG)
  const barPositions: number[] = []
  let x = leftPadding
  for (const w of barWidths) {
    barPositions.push(x)
    x += w
  }
  const totalWidth = x

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

      const goldColor = "#f59e0b"

      const applyGoldToElement = (elem: Element | null | undefined) => {
        if (!elem) return
        elem.querySelectorAll("*").forEach((child) => {
          const svgChild = child as SVGElement
          if (svgChild.hasAttribute("fill") && svgChild.getAttribute("fill") !== "none") {
            svgChild.setAttribute("fill", goldColor)
          }
          if (svgChild.hasAttribute("stroke") && svgChild.getAttribute("stroke") !== "none") {
            svgChild.setAttribute("stroke", goldColor)
          }
          if (svgChild.style) {
            if (svgChild.style.fill && svgChild.style.fill !== "none") {
              svgChild.style.fill = goldColor
            }
            if (svgChild.style.stroke && svgChild.style.stroke !== "none") {
              svgChild.style.stroke = goldColor
            }
          }
        })
        elem.querySelectorAll("path, ellipse, circle, rect, line").forEach((el) => {
          const svgEl = el as SVGElement
          const fill = svgEl.getAttribute("fill")
          const stroke = svgEl.getAttribute("stroke")
          if (fill !== "none") {
            svgEl.setAttribute("fill", goldColor)
            svgEl.style.fill = goldColor
          }
          if (stroke !== "none") {
            svgEl.setAttribute("stroke", goldColor)
            svgEl.style.stroke = goldColor
          }
        })
      }

      for (const { noteToOnset, beamsWithNotes } of allBarResults) {
        noteToOnset.forEach((onset, note) => {
          if (shouldHighlightOnset(onset)) {
            applyGoldToElement(note.getSVGElement())
          }
        })

        for (const { beam, notes } of beamsWithNotes) {
          const allNotesHit = notes.every((note) => {
            const onset = noteToOnset.get(note)
            return onset && shouldHighlightOnset(onset)
          })
          if (allNotesHit) {
            applyGoldToElement(beam.getSVGElement())
          }
        }
      }
    }
  }, [bars, dimensions, barWidths, barPositions, totalWidth, hitVersion])

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
