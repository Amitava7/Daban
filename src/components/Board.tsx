import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { ChessPiece } from './ChessPiece';
import { dlog } from '../utils/debugLog';

const MOVE_DURATION = 220;
const MOVE_EASING = Easing.inOut(Easing.cubic);

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

interface AnimatedPieceProps {
  piece: PieceData;
  squareSize: number;
  flipped: boolean;
  animate: boolean;
}

function AnimatedPieceImpl({ piece, squareSize, flipped, animate }: AnimatedPieceProps) {
  const { col, row } = sqToCoord(piece.sq, flipped);
  const targetX = col * squareSize;
  const targetY = row * squareSize;
  const captured = !!piece.captured;

  // Initialize directly at the target so a freshly-mounted piece never slides
  // in from the corner. useSharedValue's initial value is used only once.
  const x = useSharedValue(targetX);
  const y = useSharedValue(targetY);
  const opacity = useSharedValue(captured ? 0 : 1);
  const scale = useSharedValue(captured ? 0.4 : 1);

  // Log mounts and prop changes for the moving piece so we can match a piece's
  // displayed position against the boardPieces commits in the same trace.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      dlog('anim', `MOUNT id=${piece.id} code=${piece.code} sq=${piece.sq} captured=${captured}`);
      return () => {
        dlog('anim', `UNMOUNT id=${piece.id} code=${piece.code} sq=${piece.sq}`);
      };
    }
  }, []);

  const prevSqRef = useRef(piece.sq);
  if (prevSqRef.current !== piece.sq) {
    dlog('anim', `SQ-CHG id=${piece.id} ${prevSqRef.current} -> ${piece.sq}`);
    prevSqRef.current = piece.sq;
  }

  // Drive position from props. The dependency array is [targetX, targetY,
  // animate] so this fires whenever the piece's destination square (or the
  // board size) changes — and never re-issues an animation toward a stale
  // value. Because this component is never wrapped in a stale-prop guard and
  // its parent always re-renders on a board change, targetX/Y here are always
  // the latest committed values, so the rendered position can't diverge from
  // the game state.
  useEffect(() => {
    dlog('anim', `EFFECT id=${piece.id} sq=${piece.sq} target=(${Math.round(targetX)},${Math.round(targetY)}) animate=${animate}`);
    if (animate) {
      x.value = withTiming(targetX, { duration: MOVE_DURATION, easing: MOVE_EASING });
      y.value = withTiming(targetY, { duration: MOVE_DURATION, easing: MOVE_EASING });
    } else {
      x.value = targetX;
      y.value = targetY;
    }
  }, [targetX, targetY, animate]);

  // Capture: fade + shrink out. Restore instantly if a piece is "uncaptured"
  // (e.g. after an undo rebuilds the board).
  useEffect(() => {
    if (captured) {
      opacity.value = animate ? withDelay(60, withTiming(0, { duration: 180 })) : 0;
      scale.value = animate ? withDelay(60, withTiming(0.4, { duration: 200 })) : 0.4;
    } else {
      opacity.value = 1;
      scale.value = 1;
    }
  }, [captured, animate]);

  const half = squareSize / 2;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value + half },
      { translateY: y.value + half },
      { scale: scale.value },
      { translateX: -half },
      { translateY: -half },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: squareSize,
          height: squareSize,
        },
        style,
      ]}
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
