const familyPaths = ["/", "/calendar", "/lists", "/school"];
export const isHomeSection = (path: string) => !familyPaths.includes(path) && !["/user-settings", "/onboarding"].includes(path);
