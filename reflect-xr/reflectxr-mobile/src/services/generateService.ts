import api from './api';

export interface GeneratedImage {
  id: string;
  image_url: string;
  thumbnail_url?: string;
  prompt_used: string;
  style_used: string;
}

export const generateImages = async (
  prompt: string,
  style: string,
  conceptId: string,
  count: number = 4
) => {
  const res = await api.post('/generate', { prompt, style, concept_id: conceptId, count });
  return res.data;
};

export const selectImage = async (imageId: string, sessionId: string) => {
  const res = await api.post('/generate/select', { image_id: imageId, session_id: sessionId });
  return res.data;
};
