/**
 * moodService — GET /mood/timeseries for the Home-tab mood graph.
 *
 * Returns the full intensity-weighted emotion distribution for each day
 * in the user's tz, plus gating counts. The UI uses `unlocked` to decide
 * whether to render the real graph or an example/locked state — we
 * don't try to enforce that logic here.
 *
 * Each day's `emotions[]` shares sum to ~1.0 — the client renders every
 * day's pill at full height and divides it proportionally.
 */

import api from './api';
import { getDeviceTz } from './journalService';

export interface EmotionShare {
  emotion: string;             // lowercase raw label, e.g. "joy"
  share: number;               // 0..1; shares within a day sum to ~1.0
  valence: -1 | 0 | 1;         // signed direction via backend valence_of()
}

export interface MoodDay {
  date: string;                // "YYYY-MM-DD" in device tz
  emotions: EmotionShare[];    // sorted by share desc; always non-empty
}

export interface MoodTimeseries {
  days: MoodDay[];             // sorted ascending; missing days omitted
  conversation_count: number;
  journal_count: number;
  unlocked: boolean;           // conversation_count + journal_count >= 3
}

export const getMoodTimeseries = async (days = 14): Promise<MoodTimeseries> => {
  const res = await api.get('/mood/timeseries', {
    params: { days, tz: getDeviceTz() },
  });
  return res.data;
};
