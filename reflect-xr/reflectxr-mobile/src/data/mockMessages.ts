import { Message } from '../types/chat';

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: 'Hey there. How are you feeling today? No pressure to have a perfect answer — whatever comes to mind is a good place to start.',
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-2',
    role: 'user',
    content: 'I have been feeling really overwhelmed with school and work lately. It is hard to keep up with everything.',
    created_at: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content: 'That sounds like a lot to carry. Balancing school and work takes real effort, and it makes sense that you would feel stretched thin. What part feels heaviest right now?',
    emotion_tags: [
      { emotion: 'overwhelm', intensity: 0.7 },
      { emotion: 'stress', intensity: 0.6 },
    ],
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-4',
    role: 'user',
    content: 'Probably the deadlines. I feel like I am always behind no matter how hard I try.',
    created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-5',
    role: 'assistant',
    content: 'That feeling of never catching up can be exhausting. Sometimes when we are in the thick of it, it is hard to see how much we are actually getting done. What is one thing you finished recently that you felt okay about?',
    emotion_tags: [
      { emotion: 'stress', intensity: 0.8 },
      { emotion: 'anxiety', intensity: 0.5 },
    ],
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-6',
    role: 'user',
    content: 'I did finish a project last week that I was proud of. It just feels like there is always another one right behind it.',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg-7',
    role: 'assistant',
    content: 'I hear you. And that pride you felt — hold onto that for a moment. You did something meaningful, even in the middle of all the pressure. I created a piece of art that reflects what you have been sharing — waves of pressure rising, then gently settling into calm.',
    emotion_tags: [
      { emotion: 'overwhelm', intensity: 0.6 },
      { emotion: 'hope', intensity: 0.5 },
      { emotion: 'strength', intensity: 0.4 },
    ],
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
];

export const mockChatImageUrl = 'https://picsum.photos/seed/mindmate-art/800/600';
