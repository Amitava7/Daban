import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { Board } from '../components/Board';
import { ChessPiece } from '../components/ChessPiece';
import { fenToPieces } from '../utils/fenUtils';
import { getLessonById } from '../lessons';
import { getLessonMeta } from '../lessons/config';
import { lessonAfter, starString } from '../lessons/progress';
import {
  initLesson, lessonReducer, legalTargets, isPromotion, pieceAt, sideToMoveLabel,
  isPlayablePosition, AUTO_MOVE_DELAY, LessonRunState,
} from '../lessons/LessonEngine';
import { ChallengeStep } from '../lessons/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LessonPlayer'>;
type Route = RouteProp<RootStackParamList, 'LessonPlayer'>;

const PROMOTION_PIECES: Array<{ code: 'q' | 'r' | 'b' | 'n'; label: string }> = [
  { code: 'q', label: 'Queen' },
  { code: 'r', label: 'Rook' },
  { code: 'b', label: 'Bishop' },
  { code: 'n', label: 'Knight' },
];

export function LessonPlayerScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { lessonId } = useRoute<Route>().params;
  const { completeLesson, recordLessonStep } = useProgress();

  const lesson = useMemo(() => getLessonById(lessonId), [lessonId]);
  const meta = getLessonMeta(lessonId);

  if (!lesson) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.ink }]}>Lesson not found.</Text>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={[styles.link, { color: colors.brand }]}>Back to lessons</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LessonRunner
      key={lessonId}
      lessonId={lessonId}
      lesson={lesson}
      title={meta?.title ?? lesson.title}
      onExit={() => nav.goBack()}
      onGoToLesson={(id: string) => nav.replace('LessonPlayer', { lessonId: id })}
      onPlayFromHere={(fen: string) => nav.navigate('ColorPicker', {
        fen,
        fromLabel: meta?.title ?? lesson.title,
      })}
      completeLesson={completeLesson}
      recordLessonStep={recordLessonStep}
    />
  );
}

interface RunnerProps {
  lessonId: string;
  lesson: NonNullable<ReturnType<typeof getLessonById>>;
  title: string;
  onExit: () => void;
  onGoToLesson: (id: string) => void;
  /** Hand the live board position to the coach as a full game. */
  onPlayFromHere: (fen: string) => void;
  completeLesson: (id: string, pct: number, stars: 0 | 1 | 2 | 3) => Promise<void>;
  recordLessonStep: (id: string, stepIndex: number) => Promise<void>;
}

function LessonRunner({
  lessonId, lesson, title, onExit, onGoToLesson, onPlayFromHere,
  completeLesson, recordLessonStep,
}: RunnerProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [state, dispatch] = useReducer(lessonReducer, lesson, initLesson);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const savedRef = useRef(false);

  const step = lesson.steps[state.stepIndex];
  const challenge: ChallengeStep | null = step && step.kind === 'challenge' ? step : null;
  const pieces = useMemo(() => fenToPieces(state.fen), [state.fen]);
  const targets = useMemo(
    () => (selected ? legalTargets(state.fen, selected) : []),
    [selected, state.fen],
  );

  // Auto-play opponent replies and demonstrations.
  //
  // A wrong move is deliberately NOT rewound on a timer: the mistake stays on
  // the board with the coach's explanation until the player taps "Try again".
  // Reading why the move failed is the whole point of the feedback, and any
  // timeout short enough to feel responsive is too short to finish reading.
  useEffect(() => {
    if (state.phase === 'watching' || state.phase === 'animating') {
      const timer = setTimeout(() => dispatch({ type: 'TICK' }), AUTO_MOVE_DELAY);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.phase, state.fen, state.autoQueue.length, state.mistakesThisStep]);

  // A move (right or wrong) always clears the current selection.
  useEffect(() => { setSelected(null); }, [state.fen, state.phase]);

  useEffect(() => { recordLessonStep(lessonId, state.stepIndex); }, [state.stepIndex]);

  useEffect(() => {
    if (state.phase === 'lesson-complete' && !savedRef.current) {
      savedRef.current = true;
      completeLesson(lessonId, state.scorePct, state.stars);
    }
  }, [state.phase]);

  const handleSquarePress = (sq: string) => {
    if (state.phase !== 'awaiting-move' || pendingPromotion) return;

    if (selected && targets.includes(sq)) {
      if (isPromotion(state.fen, selected, sq)) {
        setPendingPromotion({ from: selected, to: sq });
      } else {
        dispatch({ type: 'USER_MOVE', from: selected, to: sq });
      }
      setSelected(null);
      return;
    }
    if (sq === selected) { setSelected(null); return; }

    const piece = pieceAt(state.fen, sq);
    setSelected(piece && piece.color === state.userColor ? sq : null);
  };

  const choosePromotion = (code: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    dispatch({ type: 'USER_MOVE', ...pendingPromotion, promotion: code });
    setPendingPromotion(null);
  };

  // Leave the coach panel at least ~45% of the screen so the board is never
  // clipped by it on tall phones.
  const boardSize = Math.min(width, Math.max(240, height * 0.45));

  // Any step's board can be taken over as a real game against the coach —
  // intro slides included, which is the only way to actually practise the
  // techniques the coach describes but never asks you to play.
  const canPlayFromHere = useMemo(() => isPlayablePosition(state.fen), [state.fen]);

  const hintsLeft = challenge ? challenge.hints.length - state.hintsUsed : 0;
  const canHint = !!challenge
    && (state.phase === 'awaiting-move' || state.phase === 'feedback-bad')
    && hintsLeft > 0;

  const progress = state.challengeTotal > 0
    ? (state.results.length / state.challengeTotal)
    : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg2 }]} edges={['top', 'bottom']}>
      <View style={[styles.boardWrap, { height: boardSize }]}>
        <Board
          size={boardSize}
          pieces={pieces}
          highlights={state.highlights}
          arrows={state.arrows}
          flipped={state.userColor === 'b'}
          onSquarePress={handleSquarePress}
          selectedSquare={selected}
          legalMoves={targets}
          lastMove={state.lastMove}
          coords
        />
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.panelHead}>
          <TouchableOpacity onPress={onExit} style={styles.headBtn}>
            <Text style={[styles.headBtnText, { color: colors.ink2 }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.panelTitle, { color: colors.ink }]} numberOfLines={1}>
            🎓 {title}
          </Text>
          <TouchableOpacity
            onPress={() => dispatch({ type: 'RESTART' })}
            style={styles.headBtn}
          >
            <Text style={[styles.headBtnText, { color: colors.inkMute }]}>↺</Text>
          </TouchableOpacity>
        </View>

        {state.phase === 'lesson-complete' ? (
          <ScoreCard
            state={state}
            lessonId={lessonId}
            onReplay={() => { savedRef.current = false; dispatch({ type: 'RESTART' }); }}
            onExit={onExit}
            onGoToLesson={onGoToLesson}
          />
        ) : (
          <ScrollView
            style={styles.coachArea}
            contentContainerStyle={styles.coachScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.coachRow}>
              <View style={[styles.avatar, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Text style={styles.avatarGlyph}>🧑‍🏫</Text>
              </View>

              <View style={[styles.bubble, { backgroundColor: colors.surface2, borderColor: colors.borderSoft }]}>
                {state.resultChip ? (
                  <View style={styles.chipRow}>
                    <Text style={[
                      styles.chipIcon,
                      { color: state.resultChip.kind === 'good' ? colors.good : colors.bad },
                    ]}>
                      {state.resultChip.kind === 'good' ? '✓' : '✕'}
                    </Text>
                    <Text style={[
                      styles.chipText,
                      { color: state.resultChip.kind === 'good' ? colors.good : colors.bad },
                    ]}>
                      {state.resultChip.text}
                    </Text>
                  </View>
                ) : challenge && state.phase === 'awaiting-move' ? (
                  <View style={styles.chipRow}>
                    <View style={[
                      styles.turnSwatch,
                      {
                        backgroundColor: state.userColor === 'w' ? colors.pieceLight : colors.pieceDark,
                        borderColor: colors.inkMute,
                      },
                    ]} />
                    <Text style={[styles.chipText, { color: colors.ink2 }]}>
                      {sideToMoveLabel(state)}
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.coachText, { color: colors.ink }]}>{state.coachText}</Text>
              </View>
            </View>

            {step && step.kind === 'intro' && state.stepIndex === 0 && (
              <View style={[styles.goals, { borderColor: colors.borderSoft }]}>
                <Text style={[styles.goalsLabel, { color: colors.inkMute }]}>In this lesson</Text>
                {lesson.goals.map(goal => (
                  <Text key={goal} style={[styles.goalItem, { color: colors.ink2 }]}>· {goal}</Text>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {challenge && state.phase !== 'lesson-complete' && (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.ink }]}>
                Challenge {state.challengeIndex}/{state.challengeTotal}
              </Text>
              {state.hintsUsed > 0 && (
                <Text style={[styles.hintMeta, { color: colors.inkMute }]}>
                  {state.hintsUsed} hint{state.hintsUsed > 1 ? 's' : ''} used
                </Text>
              )}
            </View>
            <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.good }]} />
            </View>
          </View>
        )}

        {pendingPromotion && (
          <View style={[styles.promoBar, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.promoLabel, { color: colors.inkSoft }]}>Promote to</Text>
            <View style={styles.promoRow}>
              {PROMOTION_PIECES.map(piece => (
                <TouchableOpacity
                  key={piece.code}
                  style={[styles.promoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => choosePromotion(piece.code)}
                >
                  <ChessPiece code={`${state.userColor}${piece.code.toUpperCase()}`} size={34} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {state.phase !== 'lesson-complete' && !pendingPromotion && (
          <View style={styles.actions}>
            {canHint && (
              <TouchableOpacity
                style={[styles.hintBtn, { backgroundColor: colors.warnSoft, borderColor: colors.warnBorder }]}
                onPress={() => dispatch({ type: 'HINT' })}
                activeOpacity={0.8}
              >
                <Text style={[styles.hintBtnText, { color: colors.warn }]}>💡 Hint</Text>
              </TouchableOpacity>
            )}

            {canPlayFromHere && (
              <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                onPress={() => onPlayFromHere(state.fen)}
                activeOpacity={0.8}
              >
                <Text style={[styles.playBtnText, { color: colors.ink2 }]} numberOfLines={1}>
                  ⚔️ Play here
                </Text>
              </TouchableOpacity>
            )}

            {(state.phase === 'intro' || state.phase === 'step-complete') && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.brand }]}
                onPress={() => dispatch({ type: 'NEXT' })}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: colors.onBrand }]}>
                  {state.phase === 'intro' && state.stepIndex === 0 ? '✓  Start' : 'Next  ›'}
                </Text>
              </TouchableOpacity>
            )}

            {state.phase === 'feedback-bad' && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.bad }]}
                onPress={() => dispatch({ type: 'RETRY' })}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Try again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

interface ScoreCardProps {
  state: LessonRunState;
  lessonId: string;
  onReplay: () => void;
  onExit: () => void;
  onGoToLesson: (id: string) => void;
}

function ScoreCard({ state, lessonId, onReplay, onExit, onGoToLesson }: ScoreCardProps) {
  const { colors } = useTheme();
  const next = lessonAfter(lessonId);
  const solved = state.results.filter(Boolean).length;

  return (
    <ScrollView contentContainerStyle={styles.scoreScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.scoreStars, { color: colors.warn }]}>{starString(state.stars)}</Text>
      <Text style={[styles.scorePct, { color: colors.ink }]}>{state.scorePct}%</Text>
      <Text style={[styles.scoreMeta, { color: colors.inkSoft }]}>
        {solved} of {state.challengeTotal} challenges solved first try
      </Text>
      <Text style={[styles.scoreCoach, { color: colors.ink2 }]}>{state.coachText}</Text>

      <View style={styles.scoreActions}>
        {next && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.brand, flex: 1 }]}
            onPress={() => onGoToLesson(next.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, { color: colors.onBrand }]} numberOfLines={1}>
              Next lesson  ›
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={onReplay}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.ink2 }]}>Replay</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onExit} style={styles.exitLink}>
        <Text style={[styles.link, { color: colors.inkMute }]}>Back to lessons</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  boardWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  panel: {
    flex: 1,
    borderTopWidth: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headBtnText: { fontSize: 20 },
  panelTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },

  coachArea: { flex: 1 },
  coachScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 10, gap: 12 },
  goals: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  goalsLabel: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 },
  goalItem: { fontSize: 13, lineHeight: 18 },
  coachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 999, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGlyph: { fontSize: 22 },
  bubble: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipIcon: { fontSize: 14, fontWeight: '700' },
  chipText: { fontSize: 12, fontWeight: '700' },
  turnSwatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  coachText: { fontSize: 14, lineHeight: 20 },

  progressBlock: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13, fontWeight: '700' },
  hintMeta: { fontSize: 11, fontFamily: 'monospace' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  playBtn: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  playBtnText: { fontSize: 13, fontWeight: '600' },
  hintBtnText: { fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  secondaryBtn: {
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },

  promoBar: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8, marginBottom: 10 },
  promoLabel: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 },
  promoRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  promoBtn: {
    flex: 1, height: 52, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  scoreScroll: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  scoreStars: { fontSize: 30, letterSpacing: 4 },
  scorePct: { fontSize: 40, fontFamily: 'serif', fontWeight: '600' },
  scoreMeta: { fontSize: 12, fontFamily: 'monospace' },
  scoreCoach: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },
  scoreActions: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  exitLink: { marginTop: 12, padding: 8 },
  link: { fontSize: 13, fontWeight: '600' },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  missingText: { fontSize: 16 },
});
