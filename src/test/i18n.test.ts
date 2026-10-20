import { describe, expect, it } from "vitest";
import { createI18n, MessageError, msg } from "@/lib/i18n";
import { nb } from "@/locales/nb";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";
import { entityStateLabel, mapHome, emptyRegistries } from "@/lib/ha-model";
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
});
