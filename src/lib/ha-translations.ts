import { z } from "zod";
import type { Connection } from "home-assistant-js-websocket";

/** Flattened Home Assistant translation resources, keyed like `component.<platform>.entity.<domain>.<translation_key>.name`. */
export type HaTranslations = Readonly<Record<string, string>>;
export const noTranslations: HaTranslations = Object.freeze({});
/** The catalogue's language, stored beside the resources (no Home Assistant key starts with "@"). */
export const translationLanguage = "@language";

// "entity" holds integration names and states by translation_key; "entity_component" holds core-domain states.
// The legacy "state" category is empty on current Home Assistant releases.
const categories = ["entity", "entity_component"] as const;
const response = z.object({ resources: z.record(z.string(), z.unknown()) });
// Only names and state labels are used; skip the rest of the catalogue.
const used = /\.(name|state\.[^.]+)$/;

export async function fetchTranslations(conn: Connection, language: string): Promise<HaTranslations> {
  const results = await Promise.all(categories.map(category => conn.sendMessagePromise({ type: "frontend/get_translations", language, category })));
  const resources: Record<string, string> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(response.parse(result).resources)) {
      if (typeof value === "string" && value.trim() && used.test(key)) resources[key] = value;
    }
  }
  resources[translationLanguage] = language;
  return Object.freeze(resources);
}
