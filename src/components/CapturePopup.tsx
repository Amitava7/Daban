import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export interface CaptureFlash {
  id: number;
  sq: string;
  points: number;
  gained: boolean; // true: player captured (green +); false: player lost (red -)
}

interface CapturePopupProps {
  flash: CaptureFlash | null;
  boardSize: number;
  flipped: boolean;
  gainColor: string;
  lossColor: string;
  onDone?: () => void;
}

export function CapturePopup({
  flash,
  boardSize,
  flipped,
  gainColor,
  lossColor,
  onDone,
}: CapturePopupProps) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    if (!flash || boardSize <= 0) return;
    opacity.value = 0;
    ty.value = 0;
    scale.value = 0.6;
    opacity.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withDelay(700, withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) })),
    );
    scale.value = withTiming(1.05, { duration: 220, easing: Easing.out(Easing.back(1.6)) });
    ty.value = withTiming(-boardSize * 0.12, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [flash?.id, boardSize]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  if (!flash || boardSize <= 0) return null;

  const sq = flash.sq;
  const file = FILES.indexOf(sq[0]);
  const rank = parseInt(sq[1], 10);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;
  const sqSize = boardSize / 8;
  const left = col * sqSize;
  const top = row * sqSize;

  const color = flash.gained ? gainColor : lossColor;
  const sign = flash.gained ? '+' : '−';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          left,
          top,
          width: sqSize,
          height: sqSize,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: sqSize * 0.46,
            color,
            textShadowColor: 'rgba(0,0,0,0.55)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          },
        ]}
        allowFontScaling={false}
      >
        {sign}{flash.points}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
