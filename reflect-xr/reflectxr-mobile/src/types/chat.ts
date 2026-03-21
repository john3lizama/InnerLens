export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion_tags?: EmotionTag[];
  created_at: string;
}

export interface EmotionTag {
  emotion: string;
  intensity: number;
}

export interface ChatSession {
  id: string;
  created_at: string;
  message_count: number;
  dominant_emotions: string[];
  has_generated_images: boolean;
}
