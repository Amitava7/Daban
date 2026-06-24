// Async UCI client for the native Stockfish module. This is the future engine
// backend; for now it is exercised only by stockfishSelfTest() so we can
// confirm, on the real device, that the native build runs and how fast it is.
//
// The engine is intentionally NOT wired into gameplay yet — the existing JS
// engine stays in charge until Stockfish is verified on-device.
import StockfishNative from '../../modules/expo-stockfish';
import { dlog } from '../utils/debugLog';

type Listener = (line: string) => void;

export interface SearchResult {
  bestmove: string;       // e.g. "e2e4" (UCI long algebraic)
  scoreCp: number | null; // centipawns from side-to-move's POV
  mate: number | null;    // mate-in-N if forced mate seen
  depth: number;
  nodes: number;
  nps: number;            // nodes/sec reported by the engine
}

class StockfishUci {
  private started = false;
  private listeners: Listener[] = [];
  private sub: { remove: () => void } | null = null;

  get available(): boolean {
    return !!StockfishNative;
  }

  start(): boolean {
    if (!StockfishNative) return false;
    if (this.started) return true;
    this.sub = StockfishNative.addListener('onMessage', (e: { line: string }) => {
      for (const l of [...this.listeners]) l(e.line);
    });
    const ok = StockfishNative.start();
    this.started = !!ok;
    return this.started;
  }

  send(cmd: string): void {
    StockfishNative?.write(cmd);
  }

  onLine(l: Listener): () => void {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter(x => x !== l); };
  }

  private waitFor(pred: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error('uci timeout')); }, timeoutMs);
      const off = this.onLine((line) => {
        if (pred(line)) { clearTimeout(timer); off(); resolve(line); }
      });
    });
  }

  async init(): Promise<void> {
    this.start();
    this.send('uci');
    await this.waitFor(l => l.startsWith('uciok'), 8000);
    this.send('isready');
    await this.waitFor(l => l.startsWith('readyok'), 8000);
  }

  // Idempotent: initialise the engine once (and configure threads for the
  // S24 Ultra's cores). All callers can `await ensureReady()` cheaply.
  private readyPromise: Promise<void> | null = null;
  ensureReady(): Promise<void> {
    if (!this.available) return Promise.reject(new Error('stockfish unavailable'));
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await this.init();
        this.setThreads(4);
      })();
    }
    return this.readyPromise;
  }

  newGame(): void {
    this.send('ucinewgame');
  }

  // Limit playing strength to a target Elo (Stockfish supports ~1320–3190).
  // Pass null to play at full strength (used for analysis).
  setStrengthElo(elo: number | null): void {
    if (elo === null) {
      this.send('setoption name UCI_LimitStrength value false');
    } else {
      const clamped = Math.max(1320, Math.min(3190, Math.round(elo)));
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${clamped}`);
    }
  }

  setThreads(n: number): void {
    this.send(`setoption name Threads value ${Math.max(1, Math.round(n))}`);
  }

  async bestMove(fen: string, opts: { movetime?: number; depth?: number } = {}): Promise<SearchResult> {
    let scoreCp: number | null = null;
    let mate: number | null = null;
    let depth = 0, nodes = 0, nps = 0;

    const off = this.onLine((line) => {
      if (!line.startsWith('info')) return;
      const d = line.match(/ depth (\d+)/); if (d) depth = +d[1];
      const n = line.match(/ nodes (\d+)/); if (n) nodes = +n[1];
      const p = line.match(/ nps (\d+)/); if (p) nps = +p[1];
      const cp = line.match(/ score cp (-?\d+)/); if (cp) { scoreCp = +cp[1]; mate = null; }
      const m = line.match(/ score mate (-?\d+)/); if (m) { mate = +m[1]; }
    });

    this.send('position fen ' + fen);
    this.send(opts.movetime ? `go movetime ${opts.movetime}` : `go depth ${opts.depth ?? 14}`);
    const line = await this.waitFor(l => l.startsWith('bestmove'), (opts.movetime ?? 0) + 20000);
    off();
    return { bestmove: line.split(/\s+/)[1] ?? '', scoreCp, mate, depth, nodes, nps };
  }
}

export const Stockfish = new StockfishUci();

// One-shot on-device benchmark. Logs to the existing debug log so the result
// can be shared from the in-app "View debug log" button.
export async function stockfishSelfTest(): Promise<void> {
  if (!Stockfish.available) {
    dlog('sf', 'native Stockfish module NOT available (JS engine still in use)');
    return;
  }
  try {
    const t0 = Date.now();
    await Stockfish.init();
    dlog('sf', `init ok in ${Date.now() - t0}ms`);
    // Use several cores; the S24 Ultra has 8.
    Stockfish.setThreads(6);

    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const t1 = Date.now();
    const r = await Stockfish.bestMove(start, { movetime: 1000 });
    dlog('sf', `1s search: bestmove=${r.bestmove} depth=${r.depth} nodes=${r.nodes} nps=${r.nps} score=${r.scoreCp} (${Date.now() - t1}ms)`);

    const mid = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4';
    const t2 = Date.now();
    const r2 = await Stockfish.bestMove(mid, { movetime: 1000 });
    dlog('sf', `1s midgame: bestmove=${r2.bestmove} depth=${r2.depth} nodes=${r2.nodes} nps=${r2.nps} (${Date.now() - t2}ms)`);
  } catch (e) {
    dlog('sf', 'selftest error: ' + String(e));
  }
}
