import { BookOpen, CalendarCheck, CalendarClock, CalendarDays, History, House, ListChecks, NotebookPen, ShieldCheck, ShoppingBasket, Sunrise, Trash2, type LucideIcon } from "lucide-react";
import type { DashboardSection, PlannerArtwork } from "../../shared/configuration";

/** Each Today section's icon: its heading glyph and its row in Customize Today. */
export const todaySectionIcons: Record<DashboardSection, LucideIcon> = {
  homeStatus: ShieldCheck, morningSummary: Sunrise, wasteCollection: Trash2, nextPlan: CalendarClock, day: CalendarCheck, week: CalendarDays,
  daily: ListChecks, shopping: ShoppingBasket, homework: NotebookPen, school: BookOpen, home: House, recentActivity: History,
};

/**
 * Each Today section's card artwork: the heading illustration and corner scene it shows when the owner turns it on in
 * Settings → Appearance → Card artwork.
 */
export const todaySectionArtwork: Record<DashboardSection, PlannerArtwork> = {
  homeStatus: "homeStatus", morningSummary: "morningSummary", wasteCollection: "wasteCollection", nextPlan: "nextPlan", day: "day", week: "week",
  daily: "daily", shopping: "shopping", homework: "homework", school: "school", home: "home", recentActivity: "recentActivity",
};
