import fs from "fs";
import path from "path";

let sqlite3;
try {
  sqlite3 = await import("sqlite3");
  console.log("✅ Usando sqlite3");
} catch (err) {
  console.warn("⚠️ sqlite3 não encontrado, usando better-sqlite3...");
  sqlite3 = await import("better-sqlite3");
}

const { Database } = sqlite3.verbose ? sqlite3.verbose() : sqlite3;

export class MemoryManager {
  constructor(channelName) {
    const dir = path.join(process.cwd(), "memory");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    this.dbPath = path.join(dir, `${channelName}.db`);
    this.db = new Database(this.dbPath);

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          summary TEXT,
          history TEXT
        )`
      )
      .run();
  }

  getUser(username) {
    const row = this.db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username);
    if (row) {
      return {
        summary: row.summary || "",
        history: JSON.parse(row.history || "[]"),
      };
    }
    return { summary: "", history: [] };
  }

  saveUser(username, summary, history) {
    const histJson = JSON.stringify(history);
    this.db
      .prepare(
        `INSERT INTO users (username, summary, history)
         VALUES (?, ?, ?)
         ON CONFLICT(username)
         DO UPDATE SET summary = excluded.summary, history = excluded.history`
      )
      .run(username, summary, histJson);
  }
}
