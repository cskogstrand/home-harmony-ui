import { useEffect, useState } from "react";
import { z } from "zod";
import appConfig from "../../config.yaml?raw";

export const appVersion = appConfig.match(/^version:\s*["']?([^"'\s]+)/m)![1];
const versionSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) });

export function useAppUpdate() {
  const [availableVersion, setAvailableVersion] = useState<string>();
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let controller: AbortController | undefined;
    const check = async () => {
      if (document.hidden || controller) return;
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 10000);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store", signal: request.signal });
        if (!response.ok) return;
        const result = versionSchema.safeParse(await response.json());
        if (!request.signal.aborted && result.success) {
          setAvailableVersion(result.data.version !== appVersion ? result.data.version : undefined);
        }
      } catch {
        // A sleeping screen or restarting server must not clear a known update.
      } finally {
        window.clearTimeout(timeout);
        controller = undefined;
      }
    };
    void check();
    const timer = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    window.addEventListener("vite:preloadError", check);
    return () => {
      window.clearInterval(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.removeEventListener("vite:preloadError", check);
    };
  }, []);
  return availableVersion;
}
