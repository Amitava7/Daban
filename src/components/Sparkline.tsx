import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  color?: string;
  fill?: string;
  height?: number;
}

export function Sparkline({ data, color = '#c25e3a', fill, height = 48 }: SparklineProps) {
  if (data.length < 2) return <View style={{ height }} />;

  const W = 100;
  const H = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((v - min) / range) * (H * 0.85) - H * 0.075,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${W} ${H} L0 ${H} Z`;

  return (
    <View style={{ height, width: '100%' }}>
      <Svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
        {fill && (
          <Path d={fillPath} fill={fill} fillOpacity={0.2} />
        )}
        <Path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
