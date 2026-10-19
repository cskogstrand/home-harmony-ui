import { expect, it } from "vitest";
import { memberPalette, memberColorForeground } from "@/lib/member-colors";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";

it("accepts preset and custom colors, rejects unsafe values, and defaults older backups", () => {
  const config = emptyConfiguration();
  delete config.settings.memberColors;
  expect(parseConfiguration(JSON.stringify(config)).settings.memberColors).toEqual({});
  for (const color of [...memberPalette.map(preset => preset.color), "#000000", "#FFFFFF", "#123ABC"]) {
    config.settings.memberColors = { "home|person.example": color };
    expect(parseConfiguration(JSON.stringify(config)).settings.memberColors).toEqual(config.settings.memberColors);
  }
  for (const color of ["red", "#abc", "#12345678", "url(https://example.test)", "#gggggg", ""]) {
    config.settings.memberColors = { "home|person.example": color };
    expect(() => parseConfiguration(JSON.stringify(config))).toThrow();
  }
  config.settings.memberColors = JSON.parse('{"__proto__":"#123456"}');
  expect(() => parseConfiguration(JSON.stringify(config))).toThrow();
});

it("keeps avatar text at AA contrast across the RGB range and all twelve distinct presets", () => {
  expect(new Set(memberPalette.map(preset => preset.color)).size).toBe(12);
  const colors = memberPalette.map(preset => preset.color as string);
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    colors.push(`#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("")}`);
  }
  for (const color of colors) {
    const channels = color.slice(1).match(/../g)!.map(hex => parseInt(hex, 16) / 255);
    const luminance = channels.reduce((sum, channel, index) => sum + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4), 0);
    const contrast = memberColorForeground(color) === "#000000" ? (luminance + 0.05) / 0.05 : 1.05 / (luminance + 0.05);
    expect(contrast, color).toBeGreaterThanOrEqual(4.5);
  }
});
