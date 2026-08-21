// Progress queries shared by the lessons screens. Unlocking is per topic:
// finish lesson n to open lesson n+1, while every topic stays browsable.

import { LESSONS, lessonsForTopic } from './config';
import { LessonMeta, TopicId } from './types';
import { LessonProgress } from '../services/StorageService';

export function isUnlocked(lessonId: string, progress: LessonProgress): boolean {
  const meta = LESSONS.find(l => l.id === lessonId);
  if (!meta) return false;
  const siblings = lessonsForTopic(meta.topic);
  const index = siblings.findIndex(l => l.id === lessonId);
  if (index <= 0) return true;
  const prev = siblings[index - 1];
  return !!progress[prev.id]?.completed;
}

export function topicStats(topicId: TopicId | string, progress: LessonProgress) {
  const lessons = lessonsForTopic(topicId);
  const completed = lessons.filter(l => progress[l.id]?.completed).length;
  return { completed, total: lessons.length };
}

export function totalStats(progress: LessonProgress) {
  const completed = LESSONS.filter(l => progress[l.id]?.completed).length;
  return { completed, total: LESSONS.length };
}

/** First unlocked, unfinished lesson in curriculum order — the "Next Lesson" card. */
export function nextLesson(progress: LessonProgress): LessonMeta | undefined {
  const open = LESSONS.find(l => !progress[l.id]?.completed && isUnlocked(l.id, progress));
  return open ?? LESSONS.find(l => !progress[l.id]?.completed);
}

/** The lesson after this one, for the "Next lesson" button on the score card. */
export function lessonAfter(lessonId: string): LessonMeta | undefined {
  const index = LESSONS.findIndex(l => l.id === lessonId);
  return index >= 0 ? LESSONS[index + 1] : undefined;
}

export function starString(stars: number): string {
  return '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars);
}
