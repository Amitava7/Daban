import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  kind: 'good' | 'bad' | 'warn' | 'brand';
}

interface BoardProps {
  pieces?: Record<string, PieceData>;
  highlights?: Highlight[];
  coords?: boolean;
  size?: number;
}

export function Board({ pieces = {}, highlights = [], coords = false, size }: BoardProps) {
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
    return m;
  }, [highlights]);

  const hlColors: Record<string, string> = {
    good:  'rgba(77, 124, 69, 0.35)',
    bad:   'rgba(196, 69, 58, 0.35)',
    warn:  'rgba(184, 128, 31, 0.35)',
    brand: colors.brandTint,
  };

  const hlBorders: Record<string, string> = {
    good:  colors.good,
    bad:   colors.bad,
    warn:  colors.warn,
    brand: colors.brand,
  };

  return (
    <View style={[styles.board, { backgroundColor: colors.boardDark }, size ? { width: size, height: size } : null]}>
      {RANKS.map((rank, ri) =>
        FILES.map((file, fi) => {
          const sq = `${file}${rank}`;
          const isLight = (ri + fi) % 2 === 0;
          const squareBg = isLight ? colors.boardLight : colors.boardDark;
          const hl = hlMap[sq];
          const piece = squareMap[sq];
          const isWhite = piece && piece[0] === 'w';

          return (
            <View
              key={sq}
              style={[
                styles.square,
                { backgroundColor: squareBg },
                hl && { backgroundColor: hlColors[hl], borderColor: hlBorders[hl], borderWidth: 2 },
              ]}
            >
              {coords && fi === 0 && (
                <Text style={[styles.coordRank, { color: isLight ? colors.boardDark : colors.boardLight }]}>
                  {rank}
                </Text>
              )}
              {coords && ri === 7 && (
                <Text style={[styles.coordFile, { color: isLight ? colors.boardDark : colors.boardLight }]}>
                  {file}
                </Text>
              )}
              {piece && (
                <Text style={[
                  styles.piece,
                  { color: isWhite ? colors.pieceLight : colors.pieceDark },
                ]}>
                  {PIECE_GLYPHS[piece] ?? piece}
                </Text>
              )}
            </View>
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
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'System',
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
