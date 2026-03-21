export interface JournalEntry {
  id: string;
  content: string;
  emotion_tags: Array<{ emotion: string; intensity: number }>;
  image: {
    id: string;
    image_url: string;
    thumbnail_url?: string;
  };
  created_at: string;
  word_count: number;
}
