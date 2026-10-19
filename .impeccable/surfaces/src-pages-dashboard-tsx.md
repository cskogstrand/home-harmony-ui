---
version: 1
slug: "src-pages-dashboard-tsx"
primary_target: "src/pages/Dashboard.tsx"
related_targets: ["src/afterglow.css","src/index.css","src/components/layout/Navigation.tsx","src/components/layout/AppLayout.tsx","src/components/ui/button-variants.ts","src/components/ui/dropdown-menu.tsx"]
---

# Shared household board

Mode: Operate. Primary target: 1440 × 2560 portrait touchscreen; phone and desktop layouts remain supported. The experiment changes the app's shared visual system while preserving workflows, content, safe commands, and data ownership.

## Direction contract

THESIS: An iOS Liquid Glass inspired control layer floats above a readable household board.

OWN-WORLD: Cool pearl and midnight blue grounds, native system typography, crisp blue actions, opaque rounded work surfaces. Translucent navigation has a softly illuminated rim and a restrained shadow; content never competes with the controls.

STORY: Read the next plan, scan the family week, act on lists, inspect school and home controls. Keep the five labeled destinations and visible offline, pending, and error states.

FIRST VIEWPORT: Preserve the compact brand/home header, greeting and clock, next plan, and existing responsive board. The signature is a floating glass navigation capsule, with a tinted current route and existing press feedback. Glass is reserved for the dock, header controls, and transient menus. Lists, forms and calendar rows remain opaque. Phone dock floats clear of the screen edge; portrait touch targets remain generous.

FORM: User pinned iOS Liquid Glass and asked to implement an experiment on a branch. This overrides the direction roll (seed:04333850e6d199d9); code-led, no decision comp. Sources: Apple's Materials HIG and WWDC25 Meet Liquid Glass. CSS supplies blur, translucency and specular edges; native optical refraction is outside the web implementation.

FINISH: Verify light/dark, desktop, phone, portrait, navigation, lists and dialogs with fictional fixtures; preserve reduced motion and provide solid surfaces for reduced transparency, increased contrast and missing backdrop-filter support. Finish with independent review and matching design documentation.
