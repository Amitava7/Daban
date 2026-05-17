import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useGame } from '../context/GameContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { CapturePopup } from '../components/CapturePopup';
import { EvalBar } from '../components/EvalBar';
import { Pill } from '../components/Pill';
import { Card } from '../components/Card';
import { ChessPiece } from '../components/ChessPiece';
import { formatEval, qualityLabel, qualityTone } from '../engine/MoveClassifier';
import { levelToElo } from '../engine/ChessEngine';
import { fenToPieces } from '../utils/fenUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Game'>;

function formatTime(secs: number | null): string {
  if (secs === null) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function evalBarPct(cp: number): number {
  // Map [-1000, 1000] centipawns to [10, 90]
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 10 + ((clamped + 1000) / 2000) * 80;
}

export function GameScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const {
    fen, status, result, moveHistory, lastAnalysis, currentEval,
    selectedSquare, legalMoves, playerColor, level, timeWhite, timeBlack,
    hintsUsed, selectSquare, makeMove, resign, offerDraw, useHint,
    clearBlunderAlert, boardPieces, lastMove, captureFlash, clearCaptureFlash,
    undoLastMove, canUndo,
  } = useGame();
  const { settings, recordGame } = useProgress();
  const [showResignModal, setShowResignModal] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);

  // Static fallback when the live tracked list isn't ready
  const fallbackPieces = useMemo(() => fenToPieces(fen), [fen]);
  const evalPct = evalBarPct(currentEval);
  const evalLabel = formatEval(currentEval);

  // Record game on completion
  useEffect(() => {
    if (status === 'game_over' && result) {
      const blunders = moveHistory.filter(m => m.playerMove && m.analysis?.quality === 'blunder').length;
      const losses = moveHistory
        .filter(m => m.playerMove && m.analysis)
        .map(m => m.analysis!.centipawnLoss);
      const accuracy = losses.length > 0
        ? Math.max(0, Math.round(100 - losses.reduce((a, b) => a + b, 0) / losses.length / 6))
        : 100;
      recordGame({ result, playerColor, level, accuracy, blunders, moves: moveHistory.length });
    }
  }, [status, result]);

  const handleSquarePress = (sq: string) => {
    if (status !== 'playing') return;
    // If we have a selected square and tap a legal move destination
    if (selectedSquare && legalMoves.includes(sq)) {
      // Check if pawn promotion
      const piece = boardPieces.find(p => !p.captured && p.sq === selectedSquare);
      const isPromotion = piece?.code === (playerColor === 'w' ? 'wP' : 'bP') &&
        ((playerColor === 'w' && sq[1] === '8') || (playerColor === 'b' && sq[1] === '1'));
      if (isPromotion) {
        setPromotionPending({ from: selectedSquare, to: sq });
      } else {
        makeMove(selectedSquare, sq);
      }
    } else {
      selectSquare(sq);
    }
  };

  const lastPlayerMove = [...moveHistory].reverse().find(m => m.playerMove);
  const lastNotation = moveHistory.slice(-4).map((m, i) => {
    const moveNum = Math.floor((moveHistory.length - moveHistory.slice(-4).length + i) / 2) + 1;
    const isWhiteTurn = (moveHistory.length - moveHistory.slice(-4).length + i) % 2 === 0;
    return `${isWhiteTurn ? moveNum + '. ' : ''}${m.san}`;
  }).join('  ');

  const coachComment = lastAnalysis?.coachComment ?? 'Play your move.';
  const evalText = evalLabel;

  const highlights = useMemo(() => [], []);

  const isPlayerTurn = status === 'playing' && fen.split(' ')[1] === playerColor;
  const isThinking = status === 'engine_thinking';
  const isBlunder = status === 'player_blundered';
  const isOver = status === 'game_over';
  const maxHints = settings.personality === 'Loud' ? 99 : 3;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppBar
        left="‹"
        title="vs Coach"
        sub={`Lv ${level} · ${levelToElo(level)} ELO`}
        right={isPlayerTurn ? '' : '⏸'}
        onLeft={() => nav.goBack()}
      />

      <View style={styles.body}>
        {/* Coach quote */}
        <View style={[styles.coachQuote, { backgroundColor: colors.brandSoft, borderColor: colors.brandTint }]}>
          <Text style={[styles.quoteMark, { color: colors.brand }]}>"</Text>
          <View style={styles.quoteContent}>
            <Text style={[styles.quoteMain, { color: colors.brand2, fontFamily: 'serif', fontStyle: 'italic' }]}>
              {isThinking ? 'Thinking...' : isOver
                ? (result === 'win' ? 'Well played — you won!' : result === 'draw' ? 'Draw agreed.' : 'Game over.')
                : coachComment}
            </Text>
            {lastPlayerMove?.analysis && (
              <Text style={[styles.quoteSub, { color: colors.brand2 }]}>
                {qualityLabel(lastPlayerMove.analysis.quality)} · {formatEval(lastPlayerMove.analysis.evalAfter)}
              </Text>
            )}
          </View>
          <Pill tone={lastPlayerMove?.analysis ? `${qualityTone(lastPlayerMove.analysis.quality)}-soft` as any : 'good-soft'}>
            {evalText}
          </Pill>
        </View>

        {/* Clock (if enabled) */}
        {timeWhite !== null && (
          <View style={styles.clockRow}>
            <View style={[styles.clock, { backgroundColor: playerColor === 'b' ? colors.ink : colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.clockText, { color: playerColor === 'b' ? colors.surface : colors.ink, fontFamily: 'monospace' }]}>
                {formatTime(playerColor === 'b' ? timeBlack : timeWhite)}
              </Text>
              <Text style={[styles.clockLabel, { color: playerColor === 'b' ? colors.surface : colors.inkMute }]}>You</Text>
            </View>
            <View style={[styles.clock, { backgroundColor: playerColor === 'w' ? colors.ink : colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.clockText, { color: playerColor === 'w' ? colors.surface : colors.ink, fontFamily: 'monospace' }]}>
                {formatTime(playerColor === 'w' ? timeBlack : timeWhite)}
              </Text>
              <Text style={[styles.clockLabel, { color: playerColor === 'w' ? colors.surface : colors.inkMute }]}>Coach</Text>
            </View>
          </View>
        )}

        {/* Board + eval */}
        <View style={styles.boardRow}>
          <EvalBar pct={evalPct} label={evalLabel} />
          <View
            style={styles.boardWrap}
            onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
          >
            <Board
              pieces={boardPieces.length > 0 ? boardPieces : fallbackPieces}
              highlights={highlights}
              coords
              flipped={playerColor === 'b'}
              onSquarePress={isPlayerTurn ? handleSquarePress : undefined}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
              lastMove={lastMove}
              animate
            />
            <CapturePopup
              flash={captureFlash}
              boardSize={boardWidth}
              flipped={playerColor === 'b'}
              gainColor={colors.captureGain}
              lossColor={colors.captureLoss}
              onDone={clearCaptureFlash}
            />
          </View>
        </View>

        {/* Blunder alert */}
        {isBlunder && lastPlayerMove?.analysis && (
          <Card variant="bad" tight>
            <View style={styles.blunderRow}>
              <Pill tone="bad">{qualityLabel(lastPlayerMove.analysis.quality)}</Pill>
              <Text style={[styles.blunderText, { color: colors.bad2 }]}>
                {lastPlayerMove.analysis.explanation}
              </Text>
              <TouchableOpacity
                style={[styles.blunderBtn, { backgroundColor: colors.bad }]}
                onPress={() => nav.navigate('Feedback')}
              >
                <Text style={[styles.blunderBtnText, { color: '#fff' }]}>See</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.blunderBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={clearBlunderAlert}
              >
                <Text style={[styles.blunderBtnText, { color: colors.ink }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Game over banner */}
        {isOver && (
          <Card variant={result === 'win' ? 'good' : result === 'loss' ? 'bad' : 'flat'} tight>
            <View style={styles.blunderRow}>
              <Text style={[styles.blunderText, { color: result === 'win' ? colors.good2 : result === 'loss' ? colors.bad2 : colors.ink }]}>
                {result === 'win' ? 'You won!' : result === 'loss' ? 'You lost.' : 'Draw.'}
              </Text>
              <TouchableOpacity
                style={[styles.blunderBtn, { backgroundColor: colors.brand }]}
                onPress={() => nav.navigate('Review')}
              >
                <Text style={[styles.blunderBtnText, { color: colors.onBrand }]}>Review</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Notation */}
        {!isOver && !isBlunder && (
          <Card variant="flat" tight style={styles.notation}>
            <Text style={[styles.notationKicker, { color: colors.inkMute }]}>Last moves</Text>
            <Text style={[styles.notationMoves, { color: colors.inkSoft, fontFamily: 'monospace' }]}>
              {lastNotation || '…'}{' '}
              {isPlayerTurn && <Text style={{ color: colors.ink }}>?</Text>}
            </Text>
            {isThinking && <Text style={[styles.notationChev, { color: colors.inkMute }]}>⌛</Text>}
          </Card>
        )}

        <View style={{ flex: 1 }} />

        {/* Actions */}
        {!isOver && (
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnBrand, { backgroundColor: colors.brand, opacity: hintsUsed >= maxHints ? 0.4 : 1 }]}
              onPress={() => { if (hintsUsed < maxHints) { useHint(); nav.navigate('Hint'); } }}
              disabled={hintsUsed >= maxHints}
            >
              <Text style={[styles.btnText, { color: colors.onBrand }]}>
                Hint {maxHints < 99 ? `(${maxHints - hintsUsed})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: canUndo() ? 1 : 0.4 },
              ]}
              onPress={() => { if (canUndo()) undoLastMove(); }}
              disabled={!canUndo()}
            >
              <Text style={[styles.btnText, { color: colors.ink }]}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowResignModal(true)}
            >
              <Text style={[styles.btnText, { color: colors.ink }]}>Resign</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={offerDraw}
            >
              <Text style={[styles.btnText, { color: colors.ink }]}>½</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOver && (
          <TouchableOpacity
            style={[styles.btn, styles.btnFull, { backgroundColor: colors.ink }]}
            onPress={() => nav.navigate('ColorPicker')}
          >
            <Text style={[styles.btnText, { color: colors.surface }]}>New game</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Resign modal */}
      <Modal visible={showResignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Resign?</Text>
            <Text style={[styles.modalSub, { color: colors.inkSoft }]}>This counts as a loss.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.bad }]}
                onPress={() => { setShowResignModal(false); resign(); }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Resign</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowResignModal(false)}
              >
                <Text style={{ color: colors.ink, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Promotion modal */}
      <Modal visible={!!promotionPending} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Promote to?</Text>
            <View style={styles.promotionBtns}>
              {(['q', 'r', 'b', 'n'] as const).map(p => {
                const code = (playerColor === 'w' ? 'w' : 'b') + p.toUpperCase();
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.promoBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                    onPress={() => {
                      if (promotionPending) {
                        makeMove(promotionPending.from, promotionPending.to, p);
                        setPromotionPending(null);
                      }
                    }}
                  >
                    <ChessPiece code={code} size={52} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 10 },
  coachQuote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, paddingLeft: 40, borderWidth: 1, borderRadius: 18, position: 'relative',
  },
  quoteMark: {
    position: 'absolute', left: 10, top: 0, fontSize: 44,
    fontFamily: 'serif', fontStyle: 'italic', fontWeight: '600', lineHeight: 52,
  },
  quoteContent: { flex: 1 },
  quoteMain: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  quoteSub: { fontSize: 12, lineHeight: 16, marginTop: 2, opacity: 0.88 },
  clockRow: { flexDirection: 'row', gap: 10 },
  clock: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  clockText: { fontSize: 20, fontWeight: '700' },
  clockLabel: { fontSize: 11 },
  boardRow: { flexDirection: 'row', gap: 8 },
  boardWrap: { flex: 1, position: 'relative' },
  notation: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notationKicker: { fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  notationMoves: { flex: 1, fontSize: 12 },
  notationChev: { fontSize: 16 },
  blunderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  blunderText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  blunderBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, minWidth: 44,
    alignItems: 'center',
  },
  blunderBtnText: { fontSize: 12, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, minHeight: 44,
  },
  btnFull: { borderWidth: 0 },
  btnBrand: { borderWidth: 0 },
  btnText: { fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: 280, borderRadius: 20, padding: 24,
    borderWidth: 1, gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', fontFamily: 'serif' },
  modalSub: { fontSize: 13 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  promotionBtns: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  promoBtn: {
    width: 52, height: 52, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  promoGlyph: { fontSize: 30 },
});
