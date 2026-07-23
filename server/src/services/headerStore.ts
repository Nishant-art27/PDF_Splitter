import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Classification headers are per-user configuration: each account keeps
 * its own list, keyed by its loginId (email), so it survives logout and
 * server restarts and never affects anyone else. Persisted in a JSON
 * file — the only things this app stores on disk are configuration.
 */
const CONFIG_DIR = path.resolve(__dirname, "../../config");
const CONFIG_FILE = path.join(CONFIG_DIR, "headers.json");

const BUILTIN_DEFAULTS = [
  "CT CASES",
  "CC NI ACT",
  "MISC CRL",
  "CT CASES CC NI ACT MISC CRL",
  "CS DJ",
  "CS",
  "ARBTN",
  "EX. CIVIL",
  "CONTEMPT PETITION",
  "MISC DJ",
  "RCA DJ",
  "EX CIVIL",
  "RCA SCJ",
  "RCA",
  "BAIL MATTERS",
  "SC",
  "CR CASES",
  "CR CASE NO.",
  "CT CASE NO.",
  "CS SCJ",
  "RC SCJ",
  "EX",
  "RC ARC",
  "EXECUTION (COMM.)",
  "OMP(I)(COMM)",
  "OMP(I)(COMM.)",
  "OMP (I) (COMM.)",
  "EX.COMM – AWARD BY ARB. COMM.",
  "SC NO.",
  "CA",
  "CS (COMM)",
  "OMP (COMM.)",
  "EX.COMM - AWARD BY ARB. COMM.",
  "COUNTER CLAIM",
  "OMP (I)(COMM.)",
  "CS (COMM.)",
  "MISC",
  "MCA SCJ",
  "IA",
  "TC",
  "L I R",
  "L I D",
  "LCA",
  "CT. CASES",
  "CC NO",
  "CC NO.",
  "$$$",
  "COMM",
  "CS COMM",
  "OMP (I) COMM",
  "OMP (COMM)",
  "EXECUTION (COMM)",
  "EX COMM",
  "MISC SCJ",
  "DD NO.",
  "CR CASE",
  "BAIL MATTER",
  "IA NO.",
  "CA NO.",
  "CR. REV. NO.",
  "LC",
  "L C A",
  "CT CASES, CC NI ACT",
  "ABCD",
  "MCA DJ",
  "MISC. DJ",
];

/**
 * The default list can be overridden with a DEFAULT_HEADERS environment
 * variable — pipe-separated if it contains "|" (needed because some
 * headers contain commas), otherwise comma-separated. Useful on hosts
 * without a permanent disk (Render free tier), where dashboard env vars
 * survive restarts while file edits do not.
 */
const rawEnv = process.env.DEFAULT_HEADERS ?? "";
const fromEnv = rawEnv
  .split(rawEnv.includes("|") ? "|" : ",")
  .map((h) => h.trim())
  .filter((h) => h.length > 0);

export const DEFAULT_HEADERS = fromEnv.length > 0 ? fromEnv : BUILTIN_DEFAULTS;

interface HeaderConfig {
  /** loginId -> that user's header list */
  users: Record<string, string[]>;
}

async function readConfig(): Promise<HeaderConfig> {
  try {
    const parsed = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
    if (parsed && typeof parsed.users === "object" && parsed.users !== null) {
      const users: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(parsed.users)) {
        if (Array.isArray(value)) {
          users[key] = value.filter((h): h is string => typeof h === "string");
        }
      }
      return { users };
    }
  } catch {
    // missing or malformed (including the pre-per-user format) — start fresh
  }
  return { users: {} };
}

/**
 * Writes go through a queue so two users saving at the same moment can't
 * overwrite each other's read-modify-write, and via temp-file + rename so
 * a concurrent reader never sees a half-written file.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

async function writeConfig(config: HeaderConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(config, null, 2), "utf8");
  await fs.rename(tmp, CONFIG_FILE);
}

/** A user who has never saved their own list gets the defaults. */
export async function getHeadersForUser(loginId: string): Promise<string[]> {
  const config = await readConfig();
  return config.users[loginId] ?? DEFAULT_HEADERS;
}

export async function saveHeadersForUser(loginId: string, headers: string[]): Promise<string[]> {
  const cleaned = [...new Set(headers.map((h) => h.trim()).filter((h) => h.length > 0))];
  return serialized(async () => {
    const config = await readConfig();
    config.users[loginId] = cleaned;
    await writeConfig(config);
    return cleaned;
  });
}
