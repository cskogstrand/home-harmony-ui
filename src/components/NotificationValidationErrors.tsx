import { useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { ZodIssue } from "zod";
import { useI18n } from "@/hooks/use-i18n";
import { notificationIssueSection } from "@/lib/notifications";
import { Button } from "./ui/button";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;

export function NotificationValidationErrors({ issues, editor, openSection }: { issues: ZodIssue[]; editor: RefObject<HTMLFormElement>; openSection: (section: string) => void }) {
  const { message: t } = useI18n();
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<MutationObserver | null>(null);
  const [targets, setTargets] = useState<{ control?: Control; label: string }[]>([]);
  useLayoutEffect(() => {
    const controls = [...editor.current.querySelectorAll<Control>("[name]")];
    const resolved = issues.map(issue => {
      const path = [...issue.path];
      let control: Control;
      while (path.length && !control) {
        const name = path.join(".");
        control = controls.find(item => item.name === name) ?? controls.find(item => [name + ".value", name + ".entity"].includes(item.name));
        path.pop();
      }
      control ??= editor.current.querySelector<HTMLButtonElement>(`[data-section="${notificationIssueSection(issue)}"] > h3 > button`);
      const label = control?.getAttribute("aria-label") || control?.labels?.[0]?.firstChild?.textContent || control?.textContent || t("Notification content");
      const trigger = control?.closest<HTMLElement>("[data-trigger-number]")?.dataset.triggerNumber;
      return { control, label: trigger ? `${t("Trigger {number}", { number: trigger })} · ${label}` : label };
    });
    const restore = resolved.map(({ control }, index) => {
      if (!control) return () => {};
      const describedBy = control.getAttribute("aria-describedby");
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("aria-describedby", [describedBy, `${id}-${index}`].filter(Boolean).join(" "));
      return () => { control.removeAttribute("aria-invalid"); if (describedBy === null) control.removeAttribute("aria-describedby"); else control.setAttribute("aria-describedby", describedBy); };
    });
    setTargets(resolved);
    summary.current?.focus();
    return () => { pendingFocus.current?.disconnect(); restore.reverse().forEach(reset => reset()); };
  }, [issues, editor, id, t]);
  const message = (issue: ZodIssue) => {
    if (issue.code === "custom" && issue.message !== "Invalid input") return t(issue.message);
    if (issue.path.includes("filters")) return t("Use at most 10 event filters with text, number or boolean values.");
    if (issue.code === "too_small") return issue.type === "string" ? t("Enter a value.") : t("Use a value of {limit} or more.", { limit: String(issue.minimum) });
    if (issue.code === "too_big") return issue.type === "string" ? t("Use at most {limit} characters.", { limit: String(issue.maximum) }) : t("Use a value of {limit} or less.", { limit: String(issue.maximum) });
    return t("Choose a valid value for this field.");
  };
  return <div ref={summary} tabIndex={-1} role="alert" className="notification-validation-errors">
    <p>{t("Correct the highlighted fields, then save again.")}</p>
    <ul>{issues.map((issue, index) => <li key={index} id={`${id}-${index}`}><Button type="button" variant="link" onClick={() => {
      const control = targets[index]?.control;
      if (!control) return;
      const focus = () => {
        if (getComputedStyle(control).visibility === "hidden" || control.matches(":disabled")) return;
        pendingFocus.current?.disconnect(); control.focus(); control.scrollIntoView?.({ block: "center" });
      };
      pendingFocus.current?.disconnect();
      // Collapsed sections keep fields hidden until their opening animation finishes.
      pendingFocus.current = new MutationObserver(focus);
      pendingFocus.current.observe(editor.current, { subtree: true, attributes: true, attributeFilter: ["style", "disabled"] });
      openSection(notificationIssueSection(issue));
      focus();
    }}>{targets[index]?.label}: {message(issue)}</Button></li>)}</ul>
  </div>;
}
