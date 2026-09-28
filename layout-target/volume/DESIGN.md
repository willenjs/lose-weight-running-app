---
name: Kinetic Performance
colors:
  surface: '#121318'
  surface-dim: '#121318'
  surface-bright: '#38393f'
  surface-container-lowest: '#0d0e13'
  surface-container-low: '#1a1b21'
  surface-container: '#1e1f25'
  surface-container-high: '#292a2f'
  surface-container-highest: '#34343a'
  on-surface: '#e3e1e9'
  on-surface-variant: '#b9cbbd'
  inverse-surface: '#e3e1e9'
  inverse-on-surface: '#2f3036'
  outline: '#849588'
  outline-variant: '#3b4a40'
  surface-tint: '#00e390'
  primary: '#c9ffdb'
  on-primary: '#003920'
  primary-container: '#10f49c'
  on-primary-container: '#006b41'
  inverse-primary: '#006d42'
  secondary: '#a5e7ff'
  on-secondary: '#003543'
  secondary-container: '#00d2ff'
  on-secondary-container: '#00566a'
  tertiary: '#ffefee'
  on-tertiary: '#680013'
  tertiary-container: '#ffc9c8'
  on-tertiary-container: '#bc002a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#52ffac'
  primary-fixed-dim: '#00e390'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#005231'
  secondary-fixed: '#b6ebff'
  secondary-fixed-dim: '#47d6ff'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#004e60'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b2'
  on-tertiary-fixed: '#410008'
  on-tertiary-fixed-variant: '#92001f'
  background: '#121318'
  on-background: '#e3e1e9'
  surface-variant: '#34343a'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 84px
    fontWeight: '700'
    lineHeight: 84px
    letterSpacing: -0.04em
  display-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.06em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin: 1.25rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system is engineered for treadmill interval training and metabolic conditioning. It merges the focused precision of elite athletic telemetry (WHOOP, Apple Fitness+) with the raw motivation and momentum of contemporary running culture (Nike Run Club). The aesthetic bridges **High-Contrast Performance Minimalist** with **Tactile Biometric HUD** styling: deep pitch-black foundations that disappear under harsh gym halogen lights, punctuated by hyper-legible, neon-chromatic cadence cues.

The emotional signature is relentless, calculated, and empowering. Every micro-interaction communicates progress and control, eliminating cognitive overhead during peak cardiac exertion. The UI must remain legible and navigable when vibrating on a bouncing treadmill shelf, observed at an arm's length (1 meter) by an athlete under heavy physical strain.

## Colors

The palette is anchored by deep obsidian tones to minimize battery consumption on OLED displays and eliminate glare in dimly lit gym studios or high-reflection environments. Intervals rely on an unambiguous, four-phase chromatic telemetry code:

- **Recovery / Walk Phase (High-Octane Cyan):** `#00D2FF`. Calming yet razor-sharp; conveys replenishment, lower heart rates, and active recovery intervals.
- **Base / Jog Phase (Radiant Amber):** `#FFAB00`. Warm, luminous, and focused; communicates sustained aerobic baseline output.
- **Peak / Sprint Phase (Vivid Crimson):** `#FF334B`. Intense, urgent, and high-frequency; demands maximum anaerobic exertion.
- **Brand / Milestone / System Primary (Electric Mint):** `#10F49C`. Signals target completion, active timers, streaks, and vital telemetry checkpoints.

### Surface Architecture
- **Base Canvas (`surface-0`):** `#0C0D12` (Pure obsidian substrate)
- **Container Level 1 (`surface-1`):** `#14161F` (Card beds, timeline backdrops)
- **Container Level 2 (`surface-2`):** `#1C1F2B` (Elevated controls, active segment chips)
- **Container Level 3 (`surface-3`):** `#25293A` (Dividers, borders, deactivated sliders)

### Contrast & State Rules
- Critical workout metrics use pure white (`#FFFFFF`) against `#0C0D12` for a 19.5:1 contrast ratio.
- Diminished auxiliary metrics (units, field labels) use muted slate (`#8A91A8`), maintaining compliance above WCAG AA (4.5:1).
- Interactive states glow via translucent chromatic underlays (`rgba(16, 244, 156, 0.15)` for Electric Mint) instead of skeuomorphic gradients.

## Typography

The typographic hierarchy accommodates two vastly different scenarios: high-motion glanceability during peak cardiac stress, and clean, analytical review post-workout.

- **Display & Telemetry:** Space Grotesk provides a technical, athletic aesthetic with rigid geometric balance and distinctive letterforms. Tabular numerics (`font-variant-numeric: tabular-nums`) must be enabled on all numerical representations to prevent mechanical layout shifting as timers tick down and BPM fluctuates.
- **Body & Secondary Copy:** Inter provides uncompromising legibility at small sizes, acting as an unobtrusive, utilitarian partner to Space Grotesk.
- **Distance & Glanceability:** Timers, current interval countdowns, and speed/incline indicators use `display-xl` (or `display-xl-mobile`), maintaining visual clarity at an arm's distance of up to 1 meter while bouncing on a treadmill.
- **Labels & Units:** Metric units (MPH, KM/H, BPM, KCAL, INCLINE) use uppercase `label-md` or `label-sm` with widened letter-spacing (+0.08em to +0.1em) positioned immediately adjacent or subordinated below the primary metric.

## Layout & Spacing

Workouts occur within dynamic, shaking environments. Layouts rely on a strictly partitioned fluid vertical stack with minimum gutter thresholds.

### Grid & Ergonomic Partitioning
- **Mobile Handheld / Treadmill Console Tray (360px - 599px):** 4-column layout with 20px (`1.25rem`) screen margins. Critical telemetry occupies the upper 60% of the viewport (the optimal glance zone); tactile input actions reside within the lower 40% (the thumb reach zone).
- **Tablet / Mounted Bracket (600px - 1024px):** 8-column layout with split-screen orientation. Left pane houses active interval timer and telemetry circles; right pane displays the segmented elevation/speed route profile and playlist controls.
- **Desktop / Web Dashboard (1025px+):** 12-column layout capped at 1280px max-width, prioritizing trend analytics, metabolic zones, and historical progress.

### Spacing Principles
- All interactive triggers enforce a hard physical separation of at least `space-md` (16px) to eliminate accidental tap misfires when moving.
- Cards maintain internal air using `space-lg` (24px) padding, creating a distinct visual boundary between distinct workout metrics.

## Elevation & Depth

To avoid muddy visual performance on high-brightness OLED screens, the system avoids standard soft diffuse drop-shadows. Instead, depth is constructed via **Tonal Layering**, **Crisp High-Contrast Outlines**, and **Biometric Glows**.

### Surface Hierarchy
1. **Canvas (`#0C0D12`):** Base layer for overall screen context.
2. **Resting Containers (`#14161F`):** Standard telemetry cards, wrapped with a 1px border of `#1C1F2B`.
3. **Elevated & Focused Elements (`#1C1F2B`):** Current active interval card or floating playback tray, bordered with 1px `#25293A`.

### Biometric Lighting
Active states project energetic chromatic light fields:
- **Active Interval Highlight:** 1px border matched to the current phase (e.g., `#10F49C` for Sprint), coupled with an ambient outer glow: `box-shadow: 0 0 24px -4px rgba(16, 244, 156, 0.25)`.
- **Card Separators:** Crisp, sub-pixel or 1px hairline rules without drop shadows keep interfaces razor-sharp during physical bounce.
- **Modals & Overlays:** `#0C0D12` at 85% opacity with a `16px` backdrop-blur filter to isolate pause screens and mid-run emergency controls without losing workout context.

## Shapes

The design uses a calculated curvature scale (`roundedness: 2`) that balances high-tech precision with athletic ergonomics:

- **Cards & Data Modules:** Standardized to `rounded-lg` (16px / `1rem`), providing a contained cockpit aesthetic.
- **Controls & Tactical Buttons:** Use `rounded-lg` (16px) for massive block buttons or full pill radii (`rounded-full` / 9999px) for floating quick-adjust circular increment buttons (`+`, `-`, jump to speed).
- **Interval Bar Segments:** 4px radius on segment caps, preserving structural cadence when grouped closely together.
- **Avatars & Biometric Rings:** Strict circles (`rounded-full`) reinforcing circular dial instruments found on analog stopwatches and cardiac monitors.

## Components

### 1. Primary Action & Tactical Buttons
- **Touch Geometry:** Minimum height of **60px** (exceeding standard 48px to accommodate unstable hands and sweaty fingers). Full-width (`w-full`) for main run controls.
- **Pause / Emergency Stop:** High-visibility, tactile buttons. The primary "Pause" button features a heavy `#14161F` fill, 1.5px border of `#25293A`, and bold Space Grotesk labeling.
- **State Affirmation:** Instant visual inversion on tap (0ms delay), swapping fill to full-color with zero layout shift.

### 2. Segmented Interval Progress Bar
- Continuous timeline composed of rhythmic vertical pills or horizontal segment blocks, color-coded precisely by activity zone:
  - Walk: High-Octane Cyan
  - Jog: Radiant Amber
  - Sprint: Vivid Crimson
- **Current Position:** Indicated by an expanded segment pulsating with an outer glow, accompanied by an overhead down-tick indicator. Completed intervals drop to 30% alpha.

### 3. Biometric Telemetry Cards
- Dark obsidian base (`#14161F`) with a 1px `#1C1F2B` stroke.
- **Metric Pairing:** Massive primary tabular value (e.g., `168`) in Space Grotesk, paired with a small uppercase label (`BPM`) in muted slate.
- **Micro-Graph:** Embedded sparklines or ring gauges with 4px stroke widths, using gradient fills fading into `#14161F`.

### 4. Direct Speed & Incline Steppers
- Oversized circular or square tap surfaces (minimum 58x58px).
- Large central numerical targets with clear increment/decrement triggers, allowing rapid speed adjustments (e.g., `+0.5` or preset jump pills: `3.0`, `6.0`, `9.0`, `11.0`).

### 5. Chips & Filters
- **Resting:** Pill-shaped, background `#14161F`, border 1px `#25293A`, text color `#8A91A8`.
- **Selected:** Background `rgba(16, 244, 156, 0.12)`, border 1px `#10F49C`, text `#10F49C`.

### 6. Iconography
- Custom vector iconography featuring bold 2px uniform strokes, sharp geometry, and angled joints (15-degree athletic tilt).
- Dedicated silhouettes for gait movement: Walk (stride length compact, vertical spine), Jog (moderate lean, rhythmic flex), Sprint (steep forward angle, high knee drive). Never use generic emojis.