---
version: 1
slug: "src-pages-dashboard-tsx"
primary_target: "src/pages/Dashboard.tsx"
related_targets: ["src/afterglow.css","src/index.css","src/components/layout/Navigation.tsx","src/components/FamilyPlanner.tsx"]
---

# Shared household board

Mode: Operate. Primary target: 1440 × 2560 portrait touchscreen; phone and desktop layouts remain supported. Rebuild the shared shell and reusable UI, Today, calendar, lists, school and smart-home navigation without changing data ownership or command safety.

## Direction contract

THESIS: Library wayfinding makes household plans and controls readable and easy to find. Task information takes precedence over slogans and oversized decoration.

OWN-WORLD: Deep evergreen navigation, pale green-gray ground, near-white work surfaces, dark green ink; the dark counterpart uses evergreen surfaces with a lighter green action color. A consistent sans, restrained 12–16px corners and clear dividers support dense schedules.

STORY: Read the next plan, scan everyone's week, act on lists, inspect school and home controls. Current location is obvious in the bottom navigation. Offline is visibly distinct from empty.

FIRST VIEWPORT: A modest header; greeting/date opposite the clock; next plan; full-width family week; paired daily and shopping lists; school previews; home favorites. At 1440 × 2560, essential text is 18–24px and touch targets at least 48px. Overflow remains scrollable; content is never hidden to fit. The signature is consistent aligned person/date lanes with a clearly marked current day.

FORM: User selected Library wayfinding, grounded candidate 1 (pick), over assigned candidate 6. seed:dbcc6d3e13cfa3e8. Code-led; approved arrangement at .impeccable/mocks/decision/library.html. Other grounded candidates considered: linen, swim-lane graphics, school planner, transit wayfinding, gallery wayfinding, garden labels.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
