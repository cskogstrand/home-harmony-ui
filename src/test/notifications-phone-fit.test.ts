import { expect, it } from "vitest";
import { sourceFile } from "./source-file.mjs";

// /notifications on a 375–390px phone, also at 150% text: rule names, entity names and states can be single long
// words, and a phone browser widens its layout viewport to fit anything that overflows, pushing the fixed dock and
// player past the edge. These rules let that text wrap inside the page's 16px margin (DESIGN.md, Notifications).
const notificationsCss: string = sourceFile("components/notifications.css");
const centerSource: string = sourceFile("components/NotificationCenter.tsx");

const declarations = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
};
const wraps = /min-width: 0;[^;]*overflow-wrap: anywhere/;

it("wraps rule names in the waiting and source-error notes", () => {
  expect(centerSource).toMatch(/<p className="page-note notification-waiting">\{t\("Waiting for a reading for \{rules\}\."/);
  expect(declarations(notificationsCss, ".notification-source-error > p, .notification-waiting")).toMatch(wraps);
});

it("wraps long entity names and states in the availability list", () => {
  expect(declarations(notificationsCss, ".availability-diagnostics > summary > strong")).toMatch(wraps);
  expect(declarations(notificationsCss, ".availability-group > summary")).toMatch(/overflow-wrap: anywhere/);
  const row = declarations(notificationsCss, ".availability-group li");
  expect(row).toMatch(/display: flex; flex-wrap: wrap;/);
  expect(row).toMatch(/min-height: 48px/);
  // Entity links reuse .text-link, which is nowrap everywhere else.
  expect(declarations(notificationsCss, ".availability-group li > a")).toMatch(/min-width: 0; white-space: normal; overflow-wrap: anywhere/);
  expect(declarations(notificationsCss, ".availability-group li > span")).toMatch(/min-width: 0; margin-left: auto; overflow-wrap: anywhere; text-align: end/);
});

it("keeps the side camera placeholder within its reading column", () => {
  // Without a definite width, the 4rem minimum height widens the 16:9 placeholder past a narrow column.
  expect(declarations(notificationsCss, ".notification-media-side .notification-camera-placeholder")).toMatch(/width: 100%; min-height: 4rem/);
});

it("keeps the notification import preview within a phone's width", () => {
  // Rule names, entity references and conflict legends can be single long words; the choices share the width in thirds.
  expect(declarations(notificationsCss, ".notification-import-heading strong, .notification-import-heading p, .notification-import-rejected li")).toMatch(wraps);
  expect(declarations(notificationsCss, ".notification-import-entities > li")).toMatch(/min-width: 0; max-width: 100%;.*overflow-wrap: anywhere/);
  expect(declarations(notificationsCss, ".notification-import-conflict > legend")).toMatch(/overflow-wrap: anywhere/);
  expect(declarations(notificationsCss, ".notification-import-choices")).toMatch(/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  expect(declarations(notificationsCss, ".notification-import-choices > label")).toMatch(/min-width: 0; min-height: 48px;.*overflow-wrap: anywhere/);
  expect(declarations(notificationsCss, ".notification-import-dialog")).toMatch(/max-height: calc\(100dvh - 24px\)/);
});
