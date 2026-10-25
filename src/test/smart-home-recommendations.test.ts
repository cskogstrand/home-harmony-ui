import { expect, it } from "vitest";
import { recommendedMainEntity, recommendedSupportingEntities } from "@/lib/smart-home-recommendations";
import { cardEntity } from "./device-card-fixtures";

const source = (id: string, domain = "sensor", deviceClass?: string) => ({
  ...cardEntity(domain, "on", deviceClass ? { device_class: deviceClass } : {}),
  entityId: `${domain}.${id}`, preferenceId: `home|${id}`, name: id, device: { id: "example-device" },
});

it("recommends a main entity only when one available primary candidate is unambiguous", () => {
  const main = source("main", "light");
  const config = { ...source("config", "light"), category: "config" };
  const diagnostic = { ...source("diagnostic", "light"), category: "diagnostic" };
  expect(recommendedMainEntity([main, config, diagnostic])).toBe(main);
  expect(recommendedMainEntity([main, source("other", "light")])).toBeUndefined();
  expect(recommendedMainEntity([{ ...main, state: "unavailable" }, config])).toBeUndefined();
});

it("matches useful readings and statuses to the chosen card type", () => {
  const main = source("main", "switch");
  const power = source("power", "sensor", "power");
  const humidity = source("humidity", "sensor", "humidity");
  const door = source("door", "binary_sensor", "door");
  const all = [main, power, humidity, door];
  expect(recommendedSupportingEntities("switch", main, all, []).map(item => item.entity)).toEqual([power]);
  expect(recommendedSupportingEntities("climate", main, all, []).map(item => item.entity)).toEqual([humidity, power]);
  expect(recommendedSupportingEntities("lock", main, all, []).map(item => item.entity)).toEqual([door]);
});

it("uses only available sources from the same physical device and never guesses from names", () => {
  const main = source("main", "light");
  const battery = { ...source("battery", "sensor", "battery"), category: "diagnostic" };
  const unsafe = [
    { ...source("remote", "sensor", "power"), device: { id: "another-device" } },
    { ...source("offline", "sensor", "power"), state: "unavailable" },
    { ...source("unknown", "sensor", "power"), state: "unknown" },
    { ...source("configuration", "sensor", "power"), category: "config" },
    { ...source("diagnostic", "sensor", "power"), category: "diagnostic" },
    source("Power reading without metadata"), source("Reset device", "button"),
  ];
  expect(recommendedSupportingEntities("light", main, [main, battery, ...unsafe], [])).toEqual([{ entity: battery, reason: "Battery level from this device" }]);
  expect(recommendedSupportingEntities("light", { ...main, device: undefined }, [battery], [])).toEqual([]);
  expect(recommendedSupportingEntities("light", undefined, [battery], [])).toEqual([]);
});

it("does not recommend readings already supplied by the main entity or attached sources", () => {
  const main = { ...source("main", "climate"), attributes: { current_temperature: 20, current_humidity: 40, battery_level: 90 } };
  const selected = source("selected-power", "sensor", "power");
  const candidates = [source("temperature", "sensor", "temperature"), source("humidity", "sensor", "humidity"), source("battery", "sensor", "battery"), source("power", "sensor", "power")];
  expect(recommendedSupportingEntities("climate", main, [main, selected, ...candidates], [selected.preferenceId])).toEqual([]);
});

it("does not treat undisplayed attributes on a supporting reading as card content", () => {
  const main = source("main", "light");
  const reading = { ...source("power", "sensor", "power"), attributes: { device_class: "power", battery_level: 75 } };
  const battery = source("battery", "sensor", "battery");
  expect(recommendedSupportingEntities("light", main, [reading, battery], [reading.preferenceId]).map(item => item.entity)).toEqual([battery]);
});

it("suggests a robot image without duplicating an attached image and keeps the list bounded", () => {
  const main = source("main", "vacuum");
  const map = source("map", "image");
  expect(recommendedSupportingEntities("vacuum", main, [main, map], []).map(item => item.entity)).toEqual([map]);
  expect(recommendedSupportingEntities("vacuum", main, [main, map, source("another-map", "image")], [map.preferenceId])).toEqual([]);
  const readings = Array.from({ length: 8 }, (_, i) => source(`power-${i}`, "sensor", "power"));
  expect(recommendedSupportingEntities("vacuum", main, readings, [])).toHaveLength(4);
  expect(recommendedSupportingEntities("vacuum", main, [...readings].reverse(), [])).toEqual(recommendedSupportingEntities("vacuum", main, readings, []));
});
