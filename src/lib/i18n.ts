import { nb } from "@/locales/nb";
import { en } from "@/locales/en";
import type { FamilyEvent } from "@/contexts/FamilyContext";
import type { Planner } from "../../shared/configuration";

export type Language = Planner["language"];
export type MessageKey = keyof typeof nb;
export type MessageValues = Record<string, string | number | { key: MessageKey; values?: MessageValues }>;
export type Message = string | { key: MessageKey; values?: MessageValues };
export const msg = (key: MessageKey, values?: MessageValues): Message => ({ key, values });

export class MessageError extends Error {
  constructor(readonly key: MessageKey, readonly values?: MessageValues) {
    super(createI18n("en").message(key, values));
  }
}
export const locales = { en: "en-GB", nb: "nb-NO" } as const;

// English source messages are keys, so the default language needs no duplicate catalogue.
export function createI18n(language: Language) {
  const locale = locales[language];
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value);
  const message = (input: Message = "", values: MessageValues = {}): string => {
    if (typeof input !== "string") return message(input.key, input.values);
    const key = input;
    const catalogue = language === "nb" ? nb : en;
    const text: string = Object.prototype.hasOwnProperty.call(catalogue, key) ? catalogue[key] : key;
    return text.replace(/\{(\w+)\}/g, (placeholder, name) => {
      if (!Object.prototype.hasOwnProperty.call(values, name)) return placeholder;
      const value = values[name];
      return typeof value === "object" ? message(value) : typeof value === "number" ? number(value) : value;
    });
  };
  const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const eventTimeLabel = (event: FamilyEvent) => {
    if (event.allDay) return message("All day");
    const start = event.continues ? message("Continues") : event.time;
    if (!event.endTime) return start;
    const endDate = event.endDate && event.endDate !== event.date ? `${dateLabel(event.endDate)}, ` : "";
    return `${start} – ${endDate}${event.endTime}`;
  };
  return { language, locale, number, dateLabel, eventTimeLabel, message, t: (key: MessageKey, values?: MessageValues) => message(key, values) };
}
