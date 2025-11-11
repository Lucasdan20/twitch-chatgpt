import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export class MemoryManager {
  constructor(channel) {
    const dir = path.join(process.cwd(), "memory");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const file = path.join(dir, `${channel}.db`);
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS user_memory (
        username TEXT PRIMARY KEY,
        summary TEXT,
        history TEXT
      )
    `).run();
  }

  getUser(username) {
    const row = this.db.prepare("SELECT * FROM user_memory WHERE username = ?").get(username);
    return row
      ? { summary: row.summary || "", history: JSON.parse(row.history || "[]") }
      : { summary: "", history: [] };
  }

  saveUser(username, summary, history) {
    const stmt = this.db.prepare(`
      INSERT INTO user_memory (username, summary, history)
      VALUES (@username, @summary, @history)
      ON CONFLICT(username) DO UPDATE SET summary=@summary, history=@history
    `);
    stmt.run({ username, summary, history: JSON.stringify(history) });
  }
}

