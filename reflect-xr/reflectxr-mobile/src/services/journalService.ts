import api from './api';

/**
 * Return the device's current IANA timezone (e.g. "America/Los_Angeles").
 *
 * Uses Hermes' Intl implementation, which reads the OS timezone on both iOS
 * and Android in Expo SDK 55. Resolved per call (not cached at module load)
 * so if the user travels mid-session, the next request picks up the new zone.
 *
 * A dev-only warning fires if detection fails so we notice instead of
 * silently bucketing everyone into UTC.
 *
 * Note: we previously tried expo-localization for an OS-direct read, but it
 * ships a native module that requires a dev-client rebuild to link. If we
 * ever rebuild the client, it's worth layering back in — the Intl path
 * stays as the fallback.
 */
export function getDeviceTz(): string {
  try {
    const fromIntl = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (fromIntl) return fromIntl;
  } catch {}

  if (__DEV__) {
    console.warn('[tz] could not detect device timezone, falling back to UTC');
  }
  return 'UTC';
}

export const getJournals = async (limit = 20, offset = 0) => {
  const res = await api.get('/journal', { params: { limit, offset } });
  return res.data;
};

export const getJournalById = async (id: string) => {
  const res = await api.get(`/journal/${id}`);
  return res.data;
};

/**
 * Fetch active dates for the activity grid.
 * Returns an array of date strings (YYYY-MM-DD) where the user had activity
 * (reflections, chat sessions, or voice interactions).
 */
export const getActivityDates = async (year: number): Promise<string[]> => {
  const res = await api.get('/activity/dates', { params: { year, tz: getDeviceTz() } });
  return res.data.dates;
};

/**
 * Fetch aggregate activity stats for the profile.
 * Returns reflection count and conversation count.
 */
export const getActivityStats = async (): Promise<{ reflections: number; conversations: number }> => {
  const res = await api.get('/activity/stats');
  return res.data;
};

/**
 * Streak data for the fire badge and streak popup.
 */
export interface RecentDay {
  date: string;
  day_letter: string;
  active: boolean;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  is_today_active: boolean;
  recent_days: RecentDay[];
}

export const getStreak = async (): Promise<StreakData> => {
  const res = await api.get('/activity/streak', { params: { tz: getDeviceTz() } });
  return res.data;
};

export const createJournal = async (
  imageId: string,
  sessionId: string,
  content: string,
  reflectionPromptUsed?: string
) => {
  const res = await api.post('/journal', {
    image_id: imageId,
    session_id: sessionId,
    content,
    reflection_prompt_used: reflectionPromptUsed,
  });
  return res.data;
};

export const deleteJournal = async (id: string): Promise<void> => {
  await api.delete(`/journal/${id}`);
};

export const updateJournal = async (id: string, content: string) => {
  const res = await api.patch(`/journal/${id}`, { content });
  return res.data;
};

/**
 * Toggle the favorite flag on a journal entry.
 * Client passes the desired state (not a blind toggle) so a flaky network
 * or double-tap doesn't flip it to the wrong value. Returns the full
 * journal detail.
 */
export const toggleJournalFavorite = async (id: string, isFavorite: boolean) => {
  const res = await api.patch(`/journal/${id}/favorite`, { is_favorite: isFavorite });
  return res.data;
};
