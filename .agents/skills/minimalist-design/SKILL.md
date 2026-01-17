---
name: minimalist-design
description: Create distinctive, production-grade frontend interfaces with high design quality using a mono brutal grid aesthetic. Use when building web components, pages, or applications that need engineered, minimal design.
license: Complete terms in LICENSE.txt
---

# Minimalist Design

This skill produces **production-grade frontend UI** with a **brutally minimal, monochrome** aesthetic inspired by ultra-clean engineering sites (e.g., Opencode-like): **near-black surfaces, hairline dividers, strict grid, monospace everywhere, and zero border radius**.

The goal is not "empty"; it's **precise**. Every pixel is intentional.

---

## When to Use

Use this skill when the user wants:
- Minimal black UI, terminal-adjacent but polished
- Documentation, developer tools, CLI-adjacent products, changelogs, status pages
- Interfaces that feel **engineered**: straight lines, modular sections, calm tone

---

## Design Thinking (Minimal Variant)

Before coding, quickly lock the frame:

1. **Purpose**
   - What does the site/app do?
   - Primary action (read docs, sign up, install, compare plans, browse components)?

2. **Tone**
   - Commit to: **Mono Brutal Grid**
   - Keywords: sparse, stark, modular, technical, calm, deliberate

3. **Constraints**
   - Framework (Next/React/Vue/Svelte/vanilla), SSR/CSR, performance targets
   - A11y requirements, theming, responsiveness, content volume

4. **Differentiation**
   - The memorable thing should be *discipline*: grid rhythm, typography clarity,
     and razor-straight structure—not gimmicks.

If missing info, ask up to **3 focused questions** max (e.g., stack, pages, primary CTA).

---

## Aesthetic Direction: "Mono Brutal Grid"

### Non‑Negotiables
- **Palette**: monochrome only by default  
  - Near-black base, subtle stepped surfaces, white/gray text.
  - Optional: **one** accent color (only if user requests).
- **Geometry**: rectangles only  
  - **Border radius = 0 everywhere** (buttons, inputs, cards, images, modals).
- **Structure**: hairlines + grid  
  - Use 1px dividers to define sections, columns, tables, footers.
- **Typography**: monospace for *all* UI text  
  - Avoid generic system monospace. Prefer a characterful mono.
- **Spacing**: generous, consistent scale; calm negative space.
- **Motion**: restrained and purposeful  
  - Subtle fades/inverts; no bouncy easing, no scroll-jank, no decorative parallax.
- **No "AI slop" patterns**:
  - No rounded cards, pill buttons, pastel gradients, glassmorphism, neon glows,
    soft drop shadows everywhere, or generic landing-page tropes.

### Monospace Font Guidance (pick one, justify it)
Choose a distinctive monospace and commit to it:
- Preferred options: `IBM Plex Mono`, `Fragment Mono`, `DM Mono`, `Spline Sans Mono`
- If user has brand fonts, use them—still enforce mono-only UI.

---

## Design System First (Tokens)

Define tokens up front and implement everything through them.

### Token Categories
- **Surfaces**
  - `--bg-0` (base near-black)
  - `--bg-1` (raised panel)
  - `--bg-2` (hover/active surface)
- **Text**
  - `--text-0` (primary)
  - `--text-1` (muted)
  - `--text-2` (disabled)
- **Lines**
  - `--line-0` (subtle 1px divider)
  - `--line-1` (strong divider)
- **Spacing scale**
  - 6–8 steps (e.g., 4/8/12/16/24/32/48/64)
- **Type scale**
  - 3–5 sizes max; consistent line-heights
- **Radii**
  - `--radius: 0px;` and no exceptions
- **Focus**
  - High visibility, monochrome-consistent (outline/box-shadow OK)

---

## Layout System

- Use a strict grid (e.g., 12 columns or a simple 2–3 column editorial grid).
- Constrain content with a max-width; keep edges clean and aligned.
- Prefer **section blocks separated by dividers** over "cards everywhere."
- Favor **repetition** to create a system feel (modules, rows, tables, lists).

---

## Component Library (Must Include States)

Implement these components with meticulous states:

1. **Header / Nav**
   - Minimal links, generous padding, divider line, optional right-side cluster
2. **Section Block**
   - Title row + divider + content region
3. **Buttons**
   - Primary / secondary / ghost
   - States: default, hover, active, focus, disabled
   - Hover behavior: subtle invert or surface step, never glow
4. **Links**
   - Choose one rule and stick to it: underline-on-hover OR always-underlined
5. **Inputs**
   - Rectangular, clear focus, visible placeholder vs value contrast
6. **Cards (Rect Modules)**
   - Bordered rectangles, padding-driven hierarchy, no radius
7. **Tables / Lists**
   - Hairlines, aligned columns, tabular numerals if relevant
8. **Footer**
   - Column layout separated by vertical dividers, minimal meta links

Every interactive element must have a **keyboard-visible focus style**.

---

## Page Pattern (Default Marketing/Docs Hybrid)

Use a disciplined structure:
- **Hero**: one strong headline + short subcopy + 1 primary CTA
- **Credibility row**: small stat/links row (optional bracket counts like `GitHub [74K]`)
- **Sections (3–5)**: each separated by whitespace + 1px rules
- **CTA band**: simple subscribe/waitlist row (input + button)
- **Footer**: structured link blocks, dividers, legal row

Copy style: short, technical, direct. Avoid hype.

---

## Implementation Requirements (Production-Grade)

- Real working code with:
  - semantic HTML
  - accessible forms and controls
  - keyboard navigation
  - responsive layout
  - performance-minded CSS (no heavy effects)
- Use CSS variables for tokens.
- Keep dependencies minimal unless the user requests a stack.
- Motion: prefer CSS-only; keep durations short and easing subtle.

---

## Accessibility + QA Checklist (Must Pass)

- Contrast: text meets WCAG AA on near-black.
- Focus: always visible; never removed.
- Touch targets: reasonable minimum sizing.
- Dividers: hairlines remain visible across displays (avoid too-low contrast).
- Reduced motion: respect `prefers-reduced-motion`.

---

## Output Contract (What You Deliver)

When the user requests a UI build, deliver:

1. **Aesthetic commitment** (1–2 sentences): "Mono Brutal Grid" rationale
2. **Design tokens** (surfaces/text/lines/spacing/type/focus)
3. **Component specs** (including interaction states)
4. **Page layout** (wireframe-level structure + content slots)
5. **Implementation plan** (files/components breakdown)
6. **Working code** (only as much as the user asked for; production-ready)

---

## Defaults (Unless User Overrides)

- Theme: monochrome near-black
- Radius: 0
- Font: a distinctive monospace (choose + apply everywhere)
- Dividers: 1px grid hairlines used to structure the whole UI
- Motion: minimal (fade/invert), reduced-motion safe
