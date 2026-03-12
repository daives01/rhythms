import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChevronLeft, ChevronRight, Printer } from "lucide-react"
import { MelodyNotationRenderer } from "@/components/MelodyNotationRenderer"
import { Button } from "@/components/ui/button"
import { createFixedMelodyExercise, applyInstrumentToRuntimeBars } from "@/lib/melody-session"
import { transposeKeySignature } from "@/lib/melody"
import { decodeMelodyConfig, encodeMelodyConfig } from "@/lib/random"
import type { MelodyPracticeConfig, RuntimeMelodyBar } from "@/types"

const PAGE_BAR_COUNT = 16
const SCREEN_PAGE_WIDTH = 1180
const PRINT_PAGE_WIDTH = 1020
const PRINT_MEASURE_OPTIONS = [16, 32, 48, 64, 96]

function getPageSeed(seed: string, pageIndex: number): string {
  return `${seed}:page:${pageIndex}`
}

function buildSheetConfig(config: MelodyPracticeConfig, pageIndex: number): MelodyPracticeConfig {
  return {
    ...config,
    seed: getPageSeed(config.seed, pageIndex),
    exerciseBars: PAGE_BAR_COUNT,
    viewMode: "page",
    sessionMode: "exercise",
  }
}

function buildPageBars(config: MelodyPracticeConfig, pageIndex: number) {
  const pageConfig = buildSheetConfig(config, pageIndex)
  return applyInstrumentToRuntimeBars(
    createFixedMelodyExercise(pageConfig),
    pageConfig.keySignature,
    pageConfig.instrument
  )
}

function buildContinuousBars(config: MelodyPracticeConfig, startPageIndex: number, totalMeasures: number): RuntimeMelodyBar[] {
  const pageCount = Math.max(1, Math.ceil(totalMeasures / PAGE_BAR_COUNT))
  const mergedBars: RuntimeMelodyBar[] = []

  for (let offset = 0; offset < pageCount; offset++) {
    const bars = buildPageBars(config, startPageIndex + offset)
    for (const bar of bars) {
      mergedBars.push({
        ...bar,
        id: `${bar.id}-print-${mergedBars.length}`,
        barIndex: mergedBars.length,
      })
    }
  }

  return mergedBars.slice(0, totalMeasures)
}

function chunkBars(bars: RuntimeMelodyBar[], chunkSize: number): RuntimeMelodyBar[][] {
  const chunks: RuntimeMelodyBar[][] = []

  for (let index = 0; index < bars.length; index += chunkSize) {
    chunks.push(
      bars.slice(index, index + chunkSize).map((bar, offset) => ({
        ...bar,
        id: `${bar.id}-system-${index + offset}`,
        barIndex: offset,
      }))
    )
  }

  return chunks
}

export function MelodySheetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const melodyParam = searchParams.get("melody")
  const parsedPage = Number.parseInt(searchParams.get("page") ?? "0", 10)
  const pageIndex = Number.isFinite(parsedPage) ? Math.max(0, parsedPage) : 0
  const config = melodyParam ? decodeMelodyConfig(melodyParam) : null
  const [printMeasureCount, setPrintMeasureCount] = useState(PAGE_BAR_COUNT)

  useEffect(() => {
    if (!config) {
      navigate(melodyParam ? `/melody?melody=${melodyParam}` : "/melody", { replace: true })
    }
  }, [config, melodyParam, navigate])

  if (!config) {
    return null
  }

  const baseConfig: MelodyPracticeConfig = {
    ...config,
    exerciseBars: PAGE_BAR_COUNT,
    viewMode: "page",
    sessionMode: "exercise",
  }
  const displayKeySignature = transposeKeySignature(baseConfig.keySignature, baseConfig.instrument)
  const currentBars = buildPageBars(baseConfig, pageIndex)
  const printBars = buildContinuousBars(baseConfig, pageIndex, printMeasureCount)
  const printSystems = chunkBars(printBars, 4)

  const navigateToPage = (nextPageIndex: number) => {
    const params = new URLSearchParams()
    params.set("melody", encodeMelodyConfig(baseConfig))
    if (nextPageIndex > 0) {
      params.set("page", String(nextPageIndex))
    }
    navigate(`/melody-sheet?${params.toString()}`)
  }
  const navigateBackToMelody = () => {
    const encodedConfig = encodeMelodyConfig(baseConfig)
    navigate(`/melody?melody=${encodedConfig}`)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="print-hide border-b border-border px-3 py-3 md:px-4">
        <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={navigateBackToMelody}>
              <ChevronLeft className="mr-2 h-3.5 w-3.5" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateToPage(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>
              <ChevronLeft className="mr-2 h-3.5 w-3.5" />
              Previous
            </Button>
            <div className="min-w-20 text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Page {pageIndex + 1}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateToPage(pageIndex + 1)}>
              Next
              <ChevronRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Print Measures
            </label>
            <select
              value={printMeasureCount}
              onChange={(event) => setPrintMeasureCount(Number(event.target.value))}
              className="h-8 border border-border bg-background px-3 text-[10px] uppercase tracking-[0.22em] text-foreground outline-none focus:border-foreground"
            >
              {PRINT_MEASURE_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex items-start justify-center p-3 md:p-4 print-hide">
          <div className="sheet-paper screen-sheet w-full max-w-[1220px]">
            <MelodyNotationRenderer
              bars={currentBars}
              keySignature={displayKeySignature}
              clef={baseConfig.clef}
              layoutMode="page"
              pageWidth={SCREEN_PAGE_WIDTH}
              palette={{ baseColor: "#111111", activeColor: "#111111", pastColor: "#111111" }}
            />
          </div>
        </div>

        <div className="print-only">
          <div className="sheet-paper print-sheet">
            {printSystems.map((systemBars, index) => (
              <div key={`print-system-${index}`} className="print-system">
                <MelodyNotationRenderer
                  bars={systemBars}
                  keySignature={displayKeySignature}
                  clef={baseConfig.clef}
                  layoutMode="page"
                  pageWidth={PRINT_PAGE_WIDTH}
                  palette={{ baseColor: "#111111", activeColor: "#111111", pastColor: "#111111" }}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
