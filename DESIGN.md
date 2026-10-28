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
  glass-highlight: "hsl(0 0% 100% / .65)"
  dark-glass-highlight: "hsl(210 40% 88% / .12)"
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

The iOS 27 refinement follows [Apple's readability and contrast updates](https://www.apple.com/os/ios/): quieter rims, stable selection fills and denser text menus. The web app cannot inherit the native Liquid Glass tint slider. It retains the bottom dock for shared wall-display reach instead of adopting iPadOS's native top tab bar.

## Colors

The palette uses cool neutrals with a blue action color. Ambient blue and warm tints soften the app ground without tinting the reading panels.

### User-selectable palettes

Settings → Appearance offers **Pearl** (the default blue), **Sage** (muted green), **Sand** (warm earth), **Dusk** (soft violet), **Mist** (soft blue-gray), **Rose** (dusty pink), **Olive** (earthy yellow-green), **Clay** (muted terracotta), **Lavender** (blue-violet), **Seafoam** (soft teal), **Honey** (warm ochre), and **Slate** (cool gray). Each has an independent light and dark treatment, selected with the existing dark-mode switch. The palette remaps global surface, ink, action, focus, navigation, ambient and shadow tokens through `data-color-palette` on the document root. Semantic status colors and person assignments retain their meaning.

The labeled radio choices show the current mode's actual background, card and primary tokens. Selection and keyboard focus have visible outlines. Choices form three rows of four on wider screens and wrap to two columns on phones. They use the existing shared settings, conflict recovery and backup flow; older settings default to Pearl.

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
| Width ≤999px | Gutters reduce to 1.5rem; school cards stack and device/favorite grids use two columns. Dock icons sit above 12px captions, aligned even when labels wrap. |
| Width ≤800px | Device rows put controls below the title and retain readable metadata. |
| Width ≤699px | Gutters and panels use 1rem; the board and primary grids stack; navigation floats within .75rem side margins, with icons above labels. |

The weekly grid uses horizontal overflow when necessary, with a sticky person column. Its usual minimum width is (840px), reduced to (760px) in wide landscape and removed for the large portrait layout. Multi-day events remain aligned across dates. Content below the viewport stays reachable by scrolling.

Calendar timetables use five equal weekday columns. At a container width of (620px) or less, days stack with dates beside their events in flexible one-to-two columns. Full-width messages remain beneath the week.

The dock is centered within the page gutters, capped at (1000px), or (1328px) on large portrait screens. Its bottom margin is (1rem) plus the safe-area inset; phones use (.75rem) plus the inset. App bottom padding reserves (8rem) plus the inset, reduced to (7rem) on phones. Links are at least (56px) high by default, (72px) on large portrait displays and (64px) on phones. Recurring action controls use a (48px) minimum where explicitly styled; portrait event and list rows reach (64px). Compact mode reduces panel gaps and padding while retaining usable control targets.

The shell respects top and side safe-area insets. The dock uses independent left/right safe gutters, and keyboard scroll padding includes the bottom inset. Phone form fields use 1rem text to avoid focus zoom at the default text size.

Synthetic-data captures in `.impeccable/review/liquid-glass/` cover desktop, phone, portrait, dark mode, menus and dialogs. They support visual review; physical touchscreen and target-device performance still need device validation.

## Elevation & Depth

Opaque work panels use a thin cool border and tonal separation. Glass adds depth to the floating dock, home selector, settings control, dropdown menus, popovers and dialogs. Its base is a solid navigation fill with restrained inset edges and a soft outer shadow. Header controls use a smaller outer shadow than the dock. Broad specular gradients are omitted to keep labels clear.

Within `@supports`, backdrop filtering adds blur (24px) and saturation (1.45), with fill opacity (.72) in light mode and (.78) in dark mode. Menus, popovers and dialogs use denser fills (.82 light, .86 dark), with secondary text using the stronger navigation ink. Modal backdrops dim the page with a black fill at (.35). Browsers without backdrop-filter support retain solid surfaces. Reduced transparency and increased contrast use opaque fills, remove blur and all glass shadows, strengthen the border, and flatten the ambient ground. Increased contrast also outlines selected navigation and segments. Forced colors use system Canvas and ButtonText without blur; the current dock route and selected segments gain a Highlight outline.

The sidecar records the three soft elevation tokens plus glass and header shadows. Navigation selection uses an opaque secondary fill without another glass layer or shadow. Dialog shells and action rows share one continuous glass surface. Form fields retain their opaque reading surfaces; long editor bodies scroll independently above the actions, without a separate footer fill or divider.

**The Glass Control Layer Rule.** Reserve glass for the main dock, header controls and transient menus, popovers and dialogs, with one local exception: calendar timetable frames reuse the shared panel glass on School, dashboard previews and the expanded view. Keep the regular calendar, lists, form fields and other recurring work panels opaque; saved image/PDF timetables retain their existing presentation.

### Reusable device cards

Smart home and `/device-gallery` share the device card library in `src/components/devices/`. `CardFrame` provides the glass surface, type icon, title, room, and three densities. `CardLayouts` contains light, climate, cover, power, security, media, fan, humidity, water heater, robot and valve layouts; `CardControls` supplies accessible actions, readings, ranges, choices and secondary-control disclosure. The media layout owns transport buttons and the placement of seeking, volume and extra controls so demo and live cards stay consistent. Transport controls share the full card width with space between actions. `card-designs.ts` maps Home Assistant domains and helper aliases to the library families. Unrecognized domains retain a named card and their reported state.

`SmartHomeCard` renders the chosen card type with a compatible main entity and connects it to the capability-aware `DeviceControl` and `DomainCardContent`. Each control requires its Home Assistant service and reported device capabilities. Climate uses the reported temperature range and step, with fan, preset, swing and humidity controls when supported. Super compact cards put secondary controls in the top-right popover, retaining the card's accent color. Live ranges preview a drag locally, send once on release, and return to reported state until confirmation arrives. Live controls preserve pending/error feedback, unavailable/offline behavior and confirmation for sensitive actions, including alarm codes. Domains without supported commands remain read-only.

Smart home settings starts with **Your cards**. **Add card** opens a searchable type catalogue, then a device selector above the main entity picker. The main and supporting pickers show only the selected device's entities; **Without a device** supports standalone sources. **Add entities from other devices** discloses a separate picker for optional readings, controls or images. Existing attachments survive device changes. Suggestions offer explicit add actions based on card type and reported same-device metadata, excluding readings already represented in the card. Source and appearance fields sit beside a clean production `SmartHomeCard` preview that reflects the draft name, entities and **Super compact** (default), **Compact**, or **Original** size. Phones stack the preview above the fields. Previews show live entity data, camera streams, images and artwork through the normal media components; device commands remain disabled and history stays hidden. Missing sources remain visible and replaceable. Changes stay in a local draft until saved, following shared-save/conflict handling and configuration backups.

The server stores an ordered `smartHome.layout` array. Each card has its own ID, chosen type, title, stable entity preference IDs, group and density, independently of global compact mode. Only explicitly saved cards appear; newly discovered entities never create cards. Retired visibility settings and inferred layouts are discarded without compatibility or density fallbacks. The separated **Danger zone** offers **Clear Smart home**, with a backup link and confirmation: it removes all Smart home cards, groups and scene cards while preserving Today’s favourites, other settings and Home Assistant entities.

**Configure** in Smart home’s settings cog exposes inline card size and group fields, drag handles, and move-earlier/later buttons. Cards can be reordered within or moved between named groups; room filters stay available, and moves preserve cards outside the active filter. A new group is saved once a card is assigned to it. Card previews are inert while editing, and **Done** returns to device controls. Within each rendered row of a multi-column grid, cards stretch to that row's tallest natural card height only when their own natural height is strictly greater than half that height. Shorter cards and single-column phone layouts keep natural height. Settings and controls support English and Norwegian Bokmål.

Live camera cards use the authenticated Home Assistant MJPEG stream with a labeled snapshot fallback; streams pause off-screen or in background tabs. Image entities provide maps or other reported images, and media players can show reported artwork through the same server-mediated media path. Camera and image previews open a dialog spanning the viewport width with 16px side gutters. The inline preview pauses while the dialog is open, avoiding a duplicate camera stream, and focus returns to the preview when it closes. Weather cards show reported conditions and subscribe only to supported forecast periods. Main sensor and air-quality cards fetch numeric history only when expanded, with 24-hour and seven-day choices. Details disclose allowlisted facts instead of arbitrary entity attributes. Loading, offline, unavailable and retry states remain explicit; gallery simulations never fill missing live data.

This is a scoped glass exception for Smart home cards and the gallery. Other recurring work panels retain the rules above. Cards stack on phones and adapt to dark mode; reduced motion, reduced transparency, increased contrast and forced colors retain accessible controls and solid surfaces. The gallery keeps fictional state while demonstrating these same components. Sources: [card layouts](src/components/devices/CardLayouts.tsx), [live card](src/components/devices/SmartHomeCard.tsx), [shared styles](src/components/devices/device-cards.css), [gallery](src/pages/DeviceGallery.tsx).

### Device detail

`/devices/:deviceId` uses the same glass controls in their original, spacious size. The device's primary functions lead: thermostat adjustment, light brightness, blind position, playback, security actions or camera imagery. Readings and status sit beside the controls on wide screens and below them on phones; sensor-only devices lead with readings. Divided reading rows emphasize localized values and units, with small history and info icons that expand inline. Battery level indicators use reported percentages only; explicit binary fault states use an alert icon and semantic color, while ordinary states remain neutral. Auxiliary switches follow a dedicated primary function. The header gear opens Settings, Diagnostics and About tabs. Settings use compact named controls; diagnostics separate timestamped readings from maintenance actions; About shows the reported manufacturer, model, software, room and integration. Per-entity info buttons reveal technical attributes. Battery, problem, tamper and safety readings remain on the main page. Entity links open the matching tab and focus its control. Technical attributes remain available per entity, and history loads only when opened. This surface preserves the existing capability checks, confirmations, offline feedback and English/Norwegian copy. Sources: [device page](src/pages/DeviceDetail.tsx), [layout](src/pages/device-detail.css).

## Shapes

The system pairs rounded work panels with capsule controls. Work panels use the `panel` radius, planner fields the `field` radius, transient menus the `menu` radius and standard dialogs the `dialog` radius. Shared component radii derive from the CSS base radius (1rem); smaller variants subtract (2px) and (4px). Calendar events retain tighter corners for aligned rows.

Shared buttons, the desktop dock, its destinations and segmented controls use full capsules. Phone navigation uses the smaller `phoneDock` and `phoneDestination` radii so the two-line controls nest within the outer shape. Header icon controls and avatars remain circular. Borders are normally thin (1px), with opacity separating major boundaries from row dividers.

Calendar timetable frames have rounded corners (22px), an inset (.5rem) and gaps (.375rem) around day surfaces with smaller corners (16px).

## Components

### Buttons

Clear labels in rounded capsules. Reuse the shared Button variants: primary, destructive, outline, secondary, ghost and link. Default padding and shape are tokenized above. The component's minimum height is (2.75rem), with larger touch minima on named task controls. Hover changes color or underlines a link; focus uses a visible ring with offset; disabled actions remove pointer interaction and reduce opacity. Icon-only actions require an accessible label.

### Inputs and fields

Planner fields use an opaque ground fill, a stronger input border and a minimum height (48px). Labels sit above the field. Primary-colored caret and visible focus remain consistent with other controls. Optional details can expand; planner and list editor bodies scroll within (48dvh), with actions outside the scrolling body. Standard dialogs share the favorites dialog’s (580px) maximum width, (12px) minimum side gutters and (20px) phone / (24px) desktop padding. The PIN dialog remains compact at (360px), and timetable previews retain their (1100px) maximum width. Headers reserve room for the close control and wrap long names. Validation and failed-write messages stay beside the operation, with the draft preserved.

### Chips and segmented controls

Person and device filters use outlined pills; selected filters switch to the primary fill and foreground. Calendar segments and list tabs use a shared capsule container; selected segments use an opaque card fill and the soft `home-shadow-sm` shadow. Pressed state is exposed semantically. Labels remain understandable without color.

### Cards and containers

Work panels use the opaque card fill, a border at reduced opacity and panel spacing from the shared shell. Panel headings align titles with actions and wrap when needed. Repeated favorite devices use dividers within a shared panel rather than another nested card around each control.

Section titles use `PanelTitle`: a fitting Lucide outline icon at 1.1em and stroke weight 1.8, followed by the existing heading text with a .6em gap. Icons inherit the palette's primary color without a badge, shadow or extra glass layer. They are decorative to assistive technology; the text retains the accessible name and heading level. `PanelHeading` requires an explicit icon and keeps its actions separate, wrapping when space is tight. Device type icons and person avatars remain the identity for their own cards. Dates, item titles, form labels and navigation group labels retain their quieter hierarchy.

### Navigation and transient menus

The main glass dock has five labeled destinations, with `aria-current` for the active route. The selected destination uses navigation blue, semibold text and an opaque secondary fill. The large portrait layout emphasizes generous horizontal links. Phone and compact tablet layouts align icons above captions inside an inset floating dock. Focus uses an inset outline in the navigation selection color. Smart-home navigation is a wrapping secondary row; less frequent destinations live in the labeled menu.

The home selector and settings button share the glass material. Dropdown menus use a denser version with an inset margin (.5rem); menu rows have soft corners (14px), at least (48px) height and visible focus. Menus scroll within Radix's available viewport height so every destination stays reachable in short windows. Dialogs and popovers use that denser material, with reachable close actions and readable fields. Reduced-transparency, contrast and forced-colors preferences apply to the shared material, including nested dropdowns and dialogs.

### Schedules, lists and controls

Secondary options live behind labeled settings cogs: calendar layout and start day on Today and Calendar, Today sections and home favorites, Smart home configuration and administrative links, device grouping, and area/zone/automation management links. The playground cog holds comparison view, demo state and reset. Shared popovers fit the viewport, scroll when needed, close with Escape or the close button, and return focus to the trigger. Week indicators, paging, search, people/room filters and everyday actions stay visible. Full settings pages keep their configuration controls exposed.

The weekly grid aligns people and dates, marks the current day, and supports continuous multi-day events. Event cells have equal top and bottom padding and center their cards vertically within each row. Events use an opaque person-tinted fill (30% person color in light, 18% in dark), a narrow color marker and a semibold title above tabular times. Text mixes 20% person color with the foreground; metadata uses 85% of that ink against the event fill. Long titles wrap. Chevron cues and subtly squared open edges indicate continuation beyond the week, with equivalent screen-reader labels. These reading surfaces never use glass. The next family plan is a compact, clickable row below the section heading. It reuses the calendar event marker and person-tinted ink over the regular panel surface, without a separate colored fill. The padded countdown badge sits beside the event title; person, location and optional notes share a secondary line. Time and date align right on wide screens and move below on phones. The title uses 1rem and metadata .875rem. Lists pair a separate completion target with a full-width edit target; completion adds a check and a strikethrough before the row moves. Saved image/PDF timetables retain their aspect ratio and open into a larger pageable view. Home controls show only supported capabilities, with pending and unavailable feedback.

Calendar timetables place dense day surfaces using the card fill at (65% opacity) inside the shared glass frame. Today uses the accent fill and a primary date capsule with primary foreground, reinforced by `aria-current="date"`. Lesson text, details, messages and controls retain their existing hierarchy and behavior. Reduced transparency and increased contrast make day surfaces opaque; forced colors outline today with system Highlight. The frame inherits the shared glass accessibility fallbacks.

Editable lists have a filled plus button with a 56px minimum touch target. Generated homework permits completion, with no add, edit or delete controls on School or Lists. The School homework header omits an item count. Below 700px, list, plan, card and group add actions show only their icon, retaining their accessible label; list cancellation shows an X. Larger screens keep visible action labels. The list header and inline entry form stay visible while scrolling within that list, keeping the destination clear on boards with several lists. Fields have persistent labels; failed saves and cancellation preserve the draft. The Lists page opens Shopping by default, while direct links retain their selected tab.

Calendars, waste collections and lists update automatically without routine refresh buttons. Failed loads show an outlined Retry beside the error. Lists also reread every minute while online and idle to catch changes without entity updates; reads pause during pending writes and loads. The app-update banner retains its explicit Refresh app action.

Motion confirms pointer actions: controls press over 120ms, switches move over 160ms, menus open from their trigger over 180ms, and centered dialogs open and close over 240ms. List composers fade in over 160ms. Keyboard control and overlay transitions stay immediate. List-change feedback follows the rules below. Reduced-motion settings replace overlay movement with a 160ms fade. Do not add motion to imply a device command succeeded before the state confirms it.

### List motion

List changes use deliberately slower, flowing motion so people can follow what changed. Rows, surrounding items and the panel surface move together, without a stagger or a pause between exit and reflow. Keep this pace distinct from the short control and overlay transitions above.

| Change | Motion | Timing |
| --- | --- | --- |
| Added or reopened | Fade in from 24px to the right and 97% scale; highlight the row. | 800ms, `cubic-bezier(.77, 0, .175, 1)` |
| Edited | Move 12px to the right, then settle back as the highlight fades. | 800ms each direction, same curve |
| Completed | Show the confirmed check and strikethrough; slide 24px right, shrink to 97% and fade out. | 700ms, `cubic-bezier(.23, 1, .32, 1)` |
| Deleted | Slide 24px right, shrink to 97% and fade out, preserving the previous checked state. Remaining rows reflow alongside the exit, including inside Completed. | 700ms, `cubic-bezier(.23, 1, .32, 1)` |
| Reflow | Move remaining rows, the completed section and empty state; resize the panel surface alongside them. | 800ms, `cubic-bezier(.77, 0, .175, 1)` |
| Highlight | Primary color at 14% opacity, fading in and then out. | 350ms in; feedback clears after 800ms, followed by a 750ms fade |
| Check | Fade in and scale from 90% to full size. | 450ms opacity, 600ms scale, shared `--ease-out` |

Compare previous and new items by stable ID to identify additions, edits and completion changes. Initial loads, reconnects, unchanged refreshes and reordering do not highlight rows. New changes extend the active feedback window so overlapping updates remain legible.

List refreshes keep the existing rows and card height stable while fetching. Status announcements remain available to screen readers without taking up layout space, with `aria-busy` exposing progress.

Deletion starts only after the item disappears from confirmed data. Keep its row mounted for the exit, with controls disabled and the row hidden from assistive technology. Cancelled or failed deletion keeps the item in place; filtering or a dashboard limit must not be mistaken for deletion. Pass current item IDs through nested presence boundaries so deleting the last completed item also animates.

On a Home Assistant checkbox click, show a spinner immediately inside that checkbox and keep it there through command submission and the following item refresh. Preserve the last confirmed checked state until fresh data arrives. The spinner uses a steady 1s linear rotation, matching existing suggestion feedback; other rows do not spin. A failed command or refresh ends pending feedback and displays the existing error. Suggestions also show pending feedback while submitting their update.

Confirmed list changes animate identically for pointer and keyboard input, including Enter to submit an addition or edit. Input method must not suppress the row highlight, entry, exit or coordinated reflow. With reduced motion, remove translation, scaling and spinner rotation; use a static loading glyph with `aria-busy`, and limit check, highlight and exit fades to 160ms. Pending feedback remains available for keyboard users.

Use Framer Motion layout transforms with `LayoutGroup` and `AnimatePresence mode="popLayout"` for coordinated reflow. Keep forwarded refs on presence children. Animate the panel's separate background surface so text does not stretch; avoid animating row height. CSS owns the highlight and check, and the existing motion-safe spinner utility owns rotation. Sources: [list components](src/components/FamilyLists.tsx), [item diff and feedback lifetime](src/hooks/use-list-item-feedback.ts), and [motion styles](src/afterglow.css).


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
- **Don't** spread glass beyond the documented control layers and calendar timetable and Smart home card exceptions, or add decorative gradients or elevation to other recurring work panels.
- **Don't** turn a timetable preview into a cropped substitute for the full, pageable view.
- **Don't** describe CSS blur and specular edges as native optical refraction.
