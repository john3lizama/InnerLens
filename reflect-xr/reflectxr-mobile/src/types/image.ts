export interface GeneratedImage {
  id: string;
  image_url: string;
  thumbnail_url?: string;
  prompt_used: string;
  style_used: string;
  is_selected: boolean;
  source: 'concept' | 'chat' | 'freeform';
  created_at: string;
}
