import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { MAX_TIMETABLE_BYTES, MAX_TIMETABLE_PAGES } from "../shared/timetables.ts";

const exec = promisify(execFile);
const failure = (status, message) => Object.assign(new Error(message), { status });

export async function convertTimetable(request, dataDir, person) {
  if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/pdf") throw failure(415, "Send the PDF as the request body with Content-Type: application/pdf.");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_TIMETABLE_BYTES) throw failure(413, "The timetable exceeds the 10 MB limit.");
    chunks.push(chunk);
  }
  const pdf = Buffer.concat(chunks);
  if (!pdf.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw failure(400, "Choose a valid PDF timetable.");
  const id = randomUUID();
  const directory = join(dataDir, "timetables", person, id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    const source = join(directory, "source.pdf");
    await writeFile(source, pdf, { mode: 0o600 });
    const { stdout } = await exec("pdfinfo", [source], { timeout: 5000, maxBuffer: 1024 * 1024, env: { ...process.env, LC_ALL: "C" } });
    const pages = Number(stdout.match(/^Pages:\s+(\d+)\s*$/m)?.[1]);
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_TIMETABLE_PAGES) throw failure(400, `Choose a PDF with 1–${MAX_TIMETABLE_PAGES} pages.`);
    if (/^Encrypted:\s+yes/m.test(stdout)) throw failure(400, "Choose a PDF without password protection.");
    await exec("pdftoppm", ["-png", "-scale-to", "2000", "-f", "1", "-l", String(pages), source, join(directory, "page")], { timeout: 30000, maxBuffer: 1024 * 1024 });
    const urls = [];
    for (let page = 1; page <= pages; page++) {
      const input = join(directory, `page-${String(page).padStart(String(pages).length, "0")}.png`);
      const contents = await readFile(input);
      if (!contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Missing rendered page");
      await rename(input, join(directory, `${page}.png`));
      const handle = await open(join(directory, `${page}.png`), "r");
      try { await handle.sync(); } finally { await handle.close(); }
      urls.push(`/api/timetables/${person}/${id}/${page}.png`);
    }
    const sourceHandle = await open(source, "r");
    try { await sourceHandle.sync(); } finally { await sourceHandle.close(); }
    for (const path of [directory, join(dataDir, "timetables", person), join(dataDir, "timetables")]) {
      const handle = await open(path, "r");
      try { await handle.sync(); } finally { await handle.close(); }
    }
    return { directory, urls };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    if (error.status) throw error;
    if (error.code === "ENOENT") throw failure(503, "PDF conversion is unavailable. Install Poppler on the dashboard server.");
    throw failure(400, "This PDF could not be converted. Use an unprotected PDF with at most 20 pages; the previous timetable was kept.");
  }
}
