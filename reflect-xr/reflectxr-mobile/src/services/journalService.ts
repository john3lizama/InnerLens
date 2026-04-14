import api from './api';

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
  const res = await api.get('/activity/dates', { params: { year } });
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
  const res = await api.get('/activity/streak');
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
