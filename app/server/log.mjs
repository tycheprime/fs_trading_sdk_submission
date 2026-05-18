/** Structured logs for Render (grep JSON in dashboard → Logs). */
export function agentLog(level, msg, meta = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}
