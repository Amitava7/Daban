import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Svg, { Line, Polygon } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { ChessPiece } from './ChessPiece';
import { dlog } from '../utils/debugLog';

const MOVE_DURATION = 220;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

export interface PieceData {
  id?: string;          // stable identity across moves (optional for static boards)
  sq: string;
  code: string;
  captured?: boolean;
}

export interface Highlight {
  sq: string;
  kind: 'good' | 'bad' | 'warn' | 'brand' | 'selected' | 'legal' | 'lastmove';
}

/** Coaching arrow drawn over the board (lesson hints). */
export interface BoardArrow {
  from: string;
  to: string;
}

interface BoardProps {
  pieces?: Record<string, PieceData> | PieceData[];
  highlights?: Highlight[];
  coords?: boolean;
  size?: number;
  flipped?: boolean;
  onSquarePress?: (sq: string) => void;
  selectedSquare?: string | null;
  legalMoves?: string[];
  lastMove?: { from: string; to: string } | null;
  animate?: boolean;
  arrows?: BoardArrow[];
}

function normalizePieces(pieces: BoardProps['pieces']): PieceData[] {
  if (!pieces) return [];
  if (Array.isArray(pieces)) return pieces;
  return Object.entries(pieces).map(([k, p]) => ({ ...p, id: p.id ?? k }));
}

function sqToCoord(sq: string, flipped: boolean): { col: number; row: number } {
  const file = FILES.indexOf(sq[0]);
  const rank = parseInt(sq[1], 10);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;
  return { col, row };
}

function squareCenter(sq: string, flipped: boolean, squareSize: number): { x: number; y: number } | null {
  if (!/^[a-h][1-8]$/.test(sq)) return null;
  const { col, row } = sqToCoord(sq, flipped);
  return { x: (col + 0.5) * squareSize, y: (row + 0.5) * squareSize };
}

interface AnimatedPieceProps {
  piece: PieceData;
  squareSize: number;
  flipped: boolean;
  animate: boolean;
}

function AnimatedPieceImpl({ piece, squareSize, flipped, animate }: AnimatedPieceProps) {
  const { col, row } = sqToCoord(piece.sq, flipped);
  const left = col * squareSize;
  const top = row * squareSize;
  const captured = !!piece.captured;

  // Light tracing for the live board only (one or two lines per move now).
  const prevSqRef = useRef(piece.sq);
  if (animate && prevSqRef.current !== piece.sq) {
    dlog('anim', `SQ-CHG id=${piece.id} ${prevSqRef.current} -> ${piece.sq} left/top=(${Math.round(left)},${Math.round(top)})`);
  }
  prevSqRef.current = piece.sq;

  // POSITION IS A PLAIN, REACT-COMMITTED STYLE.
  //
  // Earlier versions drove position through Reanimated shared values +
  // withTiming. The debug trace proved that path was the bug: state, props,
  // and the withTiming dispatch were all correct, yet the piece stayed at its
  // old square — Reanimated (v4 + New Arch) was intermittently dropping the
  // shared-value update on the UI thread, leaving a clickable-but-invisible
  // "ghost". Even directly assigning x.value/y.value as a rescue failed,
  // which means the useAnimatedStyle→view link itself was the weak point.
  //
  // Here `left`/`top` are ordinary layout props. React Native commits them on
  // every render, so the rendered position can NEVER diverge from game state —
  // a ghost is structurally impossible. `LinearTransition` animates the
  // left/top change when the layout-animation machinery is healthy; if it ever
  // misses, the piece simply snaps to the correct square. Correctness no
  // longer depends on any animation succeeding.
  return (
    <Animated.View
      pointerEvents="none"
      layout={animate ? LinearTransition.duration(MOVE_DURATION) : undefined}
      style={{
        position: 'absolute',
        left,
        top,
        width: squareSize,
        height: squareSize,
        opacity: captured ? 0 : 1,
      }}
    >
      <ChessPiece code={piece.code} size={squareSize} />
    </Animated.View>
  );
}

// Memoized so unrelated parent re-renders (e.g. the 1s clock tick or an eval
// update) don't re-render all 32 pieces. The piece object reference changes on
// every move (applyMoveToPieces clones each entry), so a real move always
// re-renders; a clock tick leaves the references untouched and is skipped.
const AnimatedPiece = React.memo(AnimatedPieceImpl);

export function Board({
  pieces,
  highlights = [],
  coords = false,
  size,
  flipped = false,
  onSquarePress,
  selectedSquare,
  legalMoves = [],
  lastMove,
  animate = false,
  arrows = [],
}: BoardProps) {
  const { colors } = useTheme();
  const [measuredSize, setMeasuredSize] = useState<number>(size ?? 0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Never collapse a previously-valid size to 0 from a transient layout pass —
    // that would unmount every piece and lose all in-flight Reanimated state.
    // Only accept the new width if it's positive and meaningfully different.
    if (w <= 0) return;
    if (Math.abs(w - measuredSize) > 0.5) setMeasuredSize(w);
  };

  const boardSize = size ?? measuredSize;
  const squareSize = boardSize / 8;

  const pieceList = useMemo(() => normalizePieces(pieces), [pieces]);

  const hlMap = useMemo(() => {
    const m: Record<string, string> = {};
    highlights.forEach(h => { m[h.sq] = h.kind; });
    if (lastMove) {
      if (!m[lastMove.from]) m[lastMove.from] = 'lastmove';
      if (!m[lastMove.to]) m[lastMove.to] = 'lastmove';
    }
    if (selectedSquare) m[selectedSquare] = 'selected';
    return m;
  }, [highlights, selectedSquare, lastMove]);

  const legalSet = useMemo(() => new Set(legalMoves), [legalMoves]);

  // Track which squares currently have an active (non-captured) piece, for legal-move dot vs ring decision
  const occupiedSet = useMemo(() => {
    const s = new Set<string>();
    pieceList.forEach(p => { if (!p.captured) s.add(p.sq); });
    return s;
  }, [pieceList]);

  const hlColors = useMemo<Record<string, string>>(() => ({
    good:     'rgba(77, 124, 69, 0.40)',
    bad:      'rgba(196, 69, 58, 0.40)',
    warn:     'rgba(184, 128, 31, 0.40)',
    brand:    colors.brandTint,
    selected: colors.selectedTint,
    lastmove: colors.lastMoveTint,
  }), [colors]);

  const hlBorders = useMemo<Record<string, string>>(() => ({
    good:     colors.good,
    bad:      colors.bad,
    warn:     colors.warn,
    brand:    colors.brand,
    selected: colors.brand,
    lastmove: 'transparent',
  }), [colors]);

  return (
    <View
      onLayout={size ? undefined : onLayout}
      style={[
        styles.board,
        {
          backgroundColor: colors.boardDark,
          ...(size ? { width: size, height: size } : {}),
        },
      ]}
    >
      {boardSize > 0 && (
        <>
          {/* Background squares + tap targets. Use integer-rounded boundaries
              so squares tile perfectly with no sub-pixel gaps. */}
          {RANKS.map((rank, ri) => (
            FILES.map((file, fi) => {
              const sq = `${file}${rank}`;
              const isLight = (ri + fi) % 2 === 0;
              const squareBg = isLight ? colors.boardLight : colors.boardDark;
              const { col, row } = sqToCoord(sq, flipped);
              const left = Math.round((col * boardSize) / 8);
              const top = Math.round((row * boardSize) / 8);
              const right = Math.round(((col + 1) * boardSize) / 8);
              const bottom = Math.round(((row + 1) * boardSize) / 8);
              const w = right - left;
              const h = bottom - top;
              const hl = hlMap[sq];
              const isLegal = legalSet.has(sq);
              const isCapture = isLegal && occupiedSet.has(sq);

              return (
                <Pressable
                  key={sq}
                  onPress={onSquarePress ? () => onSquarePress(sq) : undefined}
                  style={({ pressed }) => [
                    styles.square,
                    {
                      left,
                      top,
                      width: w,
                      height: h,
                      backgroundColor: squareBg,
                      opacity: pressed && onSquarePress ? 0.85 : 1,
                    },
                  ]}
                >
                  {/* Highlight tint overlay (does not affect square size) */}
                  {hl && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.absFill,
                        {
                          backgroundColor: hlColors[hl],
                          ...(hlBorders[hl] !== 'transparent' && hl !== 'lastmove'
                            ? { borderColor: hlBorders[hl], borderWidth: Math.max(2, squareSize * 0.04) }
                            : {}),
                        },
                      ]}
                    />
                  )}

                  {/* Coordinate labels — anchored to the visual left column
                      (col 0) and bottom row (row 7) so they read correctly
                      whether or not the board is flipped. */}
                  {coords && col === 0 && (
                    <Text
                      style={[
                        styles.coordRank,
                        {
                          fontSize: Math.max(8, squareSize * 0.16),
                          color: isLight ? colors.boardDark : colors.boardLight,
                        },
                      ]}
                    >
                      {rank}
                    </Text>
                  )}
                  {coords && row === 7 && (
                    <Text
                      style={[
                        styles.coordFile,
                        {
                          fontSize: Math.max(8, squareSize * 0.16),
                          color: isLight ? colors.boardDark : colors.boardLight,
                        },
                      ]}
                    >
                      {file}
                    </Text>
                  )}

                  {/* Legal move marker: dot on empty square, ring on capture */}
                  {isLegal && !isCapture && (
                    <View
                      pointerEvents="none"
                      style={{
                        width: squareSize * 0.32,
                        height: squareSize * 0.32,
                        borderRadius: squareSize,
                        backgroundColor: colors.legalMoveDot,
                      }}
                    />
                  )}
                  {isLegal && isCapture && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: squareSize * 0.05,
                        top: squareSize * 0.05,
                        right: squareSize * 0.05,
                        bottom: squareSize * 0.05,
                        borderRadius: squareSize,
                        borderWidth: Math.max(3, squareSize * 0.07),
                        borderColor: colors.legalMoveDot,
                      }}
                    />
                  )}
                </Pressable>
              );
            })
          ))}

          {/* Coaching arrows (lesson hints). Drawn above the squares but below
              the pieces, so a piece never disappears behind an arrow. */}
          {arrows.length > 0 && (
            <Svg
              pointerEvents="none"
              width={boardSize}
              height={boardSize}
              style={StyleSheet.absoluteFill}
            >
              {arrows.map((a, i) => {
                const start = squareCenter(a.from, flipped, squareSize);
                const end = squareCenter(a.to, flipped, squareSize);
                if (!start || !end) return null;

                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;

                const head = squareSize * 0.34;
                const inset = squareSize * 0.22;      // stop short of the square's edge
                const tipX = end.x - ux * inset;
                const tipY = end.y - uy * inset;
                const baseX = tipX - ux * head;
                const baseY = tipY - uy * head;
                // Perpendicular unit vector for the arrowhead's wings.
                const px = -uy;
                const py = ux;
                const halfWidth = head * 0.5;

                return (
                  <React.Fragment key={`${a.from}${a.to}${i}`}>
                    <Line
                      x1={start.x + ux * inset * 0.5}
                      y1={start.y + uy * inset * 0.5}
                      x2={baseX}
                      y2={baseY}
                      stroke={colors.brand}
                      strokeWidth={squareSize * 0.15}
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                    <Polygon
                      points={[
                        `${tipX},${tipY}`,
                        `${baseX + px * halfWidth},${baseY + py * halfWidth}`,
                        `${baseX - px * halfWidth},${baseY - py * halfWidth}`,
                      ].join(' ')}
                      fill={colors.brand}
                      opacity={0.85}
                    />
                  </React.Fragment>
                );
              })}
            </Svg>
          )}

          {/* Pieces overlay (absolute, animated). Rendered after squares so they appear on top.
              They are pointerEvents='none' so taps fall through to squares. */}
          {pieceList.map(p => (
            <AnimatedPiece
              key={p.id ?? `${p.code}-${p.sq}`}
              piece={p}
              squareSize={squareSize}
              flipped={flipped}
              animate={animate}
            />
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  square: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  absFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  coordRank: {
    position: 'absolute',
    top: 1,
    left: 2,
    fontWeight: '700',
    opacity: 0.65,
  },
  coordFile: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    fontWeight: '700',
    opacity: 0.65,
  },
});
