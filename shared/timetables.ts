export const MAX_TIMETABLE_BYTES = 10 * 1024 * 1024;
export const MAX_TIMETABLE_PAGES = 20;
export const timetableUploadPath = (member: string) => `/api/timetables?${new URLSearchParams({ member })}`;
export const timetableImagePath = /^\/api\/timetables\/([a-z0-9_]+)\/([a-f0-9-]{36})\/([1-9]\d*)\.png$/;
