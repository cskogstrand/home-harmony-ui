const familyPaths = ["/", "/calendar", "/lists", "/school"];
export const isMainPage = (path: string) => familyPaths.includes(path) || path === "/home";
export const isHomeSection = (path: string) => !familyPaths.includes(path) && !["/user-settings", "/onboarding"].includes(path);
