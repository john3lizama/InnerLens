import { GeneratedImage } from '../types/image';

export const createMockImages = (sessionId: string = 'session-1'): GeneratedImage[] => [
  {
    id: `${sessionId}-img-1`,
    image_url: `https://picsum.photos/seed/${sessionId}-1/800/800`,
    thumbnail_url: `https://picsum.photos/seed/${sessionId}-1/200/200`,
    prompt_used: 'Gentle waves of worry rising from a deep ocean, softly dissolving into perfectly calm, glass-like water under a pastel sky',
    style_used: 'Watercolor',
    is_selected: false,
    source: 'concept',
    created_at: new Date().toISOString(),
  },
  {
    id: `${sessionId}-img-2`,
    image_url: `https://picsum.photos/seed/${sessionId}-2/800/800`,
    thumbnail_url: `https://picsum.photos/seed/${sessionId}-2/200/200`,
    prompt_used: 'Gentle waves of worry rising from a deep ocean, softly dissolving into perfectly calm, glass-like water under a pastel sky',
    style_used: 'Watercolor',
    is_selected: false,
    source: 'concept',
    created_at: new Date().toISOString(),
  },
  {
    id: `${sessionId}-img-3`,
    image_url: `https://picsum.photos/seed/${sessionId}-3/800/800`,
    thumbnail_url: `https://picsum.photos/seed/${sessionId}-3/200/200`,
    prompt_used: 'Gentle waves of worry rising from a deep ocean, softly dissolving into perfectly calm, glass-like water under a pastel sky',
    style_used: 'Watercolor',
    is_selected: false,
    source: 'concept',
    created_at: new Date().toISOString(),
  },
  {
    id: `${sessionId}-img-4`,
    image_url: `https://picsum.photos/seed/${sessionId}-4/800/800`,
    thumbnail_url: `https://picsum.photos/seed/${sessionId}-4/200/200`,
    prompt_used: 'Gentle waves of worry rising from a deep ocean, softly dissolving into perfectly calm, glass-like water under a pastel sky',
    style_used: 'Watercolor',
    is_selected: false,
    source: 'concept',
    created_at: new Date().toISOString(),
  },
];
