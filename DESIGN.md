---
name: "Afterglow"
description: "Library wayfinding for a shared household touchscreen."
colors:
  primary: "hsl(156.7 33.8% 31.4%)"
  primary-foreground: "hsl(0.0 0.0% 100.0%)"
  background: "hsl(130.0 14.3% 91.8%)"
  foreground: "hsl(169.3 30.4% 18.0%)"
  card: "hsl(72.0 26.3% 96.3%)"
  popover: "hsl(75.0 40.0% 98.0%)"
  secondary: "hsl(126.0 16.7% 88.2%)"
  muted: "hsl(112.5 14.8% 89.4%)"
  muted-foreground: "hsl(152.7 11.7% 36.9%)"
  accent: "hsl(133.8 22.8% 88.8%)"
  accent-foreground: "hsl(153.7 35.7% 22.5%)"
  border: "hsl(128.6 11.5% 76.1%)"
  input: "hsl(137.1 9.9% 58.2%)"
  destructive: "hsl(0.0 56.1% 44.7%)"
  destructive-foreground: "hsl(0.0 0.0% 100.0%)"
  warning: "hsl(36.6 89.8% 26.9%)"
  warning-foreground: "hsl(0.0 0.0% 100.0%)"
  success: "hsl(145.0 43.5% 27.1%)"
  success-foreground: "hsl(0.0 0.0% 100.0%)"
  info: "hsl(206.3 57.6% 33.3%)"
  info-foreground: "hsl(0.0 0.0% 100.0%)"
  nav-background: "hsl(164 35% 9%)"
  nav-border: "hsl(164 35% 9%)"
  nav-foreground: "hsl(130 25% 94%)"
  nav-muted: "hsl(142 17% 76%)"
  nav-active: "hsl(143 25% 78%)"
  dark-nav-border: "hsl(143 17% 50%)"
  dark-nav-active: "hsl(143 25% 65%)"
  dark-primary: "hsl(143.6 25.0% 78.0%)"
  dark-primary-foreground: "hsl(155.3 42.5% 15.7%)"
  dark-background: "hsl(167.0 36.5% 12.4%)"
  dark-foreground: "hsl(96.0 29.4% 93.3%)"
  dark-card: "hsl(165.0 30.4% 18.0%)"
  dark-popover: "hsl(161.4 28.7% 19.8%)"
  dark-secondary: "hsl(155.6 26.7% 23.5%)"
  dark-muted: "hsl(157.2 26.1% 21.8%)"
  dark-muted-foreground: "hsl(137.6 13.6% 75.5%)"
  dark-accent: "hsl(143.6 24.8% 26.1%)"
  dark-accent-foreground: "hsl(129.5 30.2% 87.6%)"
  dark-border: "hsl(145.7 16.9% 32.5%)"
  dark-input: "hsl(140.0 11.3% 46.9%)"
  dark-destructive: "hsl(5.5 78.4% 78.2%)"
  dark-destructive-foreground: "hsl(2.7 50.6% 17.5%)"
  dark-warning: "hsl(38.7 75.3% 71.4%)"
  dark-warning-foreground: "hsl(40.0 61.6% 14.3%)"
  dark-success: "hsl(128.2 36.1% 76.1%)"
  dark-success-foreground: "hsl(137.8 42.5% 17.1%)"
  dark-info: "hsl(202.9 57.6% 76.9%)"
  dark-info-foreground: "hsl(202.0 49.5% 19.4%)"
typography:
  display:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "6rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-.03em"
  headline:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontFamily: "Public Sans, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.02em"
  body:
    fontFamily: "Public Sans, sans-serif"
    fontSize: ".9375rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Public Sans, sans-serif"
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
rounded:
  sm: "calc(.75rem - 4px)"
  md: "calc(.75rem - 2px)"
  lg: ".75rem"
  field: "10px"
  event: "8px"
  panel: "14px"
  dock: "16px"
  pill: "50px"
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
    rounded: "{rounded.md}"
    padding: ".5rem 1rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: ".5rem 1rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: ".5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: ".5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: ".5rem 1rem"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
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

**Creative North Star: "Library wayfinding"**

Library wayfinding gives Afterglow a calm, legible system for shared household tasks. Green-gray ground, near-white work surfaces and dark green ink make content easy to scan. Deep evergreen navigation supplies a stable point of orientation.

The interface uses aligned rows, clear dividers and restrained corners. Public Sans carries headings, controls and readings with consistent letterforms. Density changes with the available space; touch actions, readable labels and explicit states remain visible.

**Key Characteristics:**

- Tonal surfaces and evergreen wayfinding.
- A single self-hosted sans family with a clear size hierarchy.
- Aligned schedules, divided lists and visible current location.
- Responsive density with generous portrait touch controls.

This records the built system in [src/index.css](src/index.css), [src/afterglow.css](src/afterglow.css), the shared shell and UI components. The source uses Tailwind v4 theme mappings in CSS. The YAML values describe the default light theme; tokens prefixed with `dark-` record the matching dark overrides. The sidecar extends these tokens with states, motion and framework-free previews.

## Colors

The palette stays close to green: pale ground and work surfaces, evergreen text and actions, and a dark green navigation dock.

### Primary

- **Evergreen action** (`primary`): primary buttons, links, selected filters, current-day emphasis and focus.
- **Navigation evergreen** (`nav-background`): the fixed main navigation. **Pale sage selection** (`nav-active`) marks the current route; `nav-muted` and `nav-foreground` distinguish resting and hovered links.
- **Dark-theme sage** (`dark-primary`): the lighter action color used over evergreen surfaces.

### Neutral

- **Green-gray ground** (`background`) sits behind **near-white work surfaces** (`card`) and the slightly brighter `popover` layer.
- **Dark green ink** (`foreground`) carries task content. `muted-foreground` is reserved for supporting text.
- `secondary`, `muted` and `accent` are related green tints for secondary controls and selected or hovered surfaces. `border` divides groups; `input` gives editable controls a stronger edge.
- The `dark-` counterparts retain these roles over deep evergreen ground. Navigation colors remain shared between themes.

### Status and assignment

`destructive` and `warning` provide red and amber feedback; `success` and `info` provide green and blue feedback. Each has its own foreground token. People use their configured color as a runtime value, repeated in avatars and softly tinted event borders; person colors are not brand primitives. Existing safety, online and pending roles reuse the corresponding semantic status colors in the CSS.

**The Meaning Before Color Rule.** Pair selected, offline, loading, error and completion colors with text, icons or semantic state; color is never the only cue.

## Typography

**Display and body font:** Public Sans, with a generic sans-serif fallback. Normal weights (400–700) are self-hosted as Latin and Latin Extended WOFF2 files in `public/fonts`, with `font-display: swap` and the bundled OFL license. No external font request is required.

The frontmatter records the base roles: display for the clock; headline for page titles; title for panel headings; body for supporting copy; label for compact controls. The scale is purpose-based, not a fixed mathematical ratio. Body text is usually regular, controls medium, and panel headings semibold. Times and primary numerical readings use tabular numerals. Page descriptions stop at a readable measure (65ch).

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
| Width ≤699px | Gutters and panels use 1rem; the board and primary grids stack; navigation fills the bottom edge with icons above labels. |

The weekly grid uses horizontal overflow when necessary, with a sticky person column. Its usual minimum width is (840px), reduced to (760px) in wide landscape and removed for the large portrait layout. Multi-day events remain aligned across dates. Content below the viewport stays reachable by scrolling.

The navigation dock reserves bottom space through app padding and safe-area insets. Its links are at least (56px) high by default, (72px) on the large portrait display and (64px) on phones. Recurring action controls use a (48px) minimum where explicitly styled; portrait event and list rows reach (64px). Compact mode reduces panel gaps and padding while retaining usable control targets. Verified viewport captures cover (1440 × 2560), (1440 × 900) and (390 × 844); physical touchscreen use still needs device validation.

## Elevation & Depth

Recurring work panels are flat, with a pale fill and thin green-gray border. The dock is an opaque evergreen surface. Dividers and tint do most of the grouping work. Dialogs and popovers remain separate foreground layers; the CSS also retains three soft shadow tokens for existing elevated primitives, recorded in the sidecar. Their availability does not make shadows the default treatment for new panels.

**The Flat Work Surface Rule.** Keep recurring work panels flat. Use borders, tonal changes and spacing to separate content; reserve elevation for overlays.

## Shapes

Use the existing soft rectangular shapes: work panels (14px), navigation dock (16px), editable fields (10px) and calendar events (8px). Shared component radii derive from the CSS base radius (.75rem); the smaller variants subtract (2px) and (4px). Avatars and icon-button hit areas are circular, while filter chips use a fully rounded silhouette (50px). Borders are normally thin (1px), with opacity separating major boundaries from row dividers.

## Components

### Buttons

Clear labels and restrained filled, outlined or text treatments. Reuse the shared Button variants: primary, destructive, outline, secondary, ghost and link. Default padding and shape are tokenized above. The component's minimum height is (2.75rem), with larger touch minima on the named task controls. Hover changes color or underlines a link; focus uses a visible ring with offset; disabled actions remove pointer interaction and reduce opacity. Icon-only actions require an accessible label.

### Inputs and fields

Planner fields use the ground color, a stronger input border, modest corners and a minimum height (48px). Labels sit above the field. Primary-colored caret and visible focus remain consistent with other controls. Optional details can expand; form actions stay reachable in a scrollable dialog. Validation and failed-write messages stay beside the operation, with the draft preserved.

### Chips and segmented controls

Person and device filters use outlined pills; selected filters switch to the primary fill and foreground. Calendar segments use a shared outlined container, softly tinted selection and a subtle inset edge. Pressed state is exposed semantically. Labels remain understandable without the tint.

### Cards and containers

Work panels use the card fill, a border at reduced opacity and panel spacing from the shared shell. Panel headings align titles with actions and wrap when needed. Repeated favorite devices use dividers within a shared panel rather than another nested card around each control.

### Navigation

The main dock has five labeled destinations, with `aria-current` for the active route. A deep evergreen fill separates navigation from the content beneath it; dark mode adds a thin sage outline and a quieter sage selection. The selected destination reverses the dock contrast. The large portrait layout emphasizes generous horizontal links. Phones stack icons above captions inside a full-width dock. Smart-home navigation is a wrapping secondary row; less frequent destinations live in the labeled menu. Focus uses the contrasting selection color.

### Schedules, lists and controls

The weekly grid aligns people and dates, marks the current day, and supports continuous multi-day events. Events wrap long titles and use the configured person tint at low opacity. Lists pair a separate completion target with a full-width edit target; completion adds a check and a strikethrough before the row moves. Timetables retain their aspect ratio and open into a larger pageable view. Home controls show only supported capabilities, with pending and unavailable feedback.

Each list has a filled, labeled plus button with a 56px minimum touch target. Its header and inline entry form stay visible while scrolling within that list, keeping the destination clear on boards with several lists. Fields have persistent labels; failed saves and cancellation preserve the draft. The Lists page opens Shopping by default, while direct links retain their selected tab.

Motion is tied to these state changes: the completion check draws over (200ms), and list reflow lasts up to (480ms). Reduced-motion settings remove animation. Do not add motion to imply a device command succeeded before the state confirms it.

## Do's and Don'ts

### Do:

- **Do** reuse semantic CSS colors so the dark theme follows the same roles.
- **Do** keep the portrait reading scale and large list, event and navigation targets.
- **Do** preserve visible focus, text wrapping, scrollable overflow and safe-area clearance.
- **Do** show unavailable, pending and empty states distinctly.
- **Do** keep examples fictional and household data outside committed design assets.

### Don't:

- **Don't** shrink or hide task content to force a tall screen into one viewport.
- **Don't** encode a person, device state or selected route through color alone.
- **Don't** add decorative headings, gradients or elevation to the recurring work panels.
- **Don't** turn a timetable preview into a cropped substitute for the full, pageable view.
