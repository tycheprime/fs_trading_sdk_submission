import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '.data', 'sessions');

function estimateKey(estimate) {
  if (!estimate) return '';
  return JSON.stringify({
    p: estimate.pointEstimate,
    t: estimate.distributionType,
    l: estimate.low,
    h: estimate.high,
    c: estimate.changedMind,
  });
}

async function maybeRecordForecast(db, marketId, session, meta = {}) {
  if (!session?.lastEstimate) return;
  const last = await db.query(
    `SELECT estimate FROM agent_forecasts
     WHERE market_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [String(marketId)],
  );
  const key = estimateKey(session.lastEstimate);
  if (last.rowCount > 0 && estimateKey(last.rows[0].estimate) === key) return;

  await db.query(
    `INSERT INTO agent_forecasts
       (market_id, estimate, new_source_count, skipped, source_count)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      String(marketId),
      session.lastEstimate,
      meta.newSourceCount ?? 0,
      meta.skipped ?? false,
      session.sources?.length ?? 0,
    ],
  );
}

export async function readSession(marketId) {
  const db = await getPool();
  if (db) {
    const res = await db.query(
      'SELECT payload, updated_at FROM agent_sessions WHERE market_id = $1',
      [String(marketId)],
    );
    if (res.rowCount === 0) return null;
    return {
      session: res.rows[0].payload,
      updatedAt: new Date(res.rows[0].updated_at).getTime(),
    };
  }
  try {
    const raw = await readFile(path.join(DATA_DIR, `${marketId}.json`), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.session) return parsed;
    return { session: parsed, updatedAt: parsed.updatedAt ?? Date.now() };
  } catch {
    return null;
  }
}

export async function writeSession(marketId, payload, meta = {}) {
  const db = await getPool();
  if (db) {
    await db.query(
      `INSERT INTO agent_sessions (market_id, payload, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (market_id) DO UPDATE SET payload = $2, updated_at = now()`,
      [String(marketId), payload],
    );
    if (meta.recordForecast !== false) {
      await maybeRecordForecast(db, marketId, payload, meta);
    }
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  const envelope = { session: payload, updatedAt: Date.now() };
  await writeFile(
    path.join(DATA_DIR, `${marketId}.json`),
    JSON.stringify(envelope, null, 0),
  );
}

export async function bulkWriteSessions(sessions, meta = {}) {
  const db = await getPool();
  if (!db) {
    for (const session of sessions) {
      await writeSession(session.marketId, session, meta);
    }
    return { written: sessions.length };
  }
  let written = 0;
  for (const session of sessions) {
    if (!session?.marketId) continue;
    await writeSession(session.marketId, session, { ...meta, recordForecast: true });
    written += 1;
  }
  return { written };
}

export async function listSummaries() {
  const db = await getPool();
  if (db) {
    const res = await db.query(
      `SELECT market_id,
              payload->'lastEstimate' AS estimate,
              updated_at
       FROM agent_sessions
       WHERE payload->'lastEstimate' IS NOT NULL
       ORDER BY updated_at DESC`,
    );
    return res.rows.map((row) => {
      const est = row.estimate;
      return {
        marketId: row.market_id,
        changedMind: est?.changedMind === true,
        updatedAt: new Date(row.updated_at).getTime(),
        pointEstimate: est?.pointEstimate ?? null,
        distributionType: est?.distributionType ?? null,
        confidence: est?.confidence ?? null,
        sourceCount: null,
      };
    });
  }
  let files = [];
  try {
    files = await readdir(DATA_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const id = f.replace(/\.json$/, '');
    const row = await readSession(id);
    const session = row?.session;
    const est = session?.lastEstimate;
    if (!est) continue;
    out.push({
      marketId: id,
      changedMind: est.changedMind === true,
      updatedAt: row.updatedAt ?? Date.now(),
      pointEstimate: est.pointEstimate ?? null,
      distributionType: est.distributionType ?? null,
      confidence: est.confidence ?? null,
      sourceCount: session.sources?.length ?? 0,
    });
  }
  return out;
}

export async function listForecastHistory(marketId, limit = 30) {
  const db = await getPool();
  if (!db) return [];
  const res = await db.query(
    `SELECT id, estimate, new_source_count, skipped, source_count, created_at
     FROM agent_forecasts
     WHERE market_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [String(marketId), Math.min(Math.max(limit, 1), 100)],
  );
  return res.rows.map((row) => ({
    id: Number(row.id),
    estimate: row.estimate,
    newSourceCount: row.new_source_count,
    skipped: row.skipped,
    sourceCount: row.source_count,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function getGlobalStats() {
  const db = await getPool();
  if (!db) {
    const summaries = await listSummaries();
    return {
      marketsWithForecasts: summaries.length,
      totalForecasts: summaries.length,
      revisedMarkets: summaries.filter((s) => s.changedMind).length,
    };
  }
  const res = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM agent_sessions WHERE payload->'lastEstimate' IS NOT NULL) AS markets_with_forecasts,
      (SELECT COUNT(*)::int FROM agent_forecasts) AS total_forecasts,
      (SELECT COUNT(DISTINCT market_id)::int FROM agent_forecasts WHERE (estimate->>'changedMind')::boolean = true) AS revised_markets
  `);
  const row = res.rows[0];
  return {
    marketsWithForecasts: row.markets_with_forecasts,
    totalForecasts: row.total_forecasts,
    revisedMarkets: row.revised_markets,
  };
}
