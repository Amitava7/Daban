import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { PIECE_SVGS, tunePieceSvg } from './chessPieceSvgs';

interface ChessPieceProps {
  code: string; // 'wK', 'wQ', ..., 'bP'
  size: number;
}

function ChessPieceImpl({ code, size }: ChessPieceProps) {
  const { mode } = useTheme();
  const color = code[0] as 'w' | 'b';

  const xml = useMemo(() => {
    const base = PIECE_SVGS[code];
    if (!base) return null;
    return tunePieceSvg(base, color, mode);
  }, [code, color, mode]);

  if (!xml) return null;

  // The cburnett SVG is designed at 45×45. Render at the full square size so
  // the piece visually fills (~95%) the cell, matching standard chess UI feel.
  const pieceSize = Math.round(size * 0.96);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <SvgXml xml={xml} width={pieceSize} height={pieceSize} />
    </View>
  );
}

export const ChessPiece = memo(ChessPieceImpl);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
