// Async UCI client for the native Stockfish module — the app's chess engine.
// Wraps the native bridge (start/write/onMessage) in a small promise-based UCI
// API: init/ensureReady, strength control, best-move and MultiPV searches.
import StockfishNative from '../../modules/expo-stockfish';

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

  // Serialize engine access. The engine is a single UCI stream with one shared
  // output channel, so concurrent callers (coach move, move classification,
  // hints, refutation) must not interleave their position/go/bestmove cycles —
  // otherwise one search's `bestmove` gets attributed to another, producing
  // moves computed for the wrong position. Every search runs exclusively.
  private queue: Promise<unknown> = Promise.resolve();
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  // Apply strength inside a locked search so it's atomic with the go command.
  // `undefined` leaves the current setting untouched.
  private applyStrength(elo: number | null | undefined): void {
    if (elo !== undefined) this.setStrengthElo(elo);
  }

  async bestMove(
    fen: string,
    opts: { movetime?: number; depth?: number; elo?: number | null } = {},
  ): Promise<SearchResult> {
    return this.runExclusive(async () => {
      this.applyStrength(opts.elo);
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
    });
  }

  // Full principal variation (best play for BOTH sides) from a position.
  // Used to build the refutation line in a single search.
  async searchPv(
    fen: string,
    opts: { movetime: number; elo?: number | null },
  ): Promise<{ pv: string[]; scoreCp: number | null; mate: number | null }> {
    return this.runExclusive(async () => {
      this.applyStrength(opts.elo);
      let pv: string[] = [];
      let scoreCp: number | null = null;
      let mate: number | null = null;
      const off = this.onLine((line) => {
        if (!line.startsWith('info') || !line.includes(' pv ')) return;
        const m = line.match(/ pv (.+?)\s*$/);
        if (m) {
          pv = m[1].trim().split(/\s+/).filter(s => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s));
        }
        const cp = line.match(/ score cp (-?\d+)/); if (cp) { scoreCp = +cp[1]; mate = null; }
        const mt = line.match(/ score mate (-?\d+)/); if (mt) mate = +mt[1];
      });
      this.send('position fen ' + fen);
      this.send(`go movetime ${opts.movetime}`);
      await this.waitFor(l => l.startsWith('bestmove'), opts.movetime + 20000);
      off();
      return { pv, scoreCp, mate };
    });
  }

  // MultiPV search: returns the top `multipv` lines (rank 1 = best), each with
  // its first move (UCI) and side-to-move score. Used for hints.
  async searchMulti(
    fen: string,
    opts: { movetime: number; multipv: number; elo?: number | null },
  ): Promise<{ rank: number; uci: string; scoreCp: number | null; mate: number | null }[]> {
    return this.runExclusive(async () => {
      this.applyStrength(opts.elo);
      this.send(`setoption name MultiPV value ${opts.multipv}`);
      const lines = new Map<number, { uci: string; scoreCp: number | null; mate: number | null }>();
      const off = this.onLine((line) => {
        if (!line.startsWith('info') || !line.includes(' pv ')) return;
        const mpv = line.match(/ multipv (\d+)/);
        const rank = mpv ? +mpv[1] : 1;
        const pv = line.match(/ pv (\w+)/);
        if (!pv) return;
        let scoreCp: number | null = null;
        let mate: number | null = null;
        const cp = line.match(/ score cp (-?\d+)/); if (cp) scoreCp = +cp[1];
        const m = line.match(/ score mate (-?\d+)/); if (m) mate = +m[1];
        lines.set(rank, { uci: pv[1], scoreCp, mate });
      });
      this.send('position fen ' + fen);
      this.send(`go movetime ${opts.movetime}`);
      await this.waitFor(l => l.startsWith('bestmove'), opts.movetime + 20000);
      off();
      // Restore single-PV mode for subsequent searches.
      this.send('setoption name MultiPV value 1');
      return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([rank, v]) => ({ rank, ...v }));
    });
  }
}

export const Stockfish = new StockfishUci();
