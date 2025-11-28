import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export async function initDb() {
  if (db) return;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "terminal.db");
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      service_url TEXT NOT NULL,
      github_url TEXT,
      container_name TEXT,
      port INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // For existing databases created before container_name was added, attempt to add the column.
  try {
    db.exec("ALTER TABLE modules ADD COLUMN container_name TEXT;");
  } catch (err) {
    // Ignore error if the column already exists.
  }

  // For existing databases, attempt to add type and port columns.
  try {
    db.exec("ALTER TABLE modules ADD COLUMN type TEXT;");
  } catch (err) {
    // Ignore if it already exists.
  }

  try {
    db.exec("ALTER TABLE modules ADD COLUMN port INTEGER;");
  } catch (err) {
    // Ignore if it already exists.
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS module_types (
      id TEXT PRIMARY KEY,
      github_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
