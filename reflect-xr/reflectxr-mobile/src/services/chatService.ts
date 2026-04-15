import api from './api';
import { Message } from '../types/chat';

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

export interface ChatSessionSummary {
  id: string;
  created_at: string;
  preview: string;
  message_count: number;
  journal_count: number;
  has_image: boolean;
}

export interface ChatSessionDetail {
  id: string;
  created_at: string;
  messages: Message[];
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

/**
 * Fetch the user's paginated MindMate chat history (newest first).
 */
export const listSessions = async (
  limit = 50,
  offset = 0
): Promise<ChatSessionSummary[]> => {
  const res = await api.get('/chat/sessions', { params: { limit, offset } });
  return res.data;
};

/**
 * Fetch the full ordered message history for one chat session.
 */
export const getSession = async (id: string): Promise<ChatSessionDetail> => {
  const res = await api.get(`/chat/sessions/${id}`);
  return res.data;
};

/**
 * Delete a single chat session. Cascades to its messages, images, and any
 * journal entries linked to it. Idempotent; 404 on a session the user
 * doesn't own.
 */
export const deleteSession = async (id: string): Promise<void> => {
  await api.delete(`/chat/sessions/${id}`);
};

/**
 * Delete ALL of the current user's MindMate chat sessions. Concept→Generate
 * sessions are untouched.
 */
export const deleteAllSessions = async (): Promise<void> => {
  await api.delete('/chat/sessions');
};
