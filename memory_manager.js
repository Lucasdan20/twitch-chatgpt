// memory_manager.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import fs from "fs";

export class MemoryManager {
  constructor(channelName) {
    this.channelName = channelName.toLowerCase().replace("#", "");
    this.dbPath = path.resolve("memory", `${this.channelName}.db`);
    this.db = null;
  }

  async init() {
    // Garante que a pasta exista
    if (!fs.existsSync("memory")) {
      fs.mkdirSync("memory");
      console.log("📁 Pasta 'memory' criada com sucesso!");
    }

    // Abre ou cria o banco
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    // Cria tabela se não existir
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log(`🧠 Banco de memória pronto para o canal: ${this.channelName}`);
  }

  // Salva mensagens
  async saveMessage(username, message) {
    if (!this.db) await this.init();
    await this.db.run("INSERT INTO memories (username, message) VALUES (?, ?)", [
      username,
      message,
    ]);
    console.log(`💾 [${this.channelName}] Mensagem salva: ${username}: "${message}"`);
  }

  // Recupera últimas mensagens (para contexto)
  async getRecentMessages(limit = 10) {
    if (!this.db) await this.init();
    const rows = await this.db.all(
      "SELECT username, message FROM memories ORDER BY id DESC LIMIT ?",
      [limit]
    );
    console.log(`📜 [${this.channelName}] Carregando ${rows.length} mensagens anteriores.`);
    return rows.reverse(); // do mais antigo pro mais novo
  }
}
