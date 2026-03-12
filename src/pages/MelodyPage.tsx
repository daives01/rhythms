import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, FileText, Gauge, Mic, MicOff, Music, Play, Signal, Volume2 } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { HorizontalSwitch } from "@/components/ui/horizontal-switch"
import { calculateBPMColor, getDifficultyFromValue } from "@/lib/format"
import {
  getDefaultWrittenRange,
  getWrittenKeyOptions,
  getWrittenRangeNoteOptions,
  MAX_WRITTEN_RANGE_MIDI,
  MIN_WRITTEN_RANGE_MIDI,
  MIN_WRITTEN_RANGE_SPAN,
  normalizeWrittenRange,
  reverseTransposeKeySignature,
  transposeKeySignature,
} from "@/lib/melody"
import { loadMelodySettings, saveMelodySettings } from "@/lib/settings"
import { transportEngine } from "@/engines/TransportEngine"
import { decodeMelodyConfig, encodeMelodyConfig, generateSeed } from "@/lib/random"
import { cn } from "@/lib/utils"
import type {
  InstrumentTransposition,
  KeySignature,
  MelodyClef,
  MelodyLayoutMode,
  MelodyPracticeConfig,
} from "@/types"

const INSTRUMENT_OPTIONS: { value: InstrumentTransposition; label: string }[] = [
  { value: "concert", label: "C" },
  { value: "bb", label: "B♭" },
  { value: "eb", label: "E♭" },
  { value: "f", label: "F" },
]

function TrebleClefIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="10 115 125 315" className={className} fill="currentColor">
      <path d="M57.9375 421.875 Q50.3438 421.875 44.7188 418.2188 Q39.0938 414.5625 36.2812 407.6719 Q33.4688 400.7812 33.4688 393.75 Q33.4688 387.2812 35.7188 381.7969 Q37.9688 376.3125 42.75 373.2188 Q47.5312 370.125 53.7188 370.125 Q59.625 370.4062 63.8438 372.5156 Q68.0625 374.625 70.7344 378.7031 Q73.4062 382.7812 73.4062 389.8125 Q73.4062 397.125 70.7344 401.2031 Q68.0625 405.2812 64.2656 407.3906 Q60.4688 409.5 54.8438 409.5 Q52.0312 409.5 50.0625 408.6562 Q48.0938 407.8125 45.8438 405.5625 Q46.9688 409.7812 50.2031 412.1719 Q53.4375 414.5625 57.9375 414.5625 Q65.3906 414.5625 71.0781 409.6406 Q76.7812 404.7188 80.3594 391.5 Q83.9531 378.2812 84.7969 360 L81 360 Q60.1875 360 46.4062 355.7812 Q32.625 351.5625 24.1875 339.4688 Q15.75 327.375 15.75 309.9375 Q15.75 296.4375 20.8125 279 Q27 264.375 36.2812 252 Q45.5625 239.625 59.625 226.6875 L67.9219 217.9688 L64.125 204.1875 Q57.9375 182.25 55.9688 172.9688 Q54 163.6875 54 157.5 Q54 149.625 56.5312 139.2188 Q59.0625 128.8125 66.9375 124.0312 Q74.8125 119.25 80.4375 119.25 Q87.1875 119.25 93.6562 125.1562 Q100.125 131.0625 103.2188 142.5938 Q106.3125 154.125 106.3125 165.375 Q106.3125 174.375 104.625 184.7812 Q102.9375 195.1875 98.0156 205.0312 Q93.0938 214.875 85.7812 223.3125 L83.5312 225.9844 Q86.0625 241.1719 88.875 258.75 L90.8438 272.9531 L95.0625 272.8125 Q105.1875 272.8125 113.3438 277.6719 Q121.5 282.5156 125.4375 292.0156 Q129.375 301.5 129.375 314.4375 Q129.375 327.9375 126.2812 336.5156 Q123.1875 345.0938 115.6562 351 Q108.1406 356.9062 96.0469 358.875 Q94.9219 378.8438 90.2812 394.1719 Q85.6406 409.5 77.4062 415.6875 Q69.1875 421.875 57.9375 421.875 ZM80.4375 344.8125 L84.9375 344.6719 L84.9375 336.0938 Q84.9375 327.2344 84.0156 316.3438 Q83.1094 305.4375 80.8594 288.8438 Q77.3438 290.25 74.25 293.4219 Q71.1562 296.5781 69.3281 300.5938 Q67.5 304.5938 67.5 307.9688 Q67.5 317.5312 69.6094 323.5781 Q71.7188 329.625 77.625 335.25 L73.125 336.9375 Q67.2188 333.8438 63.7031 330.0469 Q60.1875 326.25 58.5 320.7656 Q56.8125 315.2812 56.8125 306.5625 Q56.8125 300.0938 59.5469 293.625 Q62.2969 287.1562 66.9375 282.375 Q71.5781 277.5938 78.8906 275.2031 L77.0625 264.375 Q74.5312 249.0469 72.7031 239.4844 Q63.2812 251.0156 56.8125 260.1562 Q52.3125 267.1875 48.6562 275.625 Q45 284.0625 43.875 292.2188 Q42.75 300.375 42.75 308.8125 Q42.75 318.9375 46.9688 328.5 Q51.1875 338.0625 60.1875 341.4375 Q69.1875 344.8125 80.4375 344.8125 ZM96.1875 343.125 Q103.5 340.5938 106.875 336.2344 Q110.25 331.875 111.6562 326.4688 Q113.0625 321.0469 113.0625 314.4375 Q113.0625 307.125 111.0938 300.375 Q109.125 293.625 104.7656 290.25 Q100.4062 286.875 92.8125 286.875 L92.5312 286.875 Q94.5 302.4844 95.3438 313.9531 Q96.1875 325.4062 96.1875 334.6875 L96.1875 343.125 ZM79.4531 206.4375 Q86.9062 198.9844 90.7031 192.9375 Q94.5 186.8906 96.75 179.375 Q99 171.8438 99 165.375 Q99 157.5 97.5938 152.4375 Q96.1875 147.375 92.8125 143.1562 Q89.4375 138.9375 84.9375 138.9375 Q81.5625 139.2188 78.1875 141.6094 Q74.8125 144 73.2656 147.7969 Q71.7188 151.5938 71.7188 154.9688 Q71.7188 159.4688 72.5625 169.7344 Q73.4062 180 77.625 198.5625 L79.4531 206.4375 Z" stroke="none" />
    </svg>
  )
}

function BassClefIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="12 170 130 190" className={className} fill="currentColor">
      <path d="M26.4375 350.4375 Q23.3438 350.4375 21.7969 349.1719 Q20.25 347.9062 20.25 346.2188 Q20.25 344.25 22.3594 342.7031 Q24.4688 341.1562 26.4375 340.3125 Q39.375 333.5625 48.7969 326.25 Q58.2188 318.9375 69.4688 304.875 Q76.5 295.0312 79.875 281.8125 Q83.25 268.5938 84.0938 255.2344 Q84.9375 241.875 84.9375 227.8125 Q84.9375 214.5938 82.6875 205.4531 Q80.4375 196.3125 75.375 192.0938 Q70.3125 187.875 64.125 187.875 Q56.8125 187.875 51.75 191.25 Q46.6875 194.625 44.0156 199.8281 Q41.3438 205.0312 40.7812 213.75 Q43.0312 211.5 45.1406 210.6562 Q47.25 209.8125 49.7812 209.8125 Q55.4062 209.8125 59.2031 211.9219 Q63 214.0312 65.6719 218.1094 Q68.3438 222.1875 68.3438 229.5 Q68.3438 236.5312 65.6719 240.6094 Q63 244.6875 58.7812 246.7969 Q54.5625 248.9062 48.6562 249.1875 Q39.9375 249.1875 34.4531 244.9688 Q28.9688 240.75 26.0156 234.4219 Q23.0625 228.0938 23.0625 219.6562 Q23.0625 207.5625 28.4062 196.7344 Q33.75 185.9062 44.4375 180.1406 Q55.125 174.375 68.625 174.375 Q82.6875 174.375 93.0938 181.6875 Q103.5 189 107.7188 201.375 Q111.9375 213.75 111.9375 227.8125 Q111.9375 243 108.5625 257.625 Q105.1875 272.25 99.2812 285.4688 Q93.375 298.6875 80.1562 314.7188 Q68.625 326.8125 54.8438 336.0938 Q41.0625 345.375 26.4375 350.4375 ZM126 250.875 Q123.75 250.875 122.0625 249.8906 Q120.375 248.9062 119.5312 247.1562 Q118.6875 245.3906 118.6875 243 Q118.6875 240.6094 119.5938 238.8594 Q120.5156 237.0938 122.125 236.1094 Q123.75 235.125 126 235.125 Q128.8125 235.125 130.4219 235.8281 Q132.0469 236.5312 133.2344 238.3594 Q134.4375 240.1875 134.4375 243 Q134.4375 245.6719 133.3125 247.4375 Q132.1875 249.1875 130.5 250.0312 Q128.8125 250.875 126 250.875 ZM126 211.5 Q123.75 211.5 122.0625 210.5156 Q120.375 209.5312 119.5312 207.7812 Q118.6875 206.0156 118.6875 203.625 Q118.6875 201.2344 119.5938 199.4844 Q120.5156 197.7188 122.125 196.7344 Q123.75 195.75 126 195.75 Q128.8125 195.75 130.4219 196.4531 Q132.0469 197.1562 133.2344 198.9844 Q134.4375 200.8125 134.4375 203.625 Q134.4375 206.2969 133.3125 208.0625 Q132.1875 209.8125 130.5 210.6562 Q128.8125 211.5 126 211.5 Z" stroke="none" />
    </svg>
  )
}

function CClefIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="-200 165 145 210" className={className} fill="currentColor">
      <path d="M-64.9688 322.4531 Q-64.9688 340.7344 -77.0625 353.9531 Q-89.1562 367.1719 -107.2969 367.1719 Q-121.5 367.1719 -131.3438 361.4062 Q-143.2969 354.375 -143.2969 341.1562 Q-143.2969 335.8125 -138.9375 331.5312 Q-134.5781 327.2344 -129.2344 327.2344 Q-123.6094 327.2344 -119.3125 331.3906 Q-115.0312 335.5312 -115.0312 341.1562 Q-115.0312 344.9531 -118.8906 349.6719 Q-122.7656 354.375 -122.7656 355.6406 Q-122.7656 360 -113.7656 360 Q-91.9688 360 -91.9688 322.4531 Q-91.9688 307.125 -95.0625 297.8438 Q-98.2969 288 -108.2812 288 Q-125.7188 288 -130.0781 322.3125 Q-136.2656 286.5938 -152.4375 273.0938 L-152.4375 367.875 L-161.8594 367.875 L-161.8594 169.875 L-152.4375 169.875 L-152.4375 264.7969 Q-136.2656 251.2969 -130.0781 215.5781 Q-125.7188 249.8906 -108.2812 249.8906 Q-98.2969 249.8906 -95.0625 240.0469 Q-91.9688 230.7656 -91.9688 215.4375 Q-91.9688 177.8906 -113.7656 177.8906 Q-122.7656 177.8906 -122.7656 182.25 Q-122.7656 183.5156 -118.8906 188.2344 Q-115.0312 192.9375 -115.0312 196.7344 Q-115.0312 202.3594 -119.3125 206.5156 Q-123.6094 210.6562 -129.2344 210.6562 Q-134.5781 210.6562 -138.9375 206.375 Q-143.2969 202.0781 -143.2969 196.7344 Q-143.2969 183.5156 -131.3438 176.4844 Q-121.5 170.7188 -107.2969 170.7188 Q-89.1562 170.7188 -77.0625 183.9375 Q-64.9688 197.1562 -64.9688 215.4375 Q-64.9688 232.7344 -75.0938 245.6719 Q-85.9219 259.5938 -102.7969 259.5938 Q-111.375 259.5938 -120.375 256.2188 L-128.3906 268.875 L-120.375 281.6719 Q-111.0938 278.1562 -102.7969 278.1562 Q-85.9219 278.1562 -75.0938 292.2188 Q-64.9688 305.1562 -64.9688 322.4531 ZM-171.1406 367.875 L-196.0312 367.875 L-196.0312 169.875 L-171.1406 169.875 L-171.1406 367.875 Z" stroke="none" />
    </svg>
  )
}

const CLEF_OPTIONS: { value: MelodyClef; label: string }[] = [
  { value: "treble", label: "Treble" },
  { value: "bass", label: "Bass" },
  { value: "alto", label: "Alto" },
  { value: "tenor", label: "Tenor" },
]

const CLEF_ICONS: Record<MelodyClef, React.ReactNode> = {
  treble: <TrebleClefIcon className="w-auto h-7" />,
  bass: <BassClefIcon className="w-auto h-5" />,
  alto: <CClefIcon className="w-auto h-5" />,
  tenor: <CClefIcon className="w-auto h-5" />,
}

const WRITTEN_RANGE_OPTIONS = getWrittenRangeNoteOptions()
const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

interface PianoKeyLayout {
  midi: number
  label: string
  isBlack: boolean
  leftUnits: number
  widthUnits: number
  whiteIndex: number
}

const PIANO_KEY_LAYOUT: PianoKeyLayout[] = (() => {
  let whiteIndex = 0

  return WRITTEN_RANGE_OPTIONS.map((option) => {
    const pitchClass = ((option.value % 12) + 12) % 12
    const isBlack = BLACK_KEY_PITCH_CLASSES.has(pitchClass)
    const key = {
      midi: option.value,
      label: option.label,
      isBlack,
      leftUnits: isBlack ? whiteIndex - 0.35 : whiteIndex,
      widthUnits: isBlack ? 0.7 : 1,
      whiteIndex,
    }

    if (!isBlack) {
      whiteIndex += 1
    }

    return key
  })
})()

const PIANO_WHITE_KEY_COUNT = PIANO_KEY_LAYOUT.filter((key) => !key.isBlack).length

function getRangeHighlightBounds(low: number, high: number): { left: number; width: number } {
  const lowKey = PIANO_KEY_LAYOUT.find((key) => key.midi === low)
  const highKey = PIANO_KEY_LAYOUT.find((key) => key.midi === high)

  if (!lowKey || !highKey) {
    return { left: 0, width: 0 }
  }

  const left = (lowKey.leftUnits / PIANO_WHITE_KEY_COUNT) * 100
  const right = ((highKey.leftUnits + highKey.widthUnits) / PIANO_WHITE_KEY_COUNT) * 100

  return {
    left,
    width: Math.max(0, right - left),
  }
}

function ControlKnobSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  subtitle,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  subtitle?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5 relative">
      <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative w-14 h-14 cursor-pointer",
          "bg-zinc-900 border border-zinc-700/80",
          "hover:border-zinc-500 active:scale-[0.97]",
          "transition-all duration-100",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
          "shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
        )}
      >
        <div className="absolute inset-[3px] bg-zinc-950 flex items-center justify-center border border-zinc-800/50">
          <span className="text-sm font-bold tracking-wide text-white">
            {selected?.label}
          </span>
        </div>
      </button>

      {subtitle && (
        <span className="text-[8px] uppercase tracking-[0.15em] text-zinc-600 whitespace-nowrap h-3">
          {subtitle}
        </span>
      )}
      {!subtitle && <div className="h-3" />}

      {open && (
        <div className="absolute top-full mt-1 z-50 border border-zinc-700 bg-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.7)] min-w-[4rem] overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                "w-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-center transition-colors border-b border-zinc-800 last:border-0",
                option.value === value
                  ? "text-white bg-zinc-800"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800/60"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ClefSelector({
  value,
  onChange,
}: {
  value: MelodyClef
  onChange: (value: MelodyClef) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        Clef
      </span>
      <div className="flex gap-0">
        {CLEF_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 px-3 py-2 border border-zinc-700/80 -ml-px first:ml-0 transition-all duration-100",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:z-10",
              option.value === value
                ? "bg-zinc-800 text-white border-zinc-600 z-10"
                : "bg-zinc-900/60 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40 cursor-pointer"
            )}
          >
            <div className={cn(
              "transition-all",
              option.value === value ? "opacity-100" : "opacity-40"
            )}>
              {CLEF_ICONS[option.value]}
            </div>
            <span className="text-[8px] uppercase tracking-[0.15em] font-medium">
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function RangePiano({
  low,
  high,
  onChange,
}: {
  low: number
  high: number
  onChange: (low: number, high: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: "low" | "high" | "move"
    originMidi: number
    startLow: number
    startHigh: number
  } | null>(null)
  const highlight = getRangeHighlightBounds(low, high)

  const lowLabel = WRITTEN_RANGE_OPTIONS.find((o) => o.value === low)?.label ?? ""
  const highLabel = WRITTEN_RANGE_OPTIONS.find((o) => o.value === high)?.label ?? ""

  const xToMidi = (clientX: number): number => {
    const container = containerRef.current
    if (!container) return low
    const rect = container.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const units = fraction * PIANO_WHITE_KEY_COUNT

    let bestKey = PIANO_KEY_LAYOUT[0]
    let bestDist = Infinity
    for (const key of PIANO_KEY_LAYOUT) {
      const center = key.leftUnits + key.widthUnits / 2
      const dist = Math.abs(center - units)
      if (dist < bestDist) {
        bestDist = dist
        bestKey = key
      }
    }
    return bestKey.midi
  }

  const getDragMode = (clientX: number): "low" | "high" | "move" => {
    const container = containerRef.current
    if (!container) return "low"
    const rect = container.getBoundingClientRect()
    const xPercent = ((clientX - rect.left) / rect.width) * 100

    const edgeThresholdPx = 14
    const edgeThreshold = (edgeThresholdPx / rect.width) * 100

    const leftEdge = highlight.left
    const rightEdge = highlight.left + highlight.width

    const distToLeft = Math.abs(xPercent - leftEdge)
    const distToRight = Math.abs(xPercent - rightEdge)

    const nearLeft = distToLeft <= edgeThreshold
    const nearRight = distToRight <= edgeThreshold

    if (nearLeft && nearRight) return distToLeft <= distToRight ? "low" : "high"
    if (nearLeft) return "low"
    if (nearRight) return "high"
    if (xPercent > leftEdge && xPercent < rightEdge) return "move"
    return xPercent < leftEdge ? "low" : "high"
  }

  const getCursor = (mode: "low" | "high" | "move", dragging: boolean): string => {
    if (mode === "low" || mode === "high") return "ew-resize"
    return dragging ? "grabbing" : "grab"
  }

  const setCursor = (cursor: string) => {
    if (containerRef.current) containerRef.current.style.cursor = cursor
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const container = containerRef.current
    if (!container) return

    const mode = getDragMode(e.clientX)
    const midi = xToMidi(e.clientX)

    dragRef.current = {
      mode,
      originMidi: midi,
      startLow: low,
      startHigh: high,
    }

    container.setPointerCapture(e.pointerId)
    setCursor(getCursor(mode, true))
    e.preventDefault()

    if (mode === "low") {
      const r = normalizeWrittenRange(midi, high)
      onChange(r.low, r.high)
    } else if (mode === "high") {
      const r = normalizeWrittenRange(low, midi)
      onChange(r.low, r.high)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) {
      const mode = getDragMode(e.clientX)
      setCursor(getCursor(mode, false))
      return
    }

    const midi = xToMidi(e.clientX)

    if (drag.mode === "low") {
      const r = normalizeWrittenRange(midi, drag.startHigh)
      onChange(r.low, r.high)
    } else if (drag.mode === "high") {
      const r = normalizeWrittenRange(drag.startLow, midi)
      onChange(r.low, r.high)
    } else {
      const delta = midi - drag.originMidi
      let newLow = drag.startLow + delta
      let newHigh = drag.startHigh + delta

      if (newLow < MIN_WRITTEN_RANGE_MIDI) {
        newHigh += MIN_WRITTEN_RANGE_MIDI - newLow
        newLow = MIN_WRITTEN_RANGE_MIDI
      }
      if (newHigh > MAX_WRITTEN_RANGE_MIDI) {
        newLow -= newHigh - MAX_WRITTEN_RANGE_MIDI
        newHigh = MAX_WRITTEN_RANGE_MIDI
      }
      newLow = Math.max(MIN_WRITTEN_RANGE_MIDI, newLow)
      newHigh = Math.min(MAX_WRITTEN_RANGE_MIDI, newHigh)

      onChange(newLow, newHigh)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    containerRef.current?.releasePointerCapture(e.pointerId)
    dragRef.current = null
    const mode = getDragMode(e.clientX)
    setCursor(getCursor(mode, false))
  }

  return (
    <div className="flex flex-col">
      {/* Range info strip */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/60 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            <span className="text-[8px] text-zinc-500">LOW</span>
            {lowLabel}
          </span>
          <div className="w-4 h-px bg-zinc-700" />
          <span className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            <span className="text-[8px] text-zinc-500">HIGH</span>
            {highLabel}
          </span>
        </div>

        <span className="text-[8px] uppercase tracking-[0.2em] text-zinc-600">
          {MIN_WRITTEN_RANGE_SPAN / 12} oct min · Drag to adjust
        </span>
      </div>

      {/* Piano keyboard */}
      <div
        ref={containerRef}
        className="relative h-32 w-full bg-zinc-950 sm:h-40 md:h-44"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Range highlight overlay */}
        <div
          className="pointer-events-none absolute inset-y-0 z-20 mix-blend-screen"
          style={{
            left: `${highlight.left}%`,
            width: `${highlight.width}%`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
          }}
        />

        {/* Left edge handle */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-30 w-[3px]"
          style={{
            left: `${highlight.left}%`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 100%)",
            boxShadow: "0 0 6px rgba(255,255,255,0.08)",
          }}
        />
        {/* Right edge handle */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-30 w-[3px]"
          style={{
            left: `calc(${highlight.left + highlight.width}% - 3px)`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 100%)",
            boxShadow: "0 0 6px rgba(255,255,255,0.08)",
          }}
        />

        {/* White keys */}
        {PIANO_KEY_LAYOUT.filter((key) => !key.isBlack).map((key) => {
          const isInRange = key.midi >= low && key.midi <= high
          const isEdge = key.midi === low || key.midi === high

          return (
            <div
              key={key.midi}
              className={cn(
                "absolute bottom-0 flex flex-col justify-end border-r px-0.5 pb-1 text-left pointer-events-none select-none",
                "md:px-1 md:pb-2",
                isInRange
                  ? "bg-[#f0f0ec] border-zinc-300/80"
                  : "bg-[#b8b8b0] border-zinc-400/60",
                isEdge && "z-[5]"
              )}
              style={{
                left: `${(key.leftUnits / PIANO_WHITE_KEY_COUNT) * 100}%`,
                width: `${(key.widthUnits / PIANO_WHITE_KEY_COUNT) * 100}%`,
                height: "100%",
              }}
            >
              {isEdge && (
                <span className="text-[7px] font-black uppercase tracking-tight text-zinc-900 md:text-[8px]">
                  {key.midi === low ? "▸" : "◂"}
                </span>
              )}
              <span className={cn(
                "hidden text-[7px] uppercase tracking-[0.06em] md:block md:text-[8px]",
                isInRange ? "text-zinc-500" : "text-zinc-500/50"
              )}>
                {key.label}
              </span>
            </div>
          )
        })}

        {/* Black keys */}
        {PIANO_KEY_LAYOUT.filter((key) => key.isBlack).map((key) => {
          const isInRange = key.midi >= low && key.midi <= high
          const isEdge = key.midi === low || key.midi === high

          return (
            <div
              key={key.midi}
              className={cn(
                "absolute top-0 z-10 flex flex-col justify-end border-x border-b px-0.5 pb-1 text-left pointer-events-none select-none",
                "md:px-1 md:pb-1.5",
                isInRange
                  ? "bg-zinc-800 border-zinc-900 shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                  : "bg-zinc-900 border-zinc-950 shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
                isEdge && "z-[15]"
              )}
              style={{
                left: `${(key.leftUnits / PIANO_WHITE_KEY_COUNT) * 100}%`,
                width: `${(key.widthUnits / PIANO_WHITE_KEY_COUNT) * 100}%`,
                height: "58%",
              }}
            >
              {isEdge && (
                <span className="text-[7px] font-black uppercase tracking-tight text-zinc-300 md:text-[8px]">
                  {key.midi === low ? "▸" : "◂"}
                </span>
              )}
              <span className={cn(
                "hidden text-[6px] uppercase tracking-[0.04em] md:block md:text-[7px]",
                isInRange ? "text-zinc-500" : "text-zinc-600/50"
              )}>
                {key.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MelodyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sharedConfig = (() => {
    const encoded = searchParams.get("melody")
    return encoded ? decodeMelodyConfig(encoded) : null
  })()
  const stored = loadMelodySettings()

  const [instrument, setInstrument] = useState<InstrumentTransposition>(() => sharedConfig?.instrument ?? stored.instrument)
  const [melodyBpm, setMelodyBpm] = useState(() => sharedConfig?.bpm ?? stored.bpm)
  const [melodyDifficultyValue, setMelodyDifficultyValue] = useState(() => {
    if (!sharedConfig) return stored.difficultyValue
    if (sharedConfig.difficulty === "easy") return 0
    if (sharedConfig.difficulty === "hard") return 1
    return 0.5
  })
  const [melodyKeySignature, setMelodyKeySignature] = useState<KeySignature>(() => sharedConfig?.keySignature ?? stored.keySignature)
  const [accidentals, setAccidentals] = useState(() => sharedConfig?.accidentals ?? stored.accidentals)
  const [melodyVolume, setMelodyVolume] = useState(() => sharedConfig?.melodyVolume ?? stored.melodyVolume)
  const [micEnabled, setMicEnabled] = useState(() => stored.micEnabled)
  const [clef, setClef] = useState<MelodyClef>(() => sharedConfig?.clef ?? stored.clef)
  const [rangeLow, setRangeLow] = useState(() => sharedConfig?.rangeLow ?? stored.rangeLow)
  const [rangeHigh, setRangeHigh] = useState(() => sharedConfig?.rangeHigh ?? stored.rangeHigh)
  const melodyDifficulty = getDifficultyFromValue(melodyDifficultyValue)

  const writtenKey = transposeKeySignature(melodyKeySignature, instrument)
  const writtenKeyOptions = getWrittenKeyOptions(instrument)
  const uniqueWrittenKeys = [...new Set(writtenKeyOptions)]
  const normalizedRange = normalizeWrittenRange(rangeLow, rangeHigh)
  const currentClefDefault = getDefaultWrittenRange(clef)

  const handleInstrumentChange = (newInstrument: InstrumentTransposition) => {
    setInstrument(newInstrument)
  }

  const handleWrittenKeyChange = (newWrittenKey: KeySignature) => {
    const concertKey = reverseTransposeKeySignature(newWrittenKey, instrument)
    setMelodyKeySignature(concertKey)
  }

  const handleClefChange = (nextClef: MelodyClef) => {
    const rangeMatchesCurrentClefDefault =
      normalizedRange.low === currentClefDefault.low && normalizedRange.high === currentClefDefault.high

    setClef(nextClef)
    if (rangeMatchesCurrentClefDefault) {
      const defaultRange = getDefaultWrittenRange(nextClef)
      setRangeLow(defaultRange.low)
      setRangeHigh(defaultRange.high)
    }
  }

  const handleRangeChange = (nextLow: number, nextHigh: number) => {
    const nextRange = normalizeWrittenRange(nextLow, nextHigh)
    setRangeLow(nextRange.low)
    setRangeHigh(nextRange.high)
  }

  useEffect(() => {
    saveMelodySettings({
      bpm: melodyBpm,
      difficultyValue: melodyDifficultyValue,
      keySignature: melodyKeySignature,
      accidentals,
      melodyVolume,
      micEnabled,
      instrument,
      clef,
      rangeLow: normalizedRange.low,
      rangeHigh: normalizedRange.high,
      exerciseBars: 16,
    })
  }, [
    instrument,
    melodyBpm,
    melodyDifficultyValue,
    melodyKeySignature,
    accidentals,
    melodyVolume,
    micEnabled,
    clef,
    normalizedRange.low,
    normalizedRange.high,
  ])

  const buildConfig = (viewMode: MelodyLayoutMode): MelodyPracticeConfig => ({
    seed: generateSeed(),
    bpm: melodyBpm,
    difficulty: melodyDifficulty,
    keySignature: melodyKeySignature,
    accidentals,
    playbackMode: "both",
    melodyVolume,
    instrument,
    clef,
    rangeLow: normalizedRange.low,
    rangeHigh: normalizedRange.high,
    viewMode,
    sessionMode: viewMode === "page" ? "exercise" : "endless",
    exerciseBars: 16,
  })

  const startMelodySession = () => {
    const config = buildConfig("live")
    const encoded = encodeMelodyConfig(config)

    transportEngine.unlockAudio()

    const start = micEnabled ? "practice" : "listen"
    navigate(`/melody-play?melody=${encoded}&start=${start}&mic=${micEnabled ? "1" : "0"}`, {
      state: { audioUnlocked: true },
    })
  }

  const openSheetMusic = () => {
    const config = buildConfig("page")
    const encoded = encodeMelodyConfig(config)
    navigate(`/melody-sheet?melody=${encoded}`)
  }

  const concertKeyLabel = instrument !== "concert" ? `Concert ${melodyKeySignature}` : undefined

  return (
    <div
      className="min-h-dvh flex flex-col select-none bg-background"
      style={{
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      <main className="flex-1 flex flex-col relative overflow-x-clip overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:px-6 lg:px-10">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="fixed left-4 top-4 z-50 flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {/* The instrument body */}
          <div className="w-full max-w-[920px]">
            {/* ─── Top bezel with brand ─── */}
            <div className="flex items-center justify-between px-5 py-3 bg-zinc-900 border border-zinc-700/60 border-b-0">
              <div className="flex items-center gap-2.5">
                <Music className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                  Melody
                </span>
              </div>
              <div className="flex items-center gap-3 text-[8px] uppercase tracking-[0.2em] text-zinc-600">
                <span>{writtenKey} {clef}</span>
                <span>·</span>
                <span>{melodyBpm} BPM</span>
              </div>
            </div>

            {/* ─── Control surface ─── */}
            <div
              className="border border-zinc-700/60 border-b-0"
              style={{
                background: "linear-gradient(180deg, #161616 0%, #111111 50%, #0e0e0e 100%)",
              }}
            >
              {/* Sliders row */}
              <div className="relative flex flex-col gap-3 px-6 py-5 md:px-8 md:py-6 pl-14 md:pl-16">
                <div className="absolute top-0 bottom-0 left-14 w-px bg-zinc-800/60 md:left-16" />
                <Slider
                  value={melodyBpm}
                  onValueChange={setMelodyBpm}
                  min={50}
                  max={160}
                  step={2}
                  icon={Gauge}
                  label="Tempo"
                  color={calculateBPMColor(melodyBpm)}
                  units={["50", "100", "160"]}
                />
                <Slider
                  value={melodyDifficultyValue}
                  onValueChange={setMelodyDifficultyValue}
                  min={0}
                  max={1}
                  step={0.01}
                  icon={Signal}
                  label="Rhythm"
                  color={melodyDifficulty === "easy" ? "rgb(52, 211, 153)" : melodyDifficulty === "medium" ? "rgb(251, 191, 36)" : "rgb(248, 113, 113)"}
                  units={["EASY", "NORMAL", "ACTIVE"]}
                  snapPoints={[0, 0.5, 1]}
                />
                <Slider
                  value={melodyVolume}
                  onValueChange={setMelodyVolume}
                  min={0}
                  max={1}
                  step={0.01}
                  icon={Volume2}
                  label="Volume"
                  color={melodyVolume === 0 ? "rgb(248, 113, 113)" : "rgb(52, 211, 153)"}
                  units={["0%", "50%", "100%"]}
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-zinc-800/60 mx-4" />

              {/* Controls row: knobs + switches + play */}
              <div className="flex items-start gap-0">
                {/* Controls */}
                <div className="flex-1 flex flex-wrap items-start gap-x-4 gap-y-4 px-5 py-5 md:px-8 md:gap-x-6 lg:gap-x-8">
                  <ControlKnobSelect
                    label="Instrument"
                    value={instrument}
                    options={INSTRUMENT_OPTIONS}
                    onChange={handleInstrumentChange}
                  />
                  <ControlKnobSelect
                    label="Key"
                    value={writtenKey}
                    options={uniqueWrittenKeys.map((key) => ({ value: key, label: key }))}
                    onChange={handleWrittenKeyChange}
                    subtitle={concertKeyLabel}
                  />

                  <div className="w-px self-stretch bg-zinc-800/40 mx-1 hidden sm:block" />

                  <ClefSelector value={clef} onChange={handleClefChange} />

                  <div className="w-px self-stretch bg-zinc-800/40 mx-1 hidden sm:block" />

                  {/* Switches */}
                  <div className="flex flex-col gap-3 pt-5">
                    <HorizontalSwitch
                      checked={accidentals}
                      onCheckedChange={setAccidentals}
                      label="Accidentals"
                    />
                    <div className="flex items-center gap-2">
                      <HorizontalSwitch
                        checked={micEnabled}
                        onCheckedChange={setMicEnabled}
                      />
                      {micEnabled ? (
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <MicOff className="w-3.5 h-3.5 text-zinc-600" />
                      )}
                      <span className={cn(
                        "text-xs font-medium uppercase tracking-wider transition-colors duration-200",
                        micEnabled
                          ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                          : "text-muted-foreground/50"
                      )}>
                        Mic
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons — right edge */}
                <div className="flex items-center justify-center gap-3 px-5 py-5 md:px-8 border-l border-zinc-800/40 self-stretch">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                      Start
                    </span>
                    <button
                      type="button"
                      onClick={startMelodySession}
                      className={cn(
                        "group relative w-16 h-16 cursor-pointer",
                        "bg-zinc-900 border border-zinc-600",
                        "hover:border-zinc-400 active:scale-95",
                        "transition-all duration-100",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
                        "shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                      )}
                    >
                      <div className="absolute inset-[3px] bg-zinc-950 flex items-center justify-center border border-zinc-800/50">
                        <Play className="w-6 h-6 text-white fill-white group-hover:scale-110 transition-transform" />
                      </div>
                    </button>
                    <div className="w-2 h-2 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7)] border border-zinc-700 animate-pulse" />
                  </div>

                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                      Sheet Music
                    </span>
                    <button
                      type="button"
                      onClick={openSheetMusic}
                      className={cn(
                        "group relative w-16 h-16 cursor-pointer",
                        "bg-zinc-900 border border-zinc-600",
                        "hover:border-zinc-400 active:scale-95",
                        "transition-all duration-100",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
                        "shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                      )}
                    >
                      <div className="absolute inset-[3px] bg-zinc-950 flex items-center justify-center border border-zinc-800/50">
                        <FileText className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                      </div>
                    </button>
                    <div className="w-2 h-2 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7)] border border-zinc-700 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Piano section ─── */}
            <div className="border border-zinc-700/60 bg-zinc-950 overflow-hidden">
              <RangePiano
                low={normalizedRange.low}
                high={normalizedRange.high}
                onChange={handleRangeChange}
              />
            </div>

            {/* ─── Bottom bezel ─── */}
            <div className="h-3 bg-zinc-900 border border-zinc-700/60 border-t-0 shadow-[0_4px_16px_rgba(0,0,0,0.4)]" />
          </div>
        </div>
      </main>
    </div>
  )
}
