import { describe, expect, it } from "vitest";
import { dashboardRows, emptyPlanner, type DashboardSection, type Planner } from "../../shared/configuration";

const board = (patch: Partial<Planner["dashboard"]> = {}) => ({ ...emptyPlanner().dashboard, ...patch });
const rows = (patch: Partial<Planner["dashboard"]> = {}) => dashboardRows(board(patch)).map(row => row.sections);
const only = (...keys: DashboardSection[]) => Object.fromEntries(emptyPlanner().dashboard.order.map(key => [key, keys.includes(key)])) as Record<DashboardSection, boolean>;

describe("dashboardRows", () => {
  it("reproduces the earlier board by default: lists pair, everything else spans the board", () => {
    expect(rows()).toEqual([["morningSummary"], ["nextPlan"], ["day"], ["week"], ["daily", "shopping"], ["school"], ["home"]]);
    expect(rows({ homework: true })).toEqual([["morningSummary"], ["nextPlan"], ["day"], ["week"], ["daily", "shopping"], ["homework"], ["school"], ["home"]]);
  });

  it("lets a half without a half partner fill its row", () => {
    expect(rows({ shopping: false })).toEqual([["morningSummary"], ["nextPlan"], ["day"], ["week"], ["daily"], ["school"], ["home"]]);
    expect(rows({ ...only("nextPlan", "home"), widths: { home: "half" } })).toEqual([["nextPlan"], ["home"]]);
  });

  it("keeps a pair when a switched-off section sits between the halves", () => {
    const order: DashboardSection[] = ["recentActivity", "homeStatus", "homework", "day"];
    expect(rows({ ...only("recentActivity", "homework", "day"), order: [...order, ...emptyPlanner().dashboard.order.filter(key => !order.includes(key))], widths: { recentActivity: "half" } }))
      .toEqual([["recentActivity", "homework"], ["day"]]);
  });

  it("splits halves around a full section and pairs strictly in order", () => {
    const order: DashboardSection[] = ["daily", "day", "shopping", "homework", "recentActivity", "home"];
    const rest = emptyPlanner().dashboard.order.filter(key => !order.includes(key));
    expect(rows({ ...only(...order), order: [...order, ...rest], widths: { recentActivity: "half", home: "half" } }))
      .toEqual([["daily"], ["day"], ["shopping", "homework"], ["recentActivity", "home"]]);
  });

  it("always keeps Everyone's day, Everyone's week and School full, whatever is stored", () => {
    const order: DashboardSection[] = ["daily", "day", "week", "school", "shopping"];
    const rest = emptyPlanner().dashboard.order.filter(key => !order.includes(key));
    expect(rows({ ...only(...order), order: [...order, ...rest], widths: { day: "half", week: "half", school: "half" } }))
      .toEqual([["daily"], ["day"], ["week"], ["school"], ["shopping"]]);
  });

  it("marks only the row that holds a visible fill section", () => {
    const order: DashboardSection[] = ["day", "recentActivity", "homework", "home"];
    const rest = emptyPlanner().dashboard.order.filter(key => !order.includes(key));
    const layout = dashboardRows(board({ ...only(...order), order: [...order, ...rest], widths: { recentActivity: "half" }, fill: "recentActivity" }));
    expect(layout).toEqual([{ sections: ["day"], fill: false }, { sections: ["recentActivity", "homework"], fill: true }, { sections: ["home"], fill: false }]);
    expect(dashboardRows(board({ fill: "recentActivity" })).some(row => row.fill)).toBe(false);
    expect(dashboardRows(board({ fill: "" })).some(row => row.fill)).toBe(false);
  });
});
