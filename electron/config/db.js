import sqljs from "sql.js";
import fs from "fs";
import path from "path";
import electron from "electron";
import migration1 from "./migrations/01-inital.js";

const dbPath = path.join(electron.app.getPath("userData"), "app.db");

let db;

const migrations = [migration1];

async function migrate(db) {
  const result = db.exec("PRAGMA user_version");

  const currentVersion = result[0]?.values[0]?.[0] ?? 0;

  const pendingMigrations = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pendingMigrations) {
    console.log(`Running migration ${migration.version}`);

    db.run("BEGIN TRANSACTION");

    try {
      migration.up(db);

      db.run(`PRAGMA user_version = ${migration.version}`);

      db.run("COMMIT");

      console.log(`Migration ${migration.version} completed`);
    } catch (error) {
      db.run("ROLLBACK");

      throw new Error(
        `Migration ${migration.version} failed: ${error.message}`
      );
    }
  }
}

export async function connect() {
  try {
    const SQL = await sqljs();

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    await migrate(db);

    saveDb(db);

    console.log("Database connected");

    return db;
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
}

export function saveDb(db) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export default () => db;
