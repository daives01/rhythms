import { useCallback, useEffect, useRef } from "react"
import { Accidental, BarlineType, Beam, Formatter, Fraction, Renderer, type RenderContext, Stave, StaveNote, Voice } from "vexflow"
import type { KeySignature, MelodyClef, MelodyLayoutMode, RuntimeMelodyBar, RuntimeMelodyEvent } from "@/types"
import { durationToVex, getVexKeySignature } from "@/lib/melody"

export interface MelodyPositionData {
  bar: number
  beat: number
  beatFraction: number
  currentTime: number
}

interface MelodyNotationRendererProps {
  bars: RuntimeMelodyBar[]
  keySignature: KeySignature
  clef?: MelodyClef
  layoutMode?: MelodyLayoutMode
  getPosition?: () => MelodyPositionData | null
  pageWidth?: number
  activeEventId?: string | null
  completedEventIds?: string[]
  palette?: {
    baseColor?: string
    activeColor?: string
    pastColor?: string
  }
}

interface BarRenderResult {
  noteToEvent: Map<StaveNote, RuntimeMelodyEvent>
  beamsWithNotes: { beam: Beam; notes: StaveNote[] }[]
}

interface LinearBarLayout {
  barIndex: number
  x: number
  y: number
  width: number
}

interface PageBarLayout {
  barIndex: number
  x: number
  y: number
  width: number
  isSystemStart: boolean
}

const LIVE_BAR_WIDTH = 220
const LIVE_FIRST_BAR_WIDTH = 260
const STAFF_HEIGHT = 136

function setSvgPaint(element: SVGElement, fill: string | null, stroke: string | null): void {
  if (fill !== null) {
    element.setAttribute("fill", fill)
    element.style.fill = fill
  }

  if (stroke !== null) {
    element.setAttribute("stroke", stroke)
    element.style.stroke = stroke
  }
}

function applyNoteColor(element: Element | null, color: string): void {
  if (!element) return

  const svgNodes = [element, ...element.querySelectorAll("*")]

  for (const node of svgNodes) {
    const svg = node as SVGElement
    const hasStroke = svg.hasAttribute("stroke") && svg.getAttribute("stroke") !== "none"
    // Keep VexFlow's built-in glyph geometry (accidentals, half-noteheads, etc.)
    // and only recolor strokes that already exist.
    setSvgPaint(svg, color, hasStroke ? color : null)
  }
}

function applyBeamColor(element: Element | null, color: string): void {
  if (!element) return

  const svgNodes = [element, ...element.querySelectorAll("*")]
  for (const node of svgNodes) {
    const svg = node as SVGElement
    setSvgPaint(svg, color, color)
  }
}

function renderBar(
  ctx: RenderContext,
  bar: RuntimeMelodyBar,
  keySignature: KeySignature,
  clef: MelodyClef,
  layout: { x: number; y: number; width: number; isSystemStart: boolean }
): BarRenderResult {
  const stave = new Stave(layout.x, layout.y, layout.width)

  if (!layout.isSystemStart) {
    stave.setBegBarType(BarlineType.NONE)
  }

  if (layout.isSystemStart) {
    stave.addClef(clef)
    stave.addKeySignature(getVexKeySignature(keySignature))
    stave.addTimeSignature("4/4")
  }

  stave.setContext(ctx).draw()

  const notes: StaveNote[] = []
  const noteToEvent = new Map<StaveNote, RuntimeMelodyEvent>()

  for (const event of bar.events) {
    const note = new StaveNote({
      keys: [event.staffKey],
      clef,
      duration: durationToVex(event.durationBeats),
    })
    notes.push(note)
    noteToEvent.set(note, event)
  }

  const voice = new Voice({ numBeats: 4, beatValue: 4 })
  voice.setStrict(false)
  voice.addTickables(notes)
  Accidental.applyAccidentals([voice], getVexKeySignature(keySignature))

  const beamsWithNotes = Beam.generateBeams(notes, {
    groups: [new Fraction(1, 4)],
  }).map((beam) => ({
    beam,
    notes: beam.getNotes() as StaveNote[],
  }))

  const noteAreaWidth = layout.width - (layout.isSystemStart ? 100 : 20)
  new Formatter().joinVoices([voice]).format([voice], noteAreaWidth)
  voice.draw(ctx, stave)

  for (const { beam } of beamsWithNotes) {
    beam.setContext(ctx).draw()
  }

  return { noteToEvent, beamsWithNotes }
}

function tintSvg(svgRoot: SVGSVGElement, color: string): void {
  svgRoot.querySelectorAll(".vf-stave path, .vf-stave line, .vf-stave rect, .vf-barline path, .vf-barline line, .vf-barline rect").forEach((element) => {
    const svgElement = element as SVGElement
    setSvgPaint(svgElement, svgElement.getAttribute("fill") === "none" ? null : color, color)
  })

  svgRoot.querySelectorAll("text").forEach((element) => {
    element.setAttribute("fill", color)
    ;(element as SVGElement).style.fill = color
  })
}

export function MelodyNotationRenderer({
  bars,
  keySignature,
  clef = "treble",
  layoutMode = "live",
  getPosition,
  pageWidth,
  activeEventId,
  completedEventIds,
  palette,
}: MelodyNotationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const barResultsRef = useRef<BarRenderResult[]>([])
  const linearLayoutRef = useRef<{
    barLayouts: LinearBarLayout[]
    leftPadding: number
    totalWidth: number
    containerWidth: number
  } | null>(null)
  const lastHighlightTimeRef = useRef<number>(-1)

  const baseColor = palette?.baseColor ?? "#e8dcc8"
  const activeColor = palette?.activeColor ?? "#f59e0b"
  const pastColor = palette?.pastColor ?? "#f4c15d"
  const usesExplicitHighlight = activeEventId !== undefined || (completedEventIds?.length ?? 0) > 0

  const computeLinearLayout = useCallback((containerWidth: number) => {
    const leftPadding = containerWidth * 0.15
    const barLayouts: LinearBarLayout[] = []
    let x = leftPadding

    for (const bar of bars) {
      const width = bar.barIndex === 0 ? LIVE_FIRST_BAR_WIDTH : LIVE_BAR_WIDTH

      barLayouts.push({ barIndex: bar.barIndex, x, y: 34, width })
      x += width
    }

    return {
      barLayouts,
      leftPadding,
      totalWidth: x + 24,
      containerWidth,
    }
  }, [bars])

  const computePageLayout = useCallback((containerWidth: number) => {
    const horizontalPadding = 4
    const innerWidth = Math.max(420, containerWidth - horizontalPadding * 2)
    const barsPerSystem = innerWidth >= 960 ? 4 : innerWidth >= 700 ? 3 : 2
    const systems = Math.ceil(Math.max(bars.length, 1) / barsPerSystem)
    const systemWidth = innerWidth
    const barLayouts: PageBarLayout[] = []

    for (let index = 0; index < bars.length; index++) {
      const systemIndex = Math.floor(index / barsPerSystem)
      const indexInSystem = index % barsPerSystem
      const barsRemaining = bars.length - systemIndex * barsPerSystem
      const systemBars = Math.min(barsPerSystem, barsRemaining)
      const width = systemWidth / systemBars
      const x = horizontalPadding + indexInSystem * width
      const y = 24 + systemIndex * STAFF_HEIGHT

      barLayouts.push({
        barIndex: bars[index].barIndex,
        x,
        y,
        width,
        isSystemStart: indexInSystem === 0,
      })
    }

    return {
      barLayouts,
      width: containerWidth,
      height: Math.max(180, systems * STAFF_HEIGHT + 28),
    }
  }, [bars])

  const applyHighlighting = useCallback((currentTime: number) => {
    const completedIds = new Set(completedEventIds ?? [])

    for (const { noteToEvent, beamsWithNotes } of barResultsRef.current) {
      noteToEvent.forEach((event, note) => {
        const element = note.getSVGElement()
        if (!element) return

        const isActive = usesExplicitHighlight
          ? event.id === activeEventId
          : currentTime >= event.timeSec && currentTime < event.timeSec + event.durationSec
        const isPast = usesExplicitHighlight
          ? completedIds.has(event.id)
          : currentTime >= event.timeSec + event.durationSec
        applyNoteColor(element, isActive ? activeColor : isPast ? pastColor : baseColor)
      })

      for (const { beam, notes } of beamsWithNotes) {
        const element = beam.getSVGElement()
        if (!element) continue

        const beamStarted = notes.some((note) => {
          const event = noteToEvent.get(note)
          if (!event) return false

          if (usesExplicitHighlight) {
            return completedIds.has(event.id) || event.id === activeEventId
          }

          return currentTime >= event.timeSec
        })

        applyBeamColor(element, beamStarted ? (usesExplicitHighlight ? pastColor : activeColor) : baseColor)
      }
    }
  }, [activeColor, activeEventId, baseColor, completedEventIds, pastColor, usesExplicitHighlight])

  const calculateScrollPosition = useCallback((pos: MelodyPositionData, layout: typeof linearLayoutRef.current) => {
    if (!layout || layout.barLayouts.length === 0) return 0

    const { barLayouts, leftPadding, totalWidth, containerWidth } = layout
    const barLayout = layout.barLayouts.find((entry) => entry.barIndex === pos.bar)

    if (barLayout) {
      const beatProgress = (pos.beat + pos.beatFraction) / 4
      return barLayout.x + barLayout.width * beatProgress - containerWidth * 0.15
    }

    const lastBar = barLayouts[barLayouts.length - 1]
    if (pos.bar > lastBar.barIndex) {
      return totalWidth - containerWidth * 0.15
    }

    return leftPadding - containerWidth * 0.15
  }, [])

  useEffect(() => {
    if (layoutMode === "page") return

    const updateLayout = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const containerWidth = Math.max(420, rect.width)
      linearLayoutRef.current = computeLinearLayout(containerWidth)
    }

    updateLayout()
    window.addEventListener("resize", updateLayout)
    return () => window.removeEventListener("resize", updateLayout)
  }, [computeLinearLayout, layoutMode])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || bars.length === 0) return

    const rect = containerRef.current.getBoundingClientRect()
    const containerWidth = layoutMode === "page" && pageWidth ? pageWidth : Math.max(420, rect.width)
    svgRef.current.innerHTML = ""

    const renderer = new Renderer(svgRef.current, Renderer.Backends.SVG)
    const ctx = renderer.getContext()

    if (layoutMode === "page") {
      const layout = computePageLayout(containerWidth)
      renderer.resize(layout.width, layout.height)

      barResultsRef.current = layout.barLayouts
        .map((barLayout) => {
          const bar = bars.find((entry) => entry.barIndex === barLayout.barIndex)
          if (!bar) return null
          return renderBar(ctx, bar, keySignature, clef, barLayout)
        })
        .filter((result): result is BarRenderResult => Boolean(result))
    } else {
      const layout = computeLinearLayout(containerWidth)
      linearLayoutRef.current = layout
      renderer.resize(layout.totalWidth, 170)

      barResultsRef.current = layout.barLayouts
        .map((barLayout) => {
          const bar = bars.find((entry) => entry.barIndex === barLayout.barIndex)
          if (!bar) return null
          return renderBar(ctx, bar, keySignature, clef, {
            x: barLayout.x,
            y: barLayout.y,
            width: barLayout.width - 2,
            isSystemStart: bar.barIndex === 0,
          })
        })
        .filter((result): result is BarRenderResult => Boolean(result))
    }

    const svg = svgRef.current.querySelector("svg")
    if (svg) {
      svg.style.overflow = "visible"
      tintSvg(svg, baseColor)
    }

    applyHighlighting(-1)
    lastHighlightTimeRef.current = -1
  }, [applyHighlighting, bars, baseColor, clef, computeLinearLayout, computePageLayout, keySignature, layoutMode, pageWidth])

  useEffect(() => {
    if (layoutMode === "page") return
    if (!getPosition) return

    const animate = () => {
      const pos = getPosition()

      if (pos && svgRef.current && linearLayoutRef.current) {
        const scrollPosition = calculateScrollPosition(pos, linearLayoutRef.current)
        svgRef.current.style.transform = `translateX(${-scrollPosition}px)`

        if (!usesExplicitHighlight && Math.abs(pos.currentTime - lastHighlightTimeRef.current) > 0.01) {
          applyHighlighting(pos.currentTime)
          lastHighlightTimeRef.current = pos.currentTime
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [applyHighlighting, calculateScrollPosition, getPosition, layoutMode, usesExplicitHighlight])

  useEffect(() => {
    if (!usesExplicitHighlight) return
    applyHighlighting(-1)
  }, [applyHighlighting, usesExplicitHighlight])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={layoutMode === "page" ? "overflow-visible" : "relative w-full overflow-hidden"}
      style={layoutMode === "page" ? undefined : { height: 170 }}
    >
      <div
        ref={svgRef}
        className={layoutMode === "page" ? "" : "absolute top-0 left-0"}
        style={layoutMode === "page" ? undefined : { willChange: "transform", transform: "translateX(0px)" }}
      />
    </div>
  )
}
