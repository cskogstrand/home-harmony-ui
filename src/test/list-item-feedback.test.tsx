import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useListItemFeedback } from "@/hooks/use-list-item-feedback";

const bread = { id: "bread", text: "Bread", complete: false };
const milk = { id: "milk", text: "Milk", complete: false };
type Items = Parameters<typeof useListItemFeedback>[0];
const renderFeedback = (items: Items) => renderHook(({ items }: { items: Items }) => useListItemFeedback(items), { initialProps: { items } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("keeps initial loads, refreshes and reorders quiet", () => {
  const { result, rerender } = renderFeedback(null);
  rerender({ items: [bread, milk] });
  expect(result.current.size).toBe(0);
  rerender({ items: [{ ...milk }, { ...bread }] });
  expect(result.current.size).toBe(0);
});

it("diffs IDs, including additions to an empty list and same-length replacements", () => {
  const { result, rerender } = renderFeedback([]);
  rerender({ items: [bread] });
  expect([...result.current]).toEqual([["bread", "added"]]);
  rerender({ items: [milk] });
  expect([...result.current]).toEqual([["milk", "added"]]);
});

it("identifies additions on their first render so they enter without flashing in place", () => {
  const observed: Array<string | undefined> = [];
  const { rerender } = renderHook(({ items }) => {
    const feedback = useListItemFeedback(items);
    observed.push(feedback.get("milk"));
  }, { initialProps: { items: [bread] } });
  const firstAddedRender = observed.length;
  rerender({ items: [bread, milk] });
  expect(observed[firstAddedRender]).toBe("added");
});

it("keeps earlier feedback active when another item changes during the animation", () => {
  const { result, rerender } = renderFeedback([bread]);
  rerender({ items: [bread, milk] });
  act(() => vi.advanceTimersByTime(500));
  rerender({ items: [{ ...bread, text: "Bread rolls" }, milk] });
  expect([...result.current]).toEqual([["milk", "added"], ["bread", "edited"]]);
  act(() => vi.advanceTimersByTime(300));
  expect(result.current.get("milk")).toBe("added");
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.size).toBe(0);
});

it("identifies every addition, rename, completion and reopening in a refreshed snapshot", () => {
  const { result, rerender } = renderFeedback([bread, milk, { id: "eggs", text: "Eggs", complete: true }]);
  rerender({ items: [{ ...bread, text: "Wholegrain bread" }, { ...milk, complete: true }, { id: "eggs", text: "Eggs", complete: false }, { id: "rice", text: "Rice", complete: false }, { id: "beans", text: "Beans", complete: false }] });
  expect([...result.current]).toEqual([["bread", "edited"], ["milk", "completed"], ["eggs", "reopened"], ["rice", "added"], ["beans", "added"]]);
});

it("does not treat removals or recovery after an unavailable result as additions", () => {
  const { result, rerender } = renderFeedback([bread, milk]);
  rerender({ items: [bread] });
  expect(result.current.size).toBe(0);
  rerender({ items: null });
  rerender({ items: [bread, milk] });
  expect(result.current.size).toBe(0);
});

it("clears in-flight feedback when the list becomes unavailable", () => {
  const { result, rerender } = renderFeedback([bread]);
  rerender({ items: [bread, milk] });
  expect(result.current.get("milk")).toBe("added");
  rerender({ items: null });
  rerender({ items: [bread, milk] });
  expect(result.current.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("releases the highlight without restarting it on unchanged refreshes", () => {
  const { result, rerender } = renderFeedback([bread]);
  rerender({ items: [bread, milk] });
  act(() => vi.advanceTimersByTime(500));
  rerender({ items: [{ ...bread }, { ...milk }] });
  act(() => vi.advanceTimersByTime(300));
  expect(result.current.size).toBe(0);
});

it("lets a repeated edit finish its feedback and cleans up on unmount", () => {
  const { result, rerender, unmount } = renderFeedback([bread]);
  rerender({ items: [{ ...bread, text: "Wholegrain bread" }] });
  act(() => vi.advanceTimersByTime(500));
  rerender({ items: [{ ...bread, text: "Sliced bread" }] });
  act(() => vi.advanceTimersByTime(300));
  expect(result.current.get("bread")).toBe("edited");
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.size).toBe(0);
  rerender({ items: [{ ...bread, text: "Bread rolls" }] });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
