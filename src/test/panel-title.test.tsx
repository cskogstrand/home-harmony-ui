import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { BookOpen, CalendarDays } from "lucide-react";
import { describe, expect, it } from "vitest";
import { PanelTitle } from "@/components/PanelTitle";

describe("PanelTitle", () => {
  it("keeps the heading name and level while hiding its decorative icon", () => {
    const ref = createRef<HTMLHeadingElement>();
    const { rerender } = render(<PanelTitle icon={CalendarDays}>Everyone’s week</PanelTitle>);
    expect(screen.getByRole("heading", { level: 2, name: "Everyone’s week" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<PanelTitle as="h3" icon={BookOpen} id="homework-title" tabIndex={-1} ref={ref}>Lekser</PanelTitle>);
    const heading = screen.getByRole("heading", { level: 3, name: "Lekser" });
    expect(heading).toHaveAttribute("id", "homework-title");
    expect(ref.current).toBe(heading);
    heading.focus();
    expect(heading).toHaveFocus();
  });
});
