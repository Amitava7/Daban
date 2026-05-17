import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

const PIECE_GLYPHS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

export interface PieceData {
  sq: string;
  code: string;
  captured?: boolean;
}

export interface Highlight {
  sq: string;
  kind: 'good' | 'bad' | 'warn' | 'brand' | 'selected' | 'legal';
}

interface BoardProps {
  pieces?: Record<string, PieceData>;
  highlights?: Highlight[];
  coords?: boolean;
  size?: number;
  flipped?: boolean;            // true = board flipped (black at bottom)
  onSquarePress?: (sq: string) => void;
  selectedSquare?: string | null;
  legalMoves?: string[];
}

export function Board({
  pieces = {},
  highlights = [],
  coords = false,
  size,
  flipped = false,
  onSquarePress,
  selectedSquare,
  legalMoves = [],
}: BoardProps) {
  const { colors } = useTheme();

  const squareMap = useMemo(() => {
    const m: Record<string, string> = {};
    Object.values(pieces).forEach(p => {
      if (!p.captured) m[p.sq] = p.code;
    });
    return m;
  }, [pieces]);

  const hlMap = useMemo(() => {
    const m: Record<string, string> = {};
    highlights.forEach(h => { m[h.sq] = h.kind; });
    if (selectedSquare) m[selectedSquare] = 'selected';
    legalMoves.forEach(sq => { if (!m[sq]) m[sq] = 'legal'; });
    return m;
  }, [highlights, selectedSquare, legalMoves]);

  const hlColors: Record<string, string> = {
    good:     'rgba(77, 124, 69, 0.40)',
    bad:      'rgba(196, 69, 58, 0.40)',
    warn:     'rgba(184, 128, 31, 0.40)',
    brand:    colors.brandTint,
    selected: 'rgba(100, 160, 220, 0.55)',
    legal:    'rgba(100, 160, 220, 0.25)',
  };

  const hlBorders: Record<string, string> = {
    good:     colors.good,
    bad:      colors.bad,
    warn:     colors.warn,
    brand:    colors.brand,
    selected: '#4a9fd4',
    legal:    'transparent',
  };

  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const files = flipped ? [...FILES].reverse() : FILES;

  return (
    <View style={[
      styles.board,
      { backgroundColor: colors.boardDark },
      size ? { width: size, height: size } : null,
    ]}>
      {ranks.map((rank, ri) =>
        files.map((file, fi) => {
          const sq = `${file}${rank}`;
          // Light square when (original rank index + file index) is even
          const origRi = RANKS.indexOf(rank);
          const origFi = FILES.indexOf(file);
          const isLight = (origRi + origFi) % 2 === 0;
          const squareBg = isLight ? colors.boardLight : colors.boardDark;
          const hl = hlMap[sq];
          const piece = squareMap[sq];
          const isWhite = piece && piece[0] === 'w';
          const isLegalDot = hl === 'legal' && !piece;

          return (
            <TouchableOpacity
              key={sq}
              activeOpacity={onSquarePress ? 0.7 : 1}
              onPress={() => onSquarePress?.(sq)}
              style={[
                styles.square,
                { backgroundColor: squareBg },
                hl && hl !== 'legal' && {
                  backgroundColor: hlColors[hl],
                  borderColor: hlBorders[hl],
                  borderWidth: 2,
                },
                hl === 'legal' && piece && {
                  backgroundColor: hlColors['legal'],
                  borderColor: '#4a9fd4',
                  borderWidth: 2,
                },
              ]}
            >
              {coords && origFi === 0 && (
                <Text style={[styles.coordRank, { color: isLight ? colors.boardDark : colors.boardLight }]}>
                  {rank}
                </Text>
              )}
              {coords && origRi === 7 && (
                <Text style={[styles.coordFile, { color: isLight ? colors.boardDark : colors.boardLight }]}>
                  {file}
                </Text>
              )}

              {isLegalDot && (
                <View style={[styles.legalDot, { backgroundColor: 'rgba(70, 130, 200, 0.55)' }]} />
              )}

              {piece && (
                <Text style={[
                  styles.piece,
                  { color: isWhite ? colors.pieceLight : colors.pieceDark },
                ]}>
                  {PIECE_GLYPHS[piece] ?? piece}
                </Text>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    width: '100%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    overflow: 'hidden',
  },
  square: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  piece: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'System',
  },
  legalDot: {
    width: '35%',
    aspectRatio: 1,
    borderRadius: 999,
  },
  coordRank: {
    position: 'absolute',
    top: 1,
    left: 2,
    fontSize: 7,
    fontWeight: '600',
    opacity: 0.7,
  },
  coordFile: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    fontSize: 7,
    fontWeight: '600',
    opacity: 0.7,
  },
});
