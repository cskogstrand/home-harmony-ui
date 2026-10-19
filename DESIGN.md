---
name: "Afterglow"
description: "Liquid Glass inspired controls over a readable shared household board."
colors:
  primary: "hsl(213 92% 39%)"
  primary-foreground: "hsl(0 0% 100%)"
  background: "hsl(218 32% 95%)"
  foreground: "hsl(218 30% 16%)"
  card: "hsl(0 0% 100%)"
  popover: "hsl(218 35% 98%)"
  secondary: "hsl(216 25% 91%)"
  muted: "hsl(216 22% 92%)"
  muted-foreground: "hsl(218 14% 40%)"
  accent: "hsl(212 65% 92%)"
  accent-foreground: "hsl(213 92% 32%)"
  border: "hsl(216 20% 82%)"
  input: "hsl(217 16% 55%)"
  destructive: "hsl(0.0 56.1% 44.7%)"
  destructive-foreground: "hsl(0.0 0.0% 100.0%)"
  warning: "hsl(36.6 89.8% 26.9%)"
  warning-foreground: "hsl(0.0 0.0% 100.0%)"
  success: "hsl(145.0 43.5% 27.1%)"
  success-foreground: "hsl(0.0 0.0% 100.0%)"
  info: "hsl(206.3 57.6% 33.3%)"
  info-foreground: "hsl(0.0 0.0% 100.0%)"
  nav-background: "hsl(216 35% 98%)"
  nav-border: "hsl(0 0% 100%)"
  nav-foreground: "hsl(218 30% 16%)"
  nav-muted: "hsl(218 17% 36%)"
  nav-active: "hsl(213 92% 39%)"
  dark-nav-border: "hsl(215 28% 64%)"
  dark-nav-active: "hsl(211 100% 75%)"
  dark-primary: "hsl(211 100% 75%)"
  dark-primary-foreground: "hsl(219 60% 16%)"
  dark-background: "hsl(222 30% 9%)"
  dark-foreground: "hsl(216 30% 95%)"
  dark-card: "hsl(221 23% 14%)"
  dark-popover: "hsl(220 22% 17%)"
  dark-secondary: "hsl(220 22% 22%)"
  dark-muted: "hsl(220 22% 19%)"
  dark-muted-foreground: "hsl(217 17% 73%)"
  dark-accent: "hsl(216 40% 25%)"
  dark-accent-foreground: "hsl(211 100% 82%)"
  dark-border: "hsl(220 18% 29%)"
  dark-input: "hsl(217 16% 47%)"
  dark-destructive: "hsl(5.5 78.4% 78.2%)"
  dark-destructive-foreground: "hsl(2.7 50.6% 17.5%)"
  dark-warning: "hsl(38.7 75.3% 71.4%)"
  dark-warning-foreground: "hsl(40.0 61.6% 14.3%)"
  dark-success: "hsl(128.2 36.1% 76.1%)"
  dark-success-foreground: "hsl(137.8 42.5% 17.1%)"
  dark-info: "hsl(202.9 57.6% 76.9%)"
  dark-info-foreground: "hsl(202.0 49.5% 19.4%)"
  dark-nav-background: "hsl(220 25% 16%)"
  dark-nav-foreground: "hsl(216 30% 95%)"
  dark-nav-muted: "hsl(217 20% 80%)"
  glass-highlight: "hsl(0 0% 100% / .95)"
  dark-glass-highlight: "hsl(210 40% 88% / .23)"
  glass-shade: "hsl(218 38% 26% / .12)"
  dark-glass-shade: "hsl(224 60% 3% / .45)"
  ambient-blue: "hsl(209 75% 85% / .55)"
  dark-ambient-blue: "hsl(214 65% 24% / .5)"
  ambient-warm: "hsl(28 80% 89% / .48)"
  dark-ambient-warm: "hsl(264 35% 20% / .32)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Public Sans\", sans-serif"
    fontSize: "6rem"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-.04em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Public Sans\", sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Public Sans\", sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Public Sans\", sans-serif"
    fontSize: ".9375rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Public Sans\", sans-serif"
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
rounded:
  sm: "calc(1rem - 4px)"
  md: "calc(1rem - 2px)"
  lg: "1rem"
  field: "14px"
  event: "8px"
  panel: "24px"
  dock: "999px"
  pill: "50px"
  capsule: "999px"
  menu: "22px"
  dialog: "28px"
  phoneDock: "34px"
  phoneDestination: "27px"
spacing:
  small: ".5rem"
  medium: "1rem"
  panel: "1.5rem"
  page: "2rem"
  portraitPage: "2.8rem"
  portraitPanel: "1.2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: ".5rem 1rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: ".5rem 1rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: ".5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: ".5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: ".5rem 1rem"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: ".5rem 1rem"
  field-planner:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
  navigation:
    backgroundColor: "{colors.nav-background}"
    textColor: "{colors.nav-muted}"
    rounded: "{rounded.dock}"
    padding: ".5rem"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "6px 17px"
  work-panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
---

# Design System: Afterglow

## Overview

**Creative North Star: "Liquid Glass household board"**

Liquid Glass inspired controls float over a readable household board. Cool pearl ground, white work surfaces and blue actions keep the light theme crisp; midnight ground and pale blue actions carry the same hierarchy in dark mode. A softly illuminated rim and restrained shadow distinguish navigation from the content underneath.

The interface retains aligned rows, clear dividers and opaque reading surfaces. Apple system typography leads the existing font stack, with self-hosted Public Sans as the fallback. Density changes with the available space; touch actions, readable labels and explicit states remain visible.

**Key Characteristics:**

- Pearl and midnight grounds with blue actions.
- Glass navigation, header controls and transient menus over opaque content.
- System typography, rounded capsules and a clear reading hierarchy.
- Responsive density, generous portrait touch controls and solid accessibility fallbacks.

This records the built system in [src/index.css](src/index.css), [src/afterglow.css](src/afterglow.css), the shared shell and UI components. The source uses Tailwind v4 theme mappings in CSS. YAML values describe the default light theme; tokens prefixed with `dark-` record matching dark overrides. The sidecar extends these tokens with states, motion and framework-free previews.

The experiment follows the separation of controls and content described in [Apple's Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) and [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/). The web implementation approximates that material with CSS translucency, blur, highlights and shadows. It does not reproduce native lensing, optical refraction or automatic background-driven material adaptation.

## Colors

The palette uses cool neutrals with a blue action color. Ambient blue and warm tints soften the app ground without tinting the reading panels.

### Primary

- **Action blue** (`primary`): primary buttons, links, selected filters, current-day emphasis and focus.
- **Navigation blue** (`nav-active`): the active route's text and translucent selection fill; `nav-muted` and `nav-foreground` distinguish resting and hovered links.
- **Dark-theme sky blue** (`dark-primary`): the lighter action color used over midnight surfaces, with a dark foreground on filled buttons.

### Neutral

- **Pearl ground** (`background`) sits behind **white work surfaces** (`card`) and the cool `popover` layer.
- **Blue-black ink** (`foreground`) carries task content; `muted-foreground` is for supporting text.
- `secondary`, `muted` and `accent` are cool tints for secondary controls and selected or hovered surfaces. `border` divides groups; `input` gives editable controls a stronger edge.
- `nav-background` and `nav-border` define the glass control layer's fill and rim. `glass-highlight` and `glass-shade` provide its light and shade; `ambient-blue` and `ambient-warm` belong to the app ground.
- The `dark-` counterparts preserve the same roles over midnight ground. Dark navigation has its own fill, ink, rim and highlight values.

### Status and assignment

`destructive` and `warning` provide red and amber feedback; `success` and `info` provide green and blue feedback. Each has its own foreground token. People use their configured color as a runtime value, repeated in avatars and softly tinted event borders; person colors are not brand primitives. Existing safety, online and pending roles reuse the corresponding semantic status colors in the CSS.

**The Meaning Before Color Rule.** Pair selected, offline, loading, error and completion colors with text, icons or semantic state; color is never the only cue.

## Typography

**Display and body font:** the shared `--font-ui` stack selects `-apple-system`, then `BlinkMacSystemFont`, self-hosted Public Sans and generic sans-serif. This gives Apple platforms their system typography while preserving the bundled fallback elsewhere. Public Sans normal weights (400–700), Latin and Latin Extended WOFF2 files, `font-display: swap` and the OFL license remain in `public/fonts`; no external font request is required.

The frontmatter records the base roles: the light-weight display clock; semibold page headlines; panel titles; regular supporting copy; and medium compact labels. Greeting headlines use a slightly tighter line height (1.2). Times and primary numerical readings use tabular numerals. Page descriptions stop at a readable measure (65ch).

For the large portrait display, the root grows to (20px), the clock uses (5rem), the greeting (2.2rem), panel headings (1.4rem), list labels (1.1rem), event titles (1rem), and supporting event times (.9rem). This yields readable content around (18–28px). At phone width, the clock uses (3.25rem), greeting (1.5rem) and page title (1.8rem). Small navigation captions are an exception to the content scale; their full links remain large touch areas.

**The Read Before Decoration Rule.** Use the existing sentence-case heading hierarchy and concise action labels. Give content the strongest typographic emphasis.

## Layout

The shared header, main content and footer are centered within a maximum width (1600px). Default page gutters and panel padding use the frontmatter spacing tokens. The main board has two equal flexible columns; major sections span both. Reusable forms, rows and toolbars wrap instead of relying on fixed content widths.

| Context | Built behavior |
| --- | --- |
| Large portrait: width ≥1000px, height ≥1400px, portrait | Root type grows to 20px; page gutters use 2.8rem and panel padding 1.2rem; board gap is 1rem; favorites use four columns. |
| Wide landscape: width ≥1100px, landscape | Board uses six tracks; the week spans four and lists two. |
| Width ≤999px | Gutters reduce to 1.5rem; school cards stack and device/favorite grids use two columns. |
| Width ≤800px | Device rows put controls below the title and retain readable metadata. |
| Width ≤699px | Gutters and panels use 1rem; the board and primary grids stack; navigation floats within .75rem side margins, with icons above labels. |

The weekly grid uses horizontal overflow when necessary, with a sticky person column. Its usual minimum width is (840px), reduced to (760px) in wide landscape and removed for the large portrait layout. Multi-day events remain aligned across dates. Content below the viewport stays reachable by scrolling.

The dock is centered within the page gutters, capped at (1000px), or (1328px) on large portrait screens. Its bottom margin is (1rem) plus the safe-area inset; phones use (.75rem) plus the inset. App bottom padding reserves (8rem) plus the inset, reduced to (7rem) on phones. Links are at least (56px) high by default, (72px) on large portrait displays and (64px) on phones. Recurring action controls use a (48px) minimum where explicitly styled; portrait event and list rows reach (64px). Compact mode reduces panel gaps and padding while retaining usable control targets.

Synthetic-data captures in `.impeccable/review/liquid-glass/` cover desktop, phone, portrait, dark mode, menus and dialogs. They support visual review; physical touchscreen and target-device performance still need device validation.

## Elevation & Depth

Opaque work panels use a thin cool border and tonal separation. Glass adds depth only to the floating dock, home selector, settings control and dropdown menus. Its base is a solid navigation fill with a diagonal highlight, inset upper and lower edges, and a soft outer shadow. Header controls use a smaller outer shadow than the dock.

Within `@supports`, backdrop filtering adds blur (24px) and saturation (1.45), with fill opacity (.76) in light mode and (.82) in dark mode. Browsers without that support retain the solid fill. Reduced transparency and increased contrast use opaque fills, remove blur and the highlight gradient, strengthen the border, and flatten the ambient ground; header controls retain their shallow shadow. Forced colors use system Canvas and ButtonText without blur; the current dock route and selected segments gain a Highlight outline.

The sidecar records the three soft elevation tokens plus glass, header and selection shadows. Dialogs remain opaque foreground surfaces; their rounded corners do not make them glass.

**The Glass Control Layer Rule.** Reserve glass for the main dock, header controls and transient menus. Keep schedules, lists, forms and recurring work panels opaque.

## Shapes

The system pairs rounded work panels with capsule controls. Work panels use the `panel` radius, planner fields the `field` radius, transient menus the `menu` radius and standard dialogs the `dialog` radius. Shared component radii derive from the CSS base radius (1rem); smaller variants subtract (2px) and (4px). Calendar events retain tighter corners for aligned rows.

Shared buttons, the desktop dock, its destinations and segmented controls use full capsules. Phone navigation uses the smaller `phoneDock` and `phoneDestination` radii so the two-line controls nest within the outer shape. Header icon controls and avatars remain circular. Borders are normally thin (1px), with opacity separating major boundaries from row dividers.

## Components

### Buttons

Clear labels in rounded capsules. Reuse the shared Button variants: primary, destructive, outline, secondary, ghost and link. Default padding and shape are tokenized above. The component's minimum height is (2.75rem), with larger touch minima on named task controls. Hover changes color or underlines a link; focus uses a visible ring with offset; disabled actions remove pointer interaction and reduce opacity. Icon-only actions require an accessible label.

### Inputs and fields

Planner fields use an opaque ground fill, a stronger input border and a minimum height (48px). Labels sit above the field. Primary-colored caret and visible focus remain consistent with other controls. Optional details can expand; form actions stay reachable in a scrollable dialog. Validation and failed-write messages stay beside the operation, with the draft preserved.

### Chips and segmented controls

Person and device filters use outlined pills; selected filters switch to the primary fill and foreground. Calendar segments and list tabs use a shared capsule container; selected segments use an opaque card fill and the soft `home-shadow-sm` shadow. Pressed state is exposed semantically. Labels remain understandable without color.

### Cards and containers

Work panels use the opaque card fill, a border at reduced opacity and panel spacing from the shared shell. Panel headings align titles with actions and wrap when needed. Repeated favorite devices use dividers within a shared panel rather than another nested card around each control.

### Navigation and transient menus

The main glass dock has five labeled destinations, with `aria-current` for the active route. The selected destination uses navigation blue over a (12%) tint, with a restrained highlight and shadow. The large portrait layout emphasizes generous horizontal links. Phones stack icons above captions inside an inset floating dock. Focus uses the navigation selection color. Smart-home navigation is a wrapping secondary row; less frequent destinations live in the labeled menu.

The home selector and settings button share the glass material. Dropdown menus use the same material with an inset margin (.5rem); menu rows have soft corners (14px), at least (48px) height and visible focus. Regular dialogs retain opaque surfaces and reachable close actions. Reduced-transparency, contrast and forced-colors preferences apply to the shared material, including nested dropdowns.

### Schedules, lists and controls

The weekly grid aligns people and dates, marks the current day, and supports continuous multi-day events. Events wrap long titles and use the configured person tint at low opacity. Lists pair a separate completion target with a full-width edit target; completion adds a check and a strikethrough before the row moves. Timetables retain their aspect ratio and open into a larger pageable view. Home controls show only supported capabilities, with pending and unavailable feedback.

Each list has a filled, labeled plus button with a 56px minimum touch target. Its header and inline entry form stay visible while scrolling within that list, keeping the destination clear on boards with several lists. Fields have persistent labels; failed saves and cancellation preserve the draft. The Lists page opens Shopping by default, while direct links retain their selected tab.

Motion confirms pointer actions: controls press over 120ms, switches move over 160ms, menus open from their trigger over 180ms, and centered dialogs open and close over 240ms. List composers fade in over 160ms; confirmed additions and list reflow take up to 240ms, with a 200ms completion check. Suggestion selection shows pending feedback until the update finishes. Keyboard actions stay immediate. Reduced-motion settings replace overlay movement with a 160ms fade and remove list movement. Do not add motion to imply a device command succeeded before the state confirms it.


## Do's and Don'ts

### Do:

- **Do** reuse semantic CSS colors so the dark theme follows the same roles.
- **Do** keep the portrait reading scale and large list, event and navigation targets.
- **Do** preserve visible focus, text wrapping, scrollable overflow and safe-area clearance.
- **Do** provide solid surfaces for reduced transparency, increased contrast and unavailable backdrop filtering.
- **Do** show unavailable, pending and empty states distinctly.
- **Do** keep examples fictional and household data outside committed design assets.

### Don't:

- **Don't** shrink or hide task content to force a tall screen into one viewport.
- **Don't** encode a person, device state or selected route through color alone.
- **Don't** spread glass, decorative gradients or elevation into recurring work panels.
- **Don't** turn a timetable preview into a cropped substitute for the full, pageable view.
- **Don't** describe CSS blur and specular edges as native optical refraction.
