// In-memory ring-buffer logger used to instrument the chess move pipeline and
// surface the exact sequence of state changes around the "ghost piece" bug.
// The Debug button on the game screen reads getLogsText() and copies it to the
// clipboard so the user can paste a full trace.

const MAX_ENTRIES = 800;

interface LogEntry {
  ts: number;       // ms since epoch
  rel: number;      // ms since first log
  tag: string;
  msg: string;
}

let entries: LogEntry[] = [];
let t0: number | null = null;

function fmtTime(rel: number): string {
  // mm:ss.mmm relative to first log
  const total = Math.max(0, rel);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function dlog(tag: string, msg: string): void {
  const now = Date.now();
  if (t0 === null) t0 = now;
  const rel = now - t0;
  entries.push({ ts: now, rel, tag, msg });
  // Drop the oldest entry once we exceed capacity. Slice rather than shift to
  // keep this O(1)-ish on average for a small fixed overhead.
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
  // Also stream to console so they're visible in `npx expo start` / Flipper.
  // eslint-disable-next-line no-console
  console.log(`[${tag}] ${msg}`);
}

export function getLogsText(): string {
  if (entries.length === 0) return '(no log entries yet)';
  const header = `Daban debug log\n${new Date(entries[0].ts).toISOString()} → ${new Date(entries[entries.length - 1].ts).toISOString()}\n${entries.length} entries\n${'-'.repeat(64)}\n`;
  const body = entries.map(e => `${fmtTime(e.rel)} [${e.tag}] ${e.msg}`).join('\n');
  return header + body;
}

export function getLogsCount(): number {
  return entries.length;
}

export function clearLogs(): void {
  entries = [];
  t0 = null;
}
