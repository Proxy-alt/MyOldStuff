import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

const dbPath: string = path.join(__dirname, '..', 'data', 'users.db');
const dbDir: string = path.dirname(dbPath);

/**
 * User database record interface.
 * Represents a user account in the system.
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  /** Email address (unique) */
  email: string;
  /** Hashed password */
  password_hash: string;
  /** Optional username */
  username: string | null;
  /** User biography */
  bio: string | null;
  /** Avatar image URL */
  avatar_url: string | null;
  /** Timestamp when user was created */
  created_at: number;
  /** Timestamp when user was last updated */
  updated_at: number;
  /** Email verification status (SQLite uses 0/1 for booleans) */
  email_verified: number;
  /** Admin status flag (0=user, 1=admin, 2=super admin, 3=full admin) */
  is_admin: number;
  /** Optional school affiliation */
  school: string | null;
  /** Optional age */
  age: number | null;
  /** User IP address */
  ip: string | null;
}

/**
 * User session record interface.
 * Represents an active user session.
 */
export interface UserSession {
  /** Unique session identifier */
  session_id: string;
  /** Foreign key referencing the user */
  user_id: string;
  /** Timestamp when session was created */
  created_at: number;
  /** Timestamp when session expires */
  expires_at: number;
}

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/** The better-sqlite3 database instance */
const db: Database.Database = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT,
    bio TEXT,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

try {
  const tableInfo = db.prepare('PRAGMA table_info(users)').all();
  const columnNames: string[] = tableInfo.map((col: any) => col.name);
  const hasExistingUsers: boolean = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count > 0;

  if (!columnNames.includes('email_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
    if (hasExistingUsers) {
      db.exec('UPDATE users SET email_verified = 1');
    }
  }
  if (!columnNames.includes('verification_token')) {
    db.exec('ALTER TABLE users ADD COLUMN verification_token TEXT');
  }
  if (!columnNames.includes('is_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('school')) {
    db.exec('ALTER TABLE users ADD COLUMN school TEXT');
  }
  if (!columnNames.includes('age')) {
    db.exec('ALTER TABLE users ADD COLUMN age INTEGER');
  }
  if (!columnNames.includes('ip')) {
    db.exec('ALTER TABLE users ADD COLUMN ip TEXT');
  }
} catch (error) {
  console.error('Migration error:', error);
}

/**
 * Initialize database tables for changelogs, feedback, user settings, sessions, comments, and likes.
 * Also creates indexes for commonly queried columns.
 */
db.exec(`

  CREATE TABLE IF NOT EXISTS changelog (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    localstorage_data TEXT,
    theme TEXT DEFAULT 'dark',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(type, target_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
`);

export default db;
