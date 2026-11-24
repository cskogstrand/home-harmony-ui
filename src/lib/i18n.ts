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
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const calendarCategories = ["Activities", "Meetings", "Pedagogy", "Closure days", "Invitations", "Opening hours"] as const;

/** How a reading is shown: its unit, Home Assistant device class and display precision when the entity has one. */
export interface ReadingFormat { unit?: unknown; deviceClass?: unknown; precision?: number }
const units = (unit: unknown) => typeof unit === "string" ? unit.trim() : "";
// One precision rule for readings: Home Assistant's display precision, else by quantity. Other values keep their reported digits.
export function readingDigits(value: number, { unit, deviceClass, precision }: ReadingFormat = {}): Intl.NumberFormatOptions {
  if (precision !== undefined && Number.isInteger(precision) && precision >= 0 && precision <= 20) return { minimumFractionDigits: precision, maximumFractionDigits: precision };
  const symbol = units(unit);
  if (deviceClass === "temperature" || ["°C", "°F"].includes(symbol)) return { maximumFractionDigits: 1 };
  if (/^(m?W|Wh|VA|var)$/.test(symbol)) return { maximumFractionDigits: 0 };
  if (/^[kMG](W|Wh|VA|var)$/.test(symbol)) return { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 };
  return { maximumFractionDigits: 20 };
}
/** One spacing rule in every language: a no-break space before the unit ("−2,4 °C"); "%" and an angle's "°" attach to the number. */
export function withUnit(value: string, unit?: unknown) {
  const symbol = units(unit);
  return symbol ? `${value}${["%", "°"].includes(symbol) ? "" : " "}${symbol}` : value;
}

// English source messages are keys, so the default language needs no duplicate catalogue.
export function createI18n(language: Language) {
  const locale = locales[language];
  const number = (value: number, options: Intl.NumberFormatOptions = { maximumFractionDigits: 20 }) => new Intl.NumberFormat(locale, options).format(value);
  /** A measured value with the shared precision and unit spacing rules. */
  const reading = (value: number, format: ReadingFormat = {}) => withUnit(number(value, readingDigits(value, format)), format.unit);
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
  const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => {
    const key = JSON.stringify([locale, options]);
    let formatter = dateFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
      if (dateFormatters.size >= 64) dateFormatters.clear();
      dateFormatters.set(key, formatter);
    }
    return formatter.format(new Date(`${date}T12:00:00Z`));
  };
  const eventTimeLabel = (event: FamilyEvent) => {
    if (event.allDay) return message("All day");
    const start = event.continues ? message("Continues") : event.time;
    if (!event.endTime) return start;
    const endDate = event.endDate && event.endDate !== event.date ? `${dateLabel(event.endDate)}, ` : "";
    return `${start} – ${endDate}${event.endTime}`;
  };
  // Only known integration labels are translated; names and free-form content stay literal.
  const calendarName = (name: string) => {
    const category = calendarCategories.find(key => name.toLowerCase() === key.toLowerCase() || name.toLowerCase().endsWith(` ${key.toLowerCase()}`));
    return language !== "en" && category ? name.slice(0, -category.length) + message(category) : name;
  };
  const calendarTitle = (title: string) => {
    const key = [...calendarCategories, "Daily focus" as const].find(key => title.trim().toLowerCase() === key.toLowerCase());
    return language !== "en" && key ? message(key) : title;
  };
  return { language, locale, number, reading, dateLabel, eventTimeLabel, calendarName, calendarTitle, message, t: (key: MessageKey, values?: MessageValues) => message(key, values) };
}
