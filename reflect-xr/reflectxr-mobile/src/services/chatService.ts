import api from './api';

export interface EmotionTag {
  emotion: string;
  intensity: number;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  emotion_tags: EmotionTag[];
  mode_detected: string;
  should_generate_image: boolean;
  is_crisis: boolean;
}

export const sendMessage = async (
  sessionId: string | null,
  message: string
): Promise<ChatResponse> => {
  const res = await api.post('/chat', { session_id: sessionId, message });
  return res.data;
};

export const generateFromChat = async (sessionId: string) => {
  const res = await api.post('/chat/generate-from-conversation', { session_id: sessionId });
  return res.data;
};
