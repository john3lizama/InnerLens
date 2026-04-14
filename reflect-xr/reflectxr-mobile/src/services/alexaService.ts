import api from './api';

export interface AlexaGalleryImage {
  id: string;
  image_url: string;
  thumbnail_url?: string;
  created_at: string;
}

export interface AlexaGalleryItem {
  session_id: string;
  created_at: string;
  emotion_tags: { emotion: string; intensity: number }[] | null;
  images: AlexaGalleryImage[];
}

export interface AlexaGalleryResponse {
  items: AlexaGalleryItem[];
  count: number;
}

export const getAlexaGallery = async (): Promise<AlexaGalleryResponse> => {
  const res = await api.get('/alexa/gallery');
  return res.data;
};
