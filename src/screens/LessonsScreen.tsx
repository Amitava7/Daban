import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Board } from '../components/Board';
import { Pill } from '../components/Pill';
import { fenToPieces } from '../utils/fenUtils';
import { TOPICS } from '../lessons/config';
import { getLessonById } from '../lessons';
import { nextLesson, topicStats, totalStats } from '../lessons/progress';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Lessons'>;

export function LessonsScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { lessonProgress } = useProgress();

  const upNext = nextLesson(lessonProgress);
  const overall = totalStats(lessonProgress);

  // Preview the position the next lesson opens on.
  const previewPieces = useMemo(() => {
    if (!upNext) return {};
    const lesson = getLessonById(upNext.id);
    const first = lesson?.steps[0];
    return first ? fenToPieces(first.fen) : {};
  }, [upNext]);

  const upNextTopic = upNext ? TOPICS.find(t => t.id === upNext.topic) : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppBar
        title="Lessons"
        sub={`${overall.completed} of ${overall.total} complete`}
        onLeft={() => nav.goBack()}
        right={null}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {upNext ? (
          <TouchableOpacity
            style={[styles.hero, { backgroundColor: colors.brandSoft, borderColor: colors.brandTint }]}
            onPress={() => nav.navigate('LessonPlayer', { lessonId: upNext.id })}
            activeOpacity={0.85}
          >
            <View style={styles.heroBoard}>
              <Board pieces={previewPieces} size={92} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.kicker, { color: colors.brand }]}>Next lesson</Text>
              <Text style={[styles.heroTitle, { color: colors.brand2 }]} numberOfLines={2}>
                {upNext.title}
              </Text>
              <Text style={[styles.heroMeta, { color: colors.brand2 }]} numberOfLines={1}>
                {upNextTopic?.title} · Level {upNext.level} · {upNext.estMinutes} min
              </Text>
            </View>
            <View style={[styles.heroBtn, { backgroundColor: colors.brand }]}>
              <Text style={[styles.heroBtnText, { color: colors.onBrand }]}>▶</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.hero, { backgroundColor: colors.goodSoft, borderColor: colors.goodBorder }]}>
            <View style={styles.heroInfo}>
              <Text style={[styles.kicker, { color: colors.good }]}>All done</Text>
              <Text style={[styles.heroTitle, { color: colors.good }]}>
                Every lesson complete
              </Text>
              <Text style={[styles.heroMeta, { color: colors.good }]}>
                Replay any lesson to raise your star score.
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.inkMute }]}>Choose a topic</Text>

        <View style={styles.grid}>
          {TOPICS.map(topic => {
            const stats = topicStats(topic.id, lessonProgress);
            const pct = stats.total > 0 ? stats.completed / stats.total : 0;
            const done = stats.completed === stats.total;
            return (
              <TouchableOpacity
                key={topic.id}
                style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => nav.navigate('LessonTopic', { topicId: topic.id })}
                activeOpacity={0.8}
              >
                <View style={styles.tileHead}>
                  <Text style={styles.tileIcon}>{topic.icon}</Text>
                  {done && <Pill tone="good-soft">done</Pill>}
                </View>
                <Text style={[styles.tileTitle, { color: colors.ink }]}>{topic.title}</Text>
                <Text style={[styles.tileDesc, { color: colors.inkSoft }]} numberOfLines={2}>
                  {topic.description}
                </Text>
                <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
                  <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: done ? colors.good : colors.brand }]} />
                </View>
                <Text style={[styles.tileMeta, { color: colors.inkMute }]}>
                  {stats.completed}/{stats.total} lessons
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, gap: 14, paddingBottom: 32 },
  kicker: { fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1.2 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderWidth: 1, borderRadius: 18,
  },
  heroBoard: { width: 92, flexShrink: 0 },
  heroInfo: { flex: 1 },
  heroTitle: { fontSize: 20, fontFamily: 'serif', fontStyle: 'italic', fontWeight: '500', lineHeight: 24, marginTop: 4 },
  heroMeta: { fontSize: 12, opacity: 0.8, marginTop: 3 },
  heroBtn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  heroBtnText: { fontSize: 16 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase',
    letterSpacing: 1.2, marginTop: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%', flexGrow: 1, padding: 14, borderWidth: 1, borderRadius: 16, gap: 6,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { fontSize: 26 },
  tileTitle: { fontSize: 15, fontWeight: '600' },
  tileDesc: { fontSize: 12, lineHeight: 16, minHeight: 32 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 999 },
  tileMeta: { fontSize: 11, fontFamily: 'monospace' },
});
