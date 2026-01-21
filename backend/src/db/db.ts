import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '../config.js'

let dbSingleton: Database.Database | null = null

export const getDb = () => {
  if (dbSingleton) return dbSingleton
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })
  const db = new Database(config.dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  dbSingleton = db
  return db
}

