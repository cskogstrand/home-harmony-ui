const familyPaths = ["/", "/calendar", "/lists", "/school"];
export const mainPaths = [...familyPaths, "/home"];
export const mainPagePath = (path: string) => mainPaths.find(page => page === (path.replace(/\/+$/, "") || "/").toLowerCase());
export const isMainPage = (path: string) => !!mainPagePath(path);
export const isHomeSection = (path: string) => !familyPaths.includes(mainPagePath(path) ?? path) && path !== "/settings" && !path.startsWith("/settings/") && !["/user-settings", "/onboarding"].includes(path);
