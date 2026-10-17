export const MAX_TIMETABLE_BYTES = 10 * 1024 * 1024;
export const MAX_TIMETABLE_PAGES = 20;
export const timetableUploadPath = (planner: string, member: string) => `/api/timetables?${new URLSearchParams({ planner, member })}`;
export const timetableImagePath = /^\/api\/timetables\/([a-f0-9-]{36})\/([1-9]\d*)\.png$/;
