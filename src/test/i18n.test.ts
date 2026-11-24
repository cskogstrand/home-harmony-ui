import { describe, expect, it, vi } from "vitest";
import { createI18n, MessageError, msg } from "@/lib/i18n";
import { nb } from "@/locales/nb";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { entityReading, entityStateLabel, mapHome, emptyRegistries } from "@/lib/ha-model";
import { state } from "./ha-fixtures";

it("defaults older backups to English and validates server languages", () => {
  const backup = emptyConfiguration();
  delete backup.settings.language;
  expect(parseConfiguration(JSON.stringify(backup)).settings.language).toBe("en");
  backup.settings.language = "nb";
  expect(parseConfiguration(JSON.stringify(backup))).toEqual(backup);
  backup.settings.language = "invalid" as never;
  expect(() => parseConfiguration(JSON.stringify(backup))).toThrow();
});

it("keeps every translated message's parameters intact", () => {
  const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, value] of Object.entries(nb)) {
    expect(value.trim(), key).not.toBe("");
    expect(parameters(value), key).toEqual(parameters(key));
  }
});

it("formats Norwegian dates and numbers without changing calendar dates or precision", () => {
  const i18n = createI18n("nb");
  expect(i18n.dateLabel("2026-10-19", { weekday: "long" })).toBe("mandag");
  expect(i18n.number(21.123456)).toBe("21,123456");
  expect(i18n.t("{count} plans", { count: 2 })).toBe("2 planer");
  expect(i18n.t("{count} plan", { count: 1 })).toBe("1 plan");
  expect(i18n.eventTimeLabel({ allDay: true } as never)).toBe("Hele dagen");
  expect(i18n.eventTimeLabel({ date: "2026-10-19", continues: true, endTime: "09:00", endDate: "2026-10-20" } as never)).toMatch(/^Fortsetter – .*09:00$/);
  expect(createI18n("en").dateLabel("2026-10-19", { weekday: "long" })).toBe("Monday");
});

it("shares date formatters across labels and keeps languages and formats distinct", () => {
  const options = { month: "long", calendar: "gregory" } as const;
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args) {
    return new NativeDateTimeFormat(...args);
  });
  try {
    expect(createI18n("en").dateLabel("2026-01-01", options)).toBe("January");
    expect(createI18n("en").dateLabel("2026-02-01", { ...options })).toBe("February");
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(createI18n("nb").dateLabel("2026-01-01", options)).toBe("januar");
    expect(createI18n("en").dateLabel("2026-01-01", { ...options, month: "2-digit" })).toBe("01");
    expect(constructor).toHaveBeenCalledTimes(3);
  } finally { constructor.mockRestore(); }
});

it("translates stored messages again after switching languages and keeps inserted text literal", () => {
  const value = msg("Disable {name}?", { name: "Home {count} <script>" });
  expect(createI18n("en").message(value)).toBe("Disable Home {count} <script>?");
  expect(createI18n("nb").message(value)).toBe("Deaktivere Home {count} <script>?");
  const error = new MessageError("This time does not exist in {timeZone}. Choose another time.", { timeZone: "Europe/Oslo" });
  expect(error.message).toBe("This time does not exist in Europe/Oslo. Choose another time.");
  expect(createI18n("nb").message(error)).toBe("Dette tidspunktet finnes ikke i Europe/Oslo. Velg et annet tidspunkt.");
  expect(createI18n("nb").message("External integration detail")).toBe("External integration detail");
});

it("translates known calendar categories and titles without changing names or free-form content", () => {
  const norwegian = createI18n("nb");
  const english = createI18n("en");
  for (const [source, translated] of [["Activities", "Aktiviteter"], ["Meetings", "Møter"], ["Pedagogy", "Pedagogikk"], ["Closure days", "Stengedager"], ["Invitations", "Invitasjoner"], ["Opening hours", "Åpningstider"]]) {
    expect(norwegian.calendarName(source)).toBe(translated);
    expect(norwegian.calendarName(`Example child ${source}`)).toBe(`Example child ${translated}`);
    expect(norwegian.calendarTitle(source)).toBe(translated);
    expect(english.calendarName(`Example child ${source}`)).toBe(`Example child ${source}`);
    expect(english.calendarTitle(source)).toBe(source);
  }
  expect(norwegian.calendarTitle("Daily focus")).toBe("Dagens fokus");
  expect(norwegian.calendarTitle(" daily focus ")).toBe("Dagens fokus");
  expect(english.calendarTitle("Daily focus")).toBe("Daily focus");
  expect(norwegian.calendarName("Example {name} – pedagogy")).toBe("Example {name} – Pedagogikk");
  for (const text of ["Example child", "MyPedagogy", "Activities for everyone", "Daily focus: outdoor play", "Dagens fokus", "Home"]) {
    expect(norwegian.calendarName(text)).toBe(text);
    expect(norwegian.calendarTitle(text)).toBe(text);
  }
});

describe("device readings", () => {
  it("translates known states and numeric readings while retaining names and custom states", () => {
    const home = mapHome({
      "light.one": state("light.one", "on", { friendly_name: "Home" }),
      "sensor.number": state("sensor.number", "21.123456"),
      "cover.door": state("cover.door", "open"),
      "binary_sensor.leak": state("binary_sensor.leak", "off", { device_class: "moisture" }),
      "climate.room": state("climate.room", "dry"),
      "sensor.custom": state("sensor.custom", "My custom value"),
    }, emptyRegistries, "home");
    expect(home.entities[0].name).toBe("Home");
    expect(home.entities.map(entity => entityStateLabel(entity, "nb"))).toEqual(["På", "21,123456", "Åpen", "Tørt", "Avfukting", "My custom value"]);
  });

  it("rounds readings by display precision, then by quantity, in each language", () => {
    const { reading: nbReading } = createI18n("nb"), { reading: enReading } = createI18n("en");
    expect(nbReading(20.37, { unit: "°C" })).toBe("20,4 °C");
    expect(enReading(20.37, { unit: "°C" })).toBe("20.4 °C");
    expect(nbReading(-2.44, { deviceClass: "temperature", unit: "°C" })).toBe("−2,4 °C");
    expect(nbReading(20.37, { unit: "°C", precision: 2 })).toBe("20,37 °C");
    expect(nbReading(20, { unit: "°C", precision: 1 })).toBe("20,0 °C");
    expect(enReading(1234.56, { unit: "W" })).toBe("1,235 W");
    expect(enReading(3.456, { unit: "kWh" })).toBe("3.46 kWh");
    expect(enReading(12.345, { unit: "kW" })).toBe("12.3 kW");
    expect(enReading(1013.25, { unit: "hPa" })).toBe("1,013.25 hPa");
  });

  it("puts one no-break space before units, but attaches percent and bare degrees", () => {
    const { reading } = createI18n("nb");
    expect(reading(45, { unit: "%" })).toBe("45%");
    expect(reading(270, { unit: "°" })).toBe("270°");
    expect(reading(3.5, { unit: "m/s" })).toBe("3,5 m/s");
    expect(reading(7)).toBe("7");
  });

  it("uses the entity registry's display precision before the integration's suggestion", () => {
    const sensor = (options: Record<string, unknown>) => mapHome({ "sensor.example_temperature": state("sensor.example_temperature", "20.37", { unit_of_measurement: "°C", device_class: "temperature" }) },
      { ...emptyRegistries, entities: [{ id: "temperature-entry", entity_id: "sensor.example_temperature", options: { sensor: options } }] }, "home").entities[0];
    expect(entityStateLabel(sensor({}), "nb")).toBe("20,4");
    expect(entityStateLabel(sensor({ suggested_display_precision: 2 }), "nb")).toBe("20,37");
    expect(entityStateLabel(sensor({ suggested_display_precision: 2, display_precision: 0 }), "en")).toBe("20");
    expect(entityReading(sensor({}), "nb")).toBe("20,4 °C");
  });
});

it("uses this screen's remembered language until shared settings load", async () => {
  const { renderHook } = await import("@testing-library/react");
  const { useI18n } = await import("@/hooks/use-i18n");
  localStorage.setItem("afterglow-language", "nb");
  expect(renderHook(() => useI18n()).result.current.language).toBe("nb");
  localStorage.removeItem("afterglow-language");
  expect(renderHook(() => useI18n()).result.current.language).toBe("en");
});
