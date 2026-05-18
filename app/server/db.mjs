import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanEnvValue(value) {
  let s = (value || '').trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('"')) s = s.slice(1);
  if (s.endsWith('"')) s = s.slice(0, -1);
  return s.trim();
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    if (process.env[key]) continue;
    process.env[key] = cleanEnvValue(t.slice(i + 1));
  }
}

/** Load app/.env and app/.env.local when running the server outside Render. */
export function loadAppEnv() {
  const root = path.join(__dirname, '..');
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, '.env.local'));
}

function cleanConnectionString(value) {
  return cleanEnvValue(value);
}

function isValidPostgresUrl(value) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'postgresql:' || u.protocol === 'postgres:';
  } catch {
    return false;
  }
}

function buildUrlFromParts() {
  const host = cleanEnvValue(process.env.DB_HOSTNAME);
  const user = cleanEnvValue(process.env.DB_USERNAME);
  const db = cleanEnvValue(process.env.DB_DATABASE);
  if (!host || !user || !db) return '';
  const port = cleanEnvValue(process.env.DB_PORT) || '5432';
  const pass = encodeURIComponent(cleanEnvValue(process.env.DB_PASSWORD || ''));
  if (!host.includes('.') && !host.includes('localhost')) {
    return '';
  }
  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

export function resolveDatabaseUrl() {
  for (const candidate of [
    process.env.DATABASE_URL,
    process.env.DB_URL,
    buildUrlFromParts(),
  ]) {
    const cleaned = cleanConnectionString(candidate);
    if (isValidPostgresUrl(cleaned)) return cleaned;
  }
  return '';
}

let pool = null;

export async function getPool() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) return null;
  if (pool) return pool;
  const pg = await import('pg');
  pool = new pg.default.Pool({
    connectionString,
    ssl: /render\.com|sslmode=require/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      market_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS agent_forecasts (
      id BIGSERIAL PRIMARY KEY,
      market_id TEXT NOT NULL,
      estimate JSONB NOT NULL,
      new_source_count INT NOT NULL DEFAULT 0,
      skipped BOOLEAN NOT NULL DEFAULT false,
      source_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS agent_forecasts_market_created
      ON agent_forecasts (market_id, created_at DESC);
  `);
  return pool;
}

export function storageMode() {
  return resolveDatabaseUrl() ? 'postgres' : 'file';
}
