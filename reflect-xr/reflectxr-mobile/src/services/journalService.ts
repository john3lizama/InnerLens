import api from './api';

export const getJournals = async (limit = 20, offset = 0) => {
  const res = await api.get('/journal', { params: { limit, offset } });
  return res.data;
};

export const getJournalById = async (id: string) => {
  const res = await api.get(`/journal/${id}`);
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
