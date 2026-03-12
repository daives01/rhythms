# Melodic Sightreading: Next Phases

## Current MVP

The app now has a standalone melodic practice flow:

- `/melody` landing page with tempo, key signature, rhythm difficulty, and playback controls
- `/melody-play` endless melodic practice session
- simple major-key melodic generation
- treble-clef rendering with scrolling notation
- optional melody and metronome playback

What it does not do yet:

- no print/full-page layout
- no transposition for Bb/Eb/F instruments
- no seeded sharing/history/groups for melody
- no microphone-based note validation
- no score/fail/wait logic for melody

## Phase 2

### Goal

Make melodic sightreading more useful for real reading practice by improving previewability, adding instrument transposition, and supporting static printable material.

### Scope

#### 1. Expanded reading layouts

Add more than the current narrow scrolling-strip view.

Planned additions:

- `scroll` view: current behavior, cleaned up and kept as default
- `wide` view: show more bars at once with slower horizontal movement
- `page` view: render multiple systems in a full-page layout suitable for silent reading and printing

Implementation direction:

- Keep the current melodic event/bar model as the source of truth
- Add a separate page-layout renderer instead of forcing the scrolling renderer to do both jobs
- Reuse existing notation-building logic where possible, but split layout concerns from engraving concerns

Acceptance criteria:

- user can choose between scrolling and wider/static reading modes
- page view renders stable multi-system notation without overlaps
- layout works on desktop and mobile, with page view optimized primarily for desktop/print

#### 2. Printable melodic sheets

Generate finite melodic exercises that can be read without autoplay.

Planned additions:

- fixed-length exercise generation, for example 8, 12, or 16 bars
- print-friendly route or print mode
- optional heading block with key, tempo, difficulty, and generated date

Implementation direction:

- add a finite melody generator mode alongside the endless buffer
- render multiple systems with explicit line breaks
- use browser print CSS rather than exporting PDFs in the first pass

Acceptance criteria:

- user can generate a fixed-length melody page
- browser print preview is clean and readable
- printed page preserves note spacing, barlines, and key signature correctly

#### 3. Instrument transposition

Add notation and playback transposition for common transposing instruments.

Planned presets:

- Concert
- Bb
- Eb
- F

Implementation direction:

- keep melody generation internal in concert pitch
- apply transposition at render/playback boundaries
- store both concert-pitch event data and display/playback pitch mapping cleanly
- ensure displayed key signature changes with instrument transposition

Technical notes:

- rendering needs transposed staff keys and transposed key signature
- playback should follow the selected instrument mode if the feature is positioned as “read what you hear”
- if needed later, split “written pitch” and “sounding pitch” as separate options, but not in the first transposition release

Acceptance criteria:

- user can switch instrument preset from the melody page
- notation transposes correctly for all supported presets
- playback follows the displayed notation consistently

#### 4. Optional seeded replay/share for melody

Make melodic exercises repeatable before full challenge/history support.

Planned additions:

- finite melodic exercise config encoded in URL
- replay same exercise from the melody page
- optionally save recent local melodic sessions without touching Convex yet

Implementation direction:

- extend the encoded config payload to support melody mode and melodic settings
- keep this local/client-only first
- do not mix melody sessions into current rhythm history until the data model is intentionally expanded

Acceptance criteria:

- a shared melody link reproduces the same melody
- replay preserves key, difficulty, transposition, and playback options as intended

### Phase 2 Suggested File Areas

- `src/pages/MelodyPage.tsx`
- `src/pages/MelodyPlayPage.tsx`
- `src/components/MelodyNotationRenderer.tsx`
- new page-layout/print renderer files
- `src/lib/melody.ts`
- `src/lib/random.ts`
- `src/types.ts`

## Phase 3

### Goal

Add microphone-based melodic validation so the app can respond to note accuracy in real time.

### Product direction

Default to a forgiving practice-first model:

- expected behavior: wait at the current note until the user plays the correct pitch
- optional later mode: stricter continuous flow with misses/failure

This should be built for reliability first, not strictness first.

### Scope

#### 1. Pitch detection pipeline

Add live microphone capture and pitch estimation.

Implementation direction:

- use `getUserMedia` to capture microphone input
- analyze audio with `AnalyserNode` or AudioWorklet-based processing
- detect stable fundamental frequency and map it to nearest note
- suppress noise and unstable detections with amplitude and confidence gating

Needed outputs:

- detected frequency
- detected MIDI note
- confidence/stability score
- input amplitude threshold state

Acceptance criteria:

- microphone permission flow works reliably
- idle room noise does not trigger note matches
- sustained played notes produce stable pitch readings

#### 2. Melody judge engine

Create a dedicated melody validator instead of reusing tap timing logic.

Implementation direction:

- add `MelodyJudgeEngine`
- compare live pitch input against the current expected melodic event
- include timing tolerance windows for note onset and sustain
- support at least two evaluation policies:
  - `wait`: advance only when correct note is detected
  - `strict`: mark miss/wrong note after a grace window

Why separate engine:

- rhythm judging is event-tap based
- melody judging is continuous input matching
- the state machine and failure modes are fundamentally different

Acceptance criteria:

- correct note advances the exercise in wait mode
- wrong note does not advance the exercise
- strict mode can mark misses without destabilizing the session

#### 3. UX for real-time feedback

Expose note accuracy clearly without overwhelming the user.

Planned additions:

- current target note highlight
- live detected note indicator
- simple in-tune/correct/wrong visual feedback
- mic permission and signal status UI

Optional later additions:

- cents deviation meter
- pitch history strip
- noise-floor calibration flow

Acceptance criteria:

- user can see whether the app hears them
- user can tell which note is expected now
- feedback remains readable on mobile and desktop

#### 4. Scoring and progression rules

Define how validated melodic practice should progress.

Recommended order:

- first release: no score, wait mode only
- next: completion stats such as notes attempted, notes correct, average response latency
- later: strict mode scoring and challenge compatibility

Implementation direction:

- do not add Convex persistence until the note-validation loop is reliable
- keep stats local during early pitch-validation work
- only add failure/scoring once false-positive and false-negative behavior is acceptable

Acceptance criteria:

- wait mode is usable and musically intuitive
- statistics reflect actual play reasonably well
- failure logic is not introduced before detection quality is proven

### Phase 3 Suggested File Areas

- new mic/pitch modules under `src/lib/` or `src/engines/`
- `src/engines/MelodyJudgeEngine.ts`
- `src/pages/MelodyPlayPage.tsx`
- melody status/feedback UI components
- future settings additions for mic sensitivity and validation mode

## Risks and Sequencing

### Highest-risk technical areas

- stable pitch detection in noisy environments
- clean engraving across scrolling and full-page layouts
- keeping transposition logic consistent between notation and playback

### Recommended order

1. Phase 2 layout improvements
2. Phase 2 print mode
3. Phase 2 transposition
4. Phase 2 seeded replay/share
5. Phase 3 pitch detection prototype
6. Phase 3 wait-mode melodic validation
7. Phase 3 strict-mode and scoring experiments

## Open Product Questions

- Should playback in transposed mode follow written pitch or concert pitch?
- Should printable exercises include answer/reference playback links via QR or URL?
- When melodic history is added, should it live beside rhythm history or as a separate tab/filter?
- For microphone mode, should the app require octave accuracy or pitch-class-only first?
