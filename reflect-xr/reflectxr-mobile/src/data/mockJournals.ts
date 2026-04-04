import { JournalEntry } from '../types/journal';

export const mockJournals: JournalEntry[] = [
  {
    id: 'journal-1',
    content: 'Looking at the waves in this image, I feel like my worries have a shape now — something I can watch rise and fall instead of something that controls me. The calm water at the edges reminds me that everything settles eventually.',
    emotion_tags: [
      { emotion: 'calm', intensity: 0.7 },
      { emotion: 'hope', intensity: 0.5 },
    ],
    image: {
      id: 'img-1',
      image_url: 'https://picsum.photos/seed/waves-calm/800/600',
      thumbnail_url: 'https://picsum.photos/seed/waves-calm/200/150',
    },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    word_count: 42,
  },
  {
    id: 'journal-2',
    content: 'The garden in this artwork feels like my own growth — messy, colorful, and alive. I realize that patience is not about waiting, but about tending to what matters even when you cannot see the results yet.',
    emotion_tags: [
      { emotion: 'gratitude', intensity: 0.8 },
      { emotion: 'hope', intensity: 0.6 },
    ],
    image: {
      id: 'img-2',
      image_url: 'https://picsum.photos/seed/garden-grow/800/600',
      thumbnail_url: 'https://picsum.photos/seed/garden-grow/200/150',
    },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    word_count: 38,
  },
  {
    id: 'journal-3',
    content: 'This horizon makes me think about the courage I have been building. There is so much ahead of me, and for the first time in a while, that feels exciting instead of terrifying.',
    emotion_tags: [
      { emotion: 'courage', intensity: 0.9 },
      { emotion: 'joy', intensity: 0.4 },
    ],
    image: {
      id: 'img-3',
      image_url: 'https://picsum.photos/seed/horizon-sun/800/600',
      thumbnail_url: 'https://picsum.photos/seed/horizon-sun/200/150',
    },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    word_count: 33,
  },
  {
    id: 'journal-4',
    content: 'The image of light and shadow coexisting speaks to me deeply. I do not need to choose between my strength and my vulnerability — they feed each other.',
    emotion_tags: [
      { emotion: 'strength', intensity: 0.7 },
      { emotion: 'calm', intensity: 0.6 },
    ],
    image: {
      id: 'img-4',
      image_url: 'https://picsum.photos/seed/light-shadow/800/600',
      thumbnail_url: 'https://picsum.photos/seed/light-shadow/200/150',
    },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    word_count: 29,
  },
  {
    id: 'journal-5',
    content: 'Sitting with this image of a vast, quiet space — I realize the emptiness is not something to fear. It is room for something new.',
    emotion_tags: [
      { emotion: 'loneliness', intensity: 0.4 },
      { emotion: 'hope', intensity: 0.7 },
    ],
    image: {
      id: 'img-5',
      image_url: 'https://picsum.photos/seed/vast-space/800/600',
      thumbnail_url: 'https://picsum.photos/seed/vast-space/200/150',
    },
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    word_count: 25,
  },
];
