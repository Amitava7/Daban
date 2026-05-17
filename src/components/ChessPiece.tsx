import React, { memo } from 'react';
import Svg, { Text as SvgText, G } from 'react-native-svg';

const GLYPHS: Record<string, string> = {
  K: '♚', // ♚
  Q: '♛', // ♛
  R: '♜', // ♜
  B: '♝', // ♝
  N: '♞', // ♞
  P: '♟', // ♟
};

interface ChessPieceProps {
  code: string;
  size: number;
  fillLight?: string;   // color used for white pieces' fill
  fillDark?: string;    // color used for black pieces' fill
  strokeLight?: string; // outline color for white pieces (dark)
  strokeDark?: string;  // outline color for black pieces (light)
}

function ChessPieceImpl({
  code,
  size,
  fillLight = '#f8f0d8',
  fillDark = '#1a1410',
  strokeLight = '#1a1410',
  strokeDark = '#fdf8e8',
}: ChessPieceProps) {
  const isWhite = code[0] === 'w';
  const type = code[1];
  const glyph = GLYPHS[type] ?? '?';

  const fontSize = size * 0.86;
  const fill = isWhite ? fillLight : fillDark;
  const stroke = isWhite ? strokeLight : strokeDark;
  const strokeW = Math.max(1.5, size * 0.06);
  const cx = size / 2;
  const cy = size * 0.78;
  const shadowDx = size * 0.025;
  const shadowDy = size * 0.045;

  return (
    <Svg width={size} height={size} pointerEvents="none">
      <G>
        {/* Drop shadow (offset, semi-transparent) */}
        <SvgText
          x={cx + shadowDx}
          y={cy + shadowDy}
          fontSize={fontSize}
          textAnchor="middle"
          fill="rgba(0,0,0,0.40)"
          stroke="rgba(0,0,0,0.40)"
          strokeWidth={strokeW * 1.6}
          strokeLinejoin="round"
          fontWeight="bold"
        >
          {glyph}
        </SvgText>
        {/* Outline */}
        <SvgText
          x={cx}
          y={cy}
          fontSize={fontSize}
          textAnchor="middle"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeW * 1.6}
          strokeLinejoin="round"
          fontWeight="bold"
        >
          {glyph}
        </SvgText>
        {/* Fill */}
        <SvgText
          x={cx}
          y={cy}
          fontSize={fontSize}
          textAnchor="middle"
          fill={fill}
          fontWeight="bold"
        >
          {glyph}
        </SvgText>
      </G>
    </Svg>
  );
}

export const ChessPiece = memo(ChessPieceImpl);
