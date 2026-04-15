/**
 * moodService — GET /mood/timeseries for the Home-tab mood graph.
 *
 * Returns one dominant-emotion point per day in the user's tz, plus
 * gating counts. The UI uses `unlocked` to decide whether to render the
 * real graph or an example/locked state — we don't try to enforce that
 * logic here.
 */

import api from './api';
import { getDeviceTz } from './journalService';

export interface MoodDay {
  date: string;                // "YYYY-MM-DD" in device tz
  dominant_emotion: string;    // lowercase, e.g. "joy"
  intensity: number;           // 0..1
  valence: -1 | 0 | 1;         // signed direction for the bar
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
