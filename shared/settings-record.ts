import { z } from "zod";

export function settingsRecord<K extends z.ZodType<string, string>, V extends z.ZodType>(key: K, value: V) {
  const record = z.partialRecord(key, value);
  return z.preprocess((input: z.input<typeof record>, ctx) => {
    // Zod skips __proto__ before the key schema can reject it.
    if (input && Object.prototype.hasOwnProperty.call(input, "__proto__")) {
      ctx.addIssue({ code: "custom", path: ["__proto__"] });
    }
    return input;
  }, record);
}
