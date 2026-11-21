import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DataStore } from "../../shared/types.js";
import { SEED_DATA } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, "../../data");
export const STORE_PATH = path.join(DATA_DIR, "store.json");

function freshStore(): DataStore {
  return {
    ...structuredClone(SEED_DATA),
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