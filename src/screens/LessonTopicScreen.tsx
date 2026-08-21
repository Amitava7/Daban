import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useProgress } from '../context/ProgressContext';
import { RootStackParamList } from '../navigation/types';
import { AppBar } from '../components/AppBar';
import { Pill } from '../components/Pill';
import { TOPICS, lessonsForTopic } from '../lessons/config';
import { isUnlocked, topicStats, starString } from '../lessons/progress';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LessonTopic'>;
type Route = RouteProp<RootStackParamList, 'LessonTopic'>;

export function LessonTopicScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const { topicId } = useRoute<Route>().params;
  const { lessonProgress } = useProgress();

  const topic = TOPICS.find(t => t.id === topicId);
  const lessons = lessonsForTopic(topicId);
  const stats = topicStats(topicId, lessonProgress);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppBar
        title={topic?.title ?? 'Lessons'}
        sub={`${stats.completed} of ${stats.total} complete`}
        onLeft={() => nav.goBack()}
        right={null}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {topic && (
          <Text style={[styles.intro, { color: colors.inkSoft }]}>{topic.description}</Text>
        )}

        {lessons.map((lesson, index) => {
          const record = lessonProgress[lesson.id];
          const unlocked = isUnlocked(lesson.id, lessonProgress);
          const done = !!record?.completed;
          const inProgress = !done && (record?.lastStepIndex ?? 0) > 0;

          return (
            <TouchableOpacity
              key={lesson.id}
              disabled={!unlocked}
              activeOpacity={0.8}
              onPress={() => nav.navigate('LessonPlayer', { lessonId: lesson.id })}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: done ? colors.goodBorder : colors.border,
                  opacity: unlocked ? 1 : 0.55,
                },
              ]}
            >
              <View style={[
                styles.badge,
                { backgroundColor: done ? colors.goodSoft : unlocked ? colors.brandSoft : colors.surface2 },
              ]}>
                <Text style={[
                  styles.badgeText,
                  { color: done ? colors.good : unlocked ? colors.brand : colors.inkMute },
                ]}>
                  {done ? '✓' : unlocked ? String(index + 1) : '🔒'}
                </Text>
              </View>

              <View style={styles.grow}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
                    {lesson.title}
                  </Text>
                  <Pill tone={done ? 'good-soft' : 'default'}>Lv {lesson.level}</Pill>
                </View>
                <Text style={[styles.sub, { color: colors.inkSoft }]} numberOfLines={2}>
                  {lesson.subtitle}
                </Text>
                <Text style={[styles.meta, { color: colors.inkMute }]}>
                  {done
                    ? `${starString(record?.stars ?? 0)} · best ${record?.bestScorePct ?? 0}%`
                    : inProgress
                      ? `In progress · ${lesson.estMinutes} min`
                      : unlocked
                        ? `${lesson.estMinutes} min`
                        : 'Finish the lesson above to unlock'}
                </Text>
              </View>

              <Text style={[styles.chev, { color: colors.inkMute }]}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, gap: 10, paddingBottom: 32 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14,
  },
  badge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 15, fontWeight: '700' },
  grow: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  meta: { fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  chev: { fontSize: 18 },
});
