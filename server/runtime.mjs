import { loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { instanceUrlSchema } from "../shared/configuration.ts";

export async function runtimeOptions() {
  try { loadEnvFile(); } catch (error) { if (error.code !== "ENOENT") throw new Error("Cannot read .env."); }
  const dataDir = resolve(process.env.DATA_DIR ?? "data");
  let options = {};
  try { options = JSON.parse(await readFile(resolve(dataDir, "options.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw new Error("Cannot read HAOS app options."); }
  const homeAssistantUrl = process.env.HOME_ASSISTANT_URL ?? options.home_assistant_url;
  const configuredToken = process.env.HOME_ASSISTANT_TOKEN ?? options.home_assistant_token;
  const homeAssistantToken = typeof configuredToken === "string" ? configuredToken.trim() : configuredToken;
  const dashboardPassword = process.env.DASHBOARD_PASSWORD ?? options.dashboard_password;
  const timetableApiKey = process.env.TIMETABLE_API_KEY ?? options.timetable_api_key ?? "";
  const configuredAuthDisabled = process.env.DASHBOARD_AUTH_DISABLED ?? options.dashboard_auth_disabled ?? false;
  if (![true, false, "true", "false"].includes(configuredAuthDisabled)) throw new Error("Set DASHBOARD_AUTH_DISABLED (dashboard_auth_disabled in HAOS) to true or false.");
  const dashboardAuthDisabled = configuredAuthDisabled === true || configuredAuthDisabled === "true";
  const port = Number(process.env.PORT ?? 8099);
  if (!homeAssistantUrl || !instanceUrlSchema.safeParse(homeAssistantUrl).success) throw new Error("Set HOME_ASSISTANT_URL (home_assistant_url in HAOS) to an HTTP(S) origin without a trailing slash.");
  if (typeof homeAssistantToken !== "string" || !homeAssistantToken) throw new Error("Set HOME_ASSISTANT_TOKEN (home_assistant_token in HAOS) to a Home Assistant long-lived access token.");
  if (!/^[A-Za-z0-9._~-]{1,4096}$/.test(homeAssistantToken)) throw new Error("HOME_ASSISTANT_TOKEN (home_assistant_token in HAOS) contains invalid characters or exceeds 4096 characters. Paste only the long-lived access token, without quotes or a Bearer prefix.");
  if (!dashboardAuthDisabled && (typeof dashboardPassword !== "string" || dashboardPassword.length < 12 || /[\r\n]/.test(dashboardPassword))) throw new Error("Set DASHBOARD_PASSWORD (dashboard_password in HAOS) to at least 12 characters.");
  if (typeof timetableApiKey !== "string" || (timetableApiKey !== "" && !/^[A-Za-z0-9._~-]{32,4096}$/.test(timetableApiKey))) throw new Error("Set TIMETABLE_API_KEY (timetable_api_key in HAOS) to 32–4096 letters, digits, dots, underscores, tildes or hyphens, or leave it empty to disable API-key access.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  return { dataDir, homeAssistantUrl, homeAssistantToken, dashboardPassword, dashboardAuthDisabled, timetableApiKey, port };
}
