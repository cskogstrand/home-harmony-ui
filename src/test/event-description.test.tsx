import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EventDescription } from "@/components/EventDescription";

afterEach(cleanup);

it("renders calendar formatting and decodes entities without source attributes", () => {
  const { container } = render(<EventDescription value={'<p class="foreign" style="color:red" onclick="alert(1)">Example &amp; details<br><strong>Bring supplies</strong></p><ul><li><em>First item</em></li></ul><p><a href="https://example.com/booking?a=1&amp;b=2" target="_self" ping="https://example.com/track">Booking details</a></p>'} />);
  expect(container.querySelector("p")).toHaveTextContent("Example & details");
  expect(container.querySelector("br")).not.toBeNull();
  expect(container.querySelector("strong")).toHaveTextContent("Bring supplies");
  expect(screen.getByRole("listitem").querySelector("em")).toHaveTextContent("First item");
  const link = screen.getByRole("link", { name: "Booking details" });
  expect(link).toHaveAttribute("href", "https://example.com/booking?a=1&b=2");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(container.querySelector("[style], [onclick], [ping], .foreign")).toBeNull();
});

it.each(["javascript:alert(1)", "jav&#x61;script:alert(1)", "java&#10;script:alert(1)", "data:text/html,example", "vbscript:example", "/api/example", "//example.com", "#example", ""])("removes unsafe or relative link destination %s", href => {
  render(<EventDescription value={`<a href="${href}">Readable label</a>`} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Readable label")).toBeVisible();
});

it.each(["http://example.com/", "https://example.com/", "mailto:person@example.com", "tel:+15550100"])("retains safe link destination %s", href => {
  render(<EventDescription value={`<a href="${href}">Example link</a>`} />);
  expect(screen.getByRole("link")).toHaveAttribute("href", href);
});

it("drops active content, embedded media and forms while retaining ordinary text", () => {
  const { container } = render(<EventDescription value='<script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com">Frame</iframe><object data="https://example.com">Object</object><svg><a href="javascript:alert(1)">SVG</a></svg><math><mtext>Math</mtext></math><template><p>Hidden</p></template><img src="https://example.com/tracker" onerror="alert(1)"><form action="https://example.com"><input autofocus><button>Ordinary label</button></form><div><p>Visible text</p></div>' />);
  expect(container.querySelector("script, style, iframe, object, svg, math, template, img, form, input, button")).toBeNull();
  expect(container.textContent).toBe("Ordinary labelVisible text");
});

it("preserves plain text including line breaks, comparisons and literal entities", () => {
  const value = "Bring supplies\n5 < 10 & 10 > 5\nContact <person@example.com> or write &amp;";
  const { container, rerender } = render(<EventDescription value={value} />);
  expect(container.firstChild?.textContent).toBe(value);
  expect(container.firstChild).toHaveClass("event-description-plain");
  rerender(<EventDescription value="<p>Updated <b>note</b>" />);
  expect(container.querySelector("b")).toHaveTextContent("note");
});
