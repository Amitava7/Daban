import { PieceData } from '../components/Board';

export function fenToPieces(fen: string): Record<string, PieceData> {
  const board = fen.split(' ')[0];
  const pieces: Record<string, PieceData> = {};
  let rank = 8;
  let file = 0;
  let idx = 0;
  for (const ch of board) {
    if (ch === '/') { rank--; file = 0; continue; }
    if (ch >= '1' && ch <= '8') { file += parseInt(ch); continue; }
    const sq = `${'abcdefgh'[file]}${rank}`;
    const color = ch === ch.toUpperCase() ? 'w' : 'b';
    const type = ch.toUpperCase();
    const code = color + type;
    pieces[`${sq}_${idx}`] = { sq, code };
    file++;
    idx++;
  }
  return pieces;
}
