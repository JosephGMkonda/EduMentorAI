export interface HistoryEntry {
  topic: string;
  subject: string;
  form: string;
  at: string;
}

export interface ProgressState {
  topics: Record<string, { scores: number[]; lastSeen: string }>;
  xp: number;
  streak: { count: number; lastDate: string };
  history: HistoryEntry[];
  bookmarks: HistoryEntry[];
}

const KEY = "edm-progress-v1";

const defaultState: ProgressState = {
  topics: {},
  xp: 0,
  streak: { count: 0, lastDate: "" },
  history: [],
  bookmarks: [],
};

export const topicKey = (topic: string, subject: string, form: string) =>
  `${form}::${subject}::${topic}`;

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

export function saveProgress(state: ProgressState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("edm-progress"));
  } catch {
    // storage unavailable
  }
}

function bumpStreak(state: ProgressState): ProgressState {
  const today = new Date().toISOString().slice(0, 10);
  if (state.streak.lastDate === today) return state;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const count = state.streak.lastDate === yesterday ? state.streak.count + 1 : 1;
  return { ...state, streak: { count, lastDate: today } };
}

function recordTopicScore(
  state: ProgressState,
  key: string,
  score: number,
): ProgressState {
  const topic = state.topics[key] ?? { scores: [], lastSeen: "" };
  return {
    ...state,
    topics: {
      ...state.topics,
      [key]: {
        scores: [...topic.scores.slice(-9), score],
        lastSeen: new Date().toISOString(),
      },
    },
  };
}

export function recordLesson(topic: string, subject: string, form: string) {
  const state = loadProgress();
  const entry = { topic, subject, form, at: new Date().toISOString() };
  const history = [
    entry,
    ...state.history.filter(
      (h) => !(h.topic === topic && h.subject === subject && h.form === form),
    ),
  ].slice(0, 30);
  let next = { ...state, history, xp: state.xp + 10 };
  next = bumpStreak(next);
  saveProgress(next);
}

export function recordQuizScore(topic: string, subject: string, form: string, pct: number) {
  const state = loadProgress();
  let next = { ...state, xp: state.xp + 20 };
  next = bumpStreak(next);
  next = recordTopicScore(next, topicKey(topic, subject, form), pct);
  saveProgress(next);
}

export function recordPracticeScore(
  topic: string,
  subject: string,
  form: string,
  pct: number,
) {
  const state = loadProgress();
  let next = { ...state, xp: state.xp + 20 };
  next = bumpStreak(next);
  next = recordTopicScore(next, topicKey(topic, subject, form), pct);
  saveProgress(next);
}

export function toggleBookmark(topic: string, subject: string, form: string) {
  const state = loadProgress();
  const entry = { topic, subject, form, at: new Date().toISOString() };
  const exists = state.bookmarks.some(
    (b) => b.topic === topic && b.subject === subject && b.form === form,
  );
  const bookmarks = exists
    ? state.bookmarks.filter(
        (b) => !(b.topic === topic && b.subject === subject && b.form === form),
      )
    : [entry, ...state.bookmarks];
  saveProgress({ ...state, bookmarks });
}

export function isBookmarked(topic: string, subject: string, form: string): boolean {
  return loadProgress().bookmarks.some(
    (b) => b.topic === topic && b.subject === subject && b.form === form,
  );
}

export function topicMastery(topic: string, subject: string, form: string): number {
  const scores = loadProgress().topics[topicKey(topic, subject, form)]?.scores ?? [];
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function totalMastery(state: ProgressState): number {
  const topics = Object.values(state.topics);
  if (!topics.length) return 0;
  const avg = topics
    .map((t) =>
      t.scores.length
        ? t.scores.reduce((a, b) => a + b, 0) / t.scores.length
        : 0,
    )
    .reduce((a, b) => a + b, 0);
  return Math.round(avg / topics.length);
}
