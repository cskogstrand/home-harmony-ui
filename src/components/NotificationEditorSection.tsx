import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

export function NotificationEditorSection({ value, title, icon: Icon, open, summary, children }: { value: string; title: string; icon: LucideIcon; open: boolean; summary?: string; children: ReactNode }) {
  const summaryId = useId();
  const reduceMotion = useReducedMotion();
  const pointer = typeof document !== "undefined" && document.documentElement.dataset.motionInput === "pointer";
  // Use the same strong ease-out as --ease-out; Motion needs its numeric form.
  const transition = { duration: pointer ? .25 : 0, ease: [.23, 1, .32, 1] as const };
  return <AccordionItem value={value} data-section={value} className="notification-editor-section settings-card">
    <AccordionTrigger aria-label={title} aria-describedby={!open && summary ? summaryId : undefined}><span className="panel-title"><Icon className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{title}
      {!open && summary && <small id={summaryId} className="notification-section-summary">{summary}</small>}</span></span></AccordionTrigger>
    <AccordionContent forceMount aria-hidden={!open} className="notification-section-shell">
      <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0, visibility: "visible", transitionEnd: { visibility: open ? "visible" : "hidden" } }}
        transition={reduceMotion ? { height: { duration: 0 }, opacity: { duration: pointer ? .16 : 0 } } : transition} className="overflow-hidden">
        <fieldset disabled={!open} className="notification-editor-section-content">{children}</fieldset>
      </motion.div>
    </AccordionContent>
  </AccordionItem>;
}
