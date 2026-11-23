import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DataStore } from "../../shared/types.js";
import { SEED_DATA } from "./seed.js";
import { seedShiftDays, shiftDateString } from "../../shared/clock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * Project-root `data/` dir, whether running from source (server/data) or the
 * compiled build (dist/server/data), so `npm run seed` and `npm start` share one store.
 */
function resolveDataDir(): string {
  if (process.env.DUESPILOT_DATA_DIR) return path.resolve(process.env.DUESPILOT_DATA_DIR);
  for (const up of ["../..", "../../.."]) {
    const root = path.resolve(__dirname, up);
    if (fs.existsSync(path.join(root, "package.json"))) return path.join(root, "data");
  }
  return path.resolve(__dirname, "../../data");
}
export const DATA_DIR = resolveDataDir();
export const STORE_PATH = path.join(DATA_DIR, "store.json");

/** Seed data re-anchored to the demo clock (see shared/clock.ts). */
export function seedForClock(days = seedShiftDays()): typeof SEED_DATA {
  const seed = structuredClone(SEED_DATA);
  for (const inv of seed.invoices) {
    inv.issuedAt = shiftDateString(inv.issuedAt, days);
    inv.dueAt = shiftDateString(inv.dueAt, days);
  }
  for (const th of seed.threads) {
    for (const m of th.messages) m.at = shiftDateString(m.at, days);
  }
  for (const ev of seed.calendar) ev.at = shiftDateString(ev.at, days);
  return seed;
}

function freshStore(): DataStore {
  return {
    ...seedForClock(),
    approvals: [],
    audits: [],
    runs: [],
    reminderLog: [],
    version: 1,
  };
}

export function loadStore(): DataStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const s = freshStore();
    saveStore(s);
    return s;
  }
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  return JSON.parse(raw) as DataStore;
}

export function saveStore(store: DataStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function resetStore(): DataStore {
  const s = freshStore();
  saveStore(s);
  return s;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}