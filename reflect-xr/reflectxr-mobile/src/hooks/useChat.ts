import { useState, useCallback } from 'react';
import { Message } from '../types/chat';
import { mockMessages, mockChatImageUrl } from '../data/mockMessages';

const USE_MOCK = true;

const MOCK_RESPONSES = [
  {
    content: "That's really insightful. It sounds like you're carrying a lot right now. What would feel like a small relief?",
    emotion_tags: [{ emotion: 'stress', intensity: 0.6 }, { emotion: 'hope', intensity: 0.4 }],
  },
  {
    content: "I hear you. It takes courage to sit with these feelings. What's one thing that brought you even a small moment of peace recently?",
    emotion_tags: [{ emotion: 'courage', intensity: 0.5 }, { emotion: 'calm', intensity: 0.3 }],
  },
  {
    content: "Thank you for sharing that. Sometimes naming what we feel is the first step toward understanding it. How does it feel to say it out loud?",
    emotion_tags: [{ emotion: 'clarity', intensity: 0.6 }],
  },
];

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState('mock-session-1');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 1500));
      const mockReply = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      const shouldGenerateImage = messages.length >= 6 && !generatedImageUrl;
      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: shouldGenerateImage
          ? `${mockReply.content} I created a piece of art that reflects our conversation.`
          : mockReply.content,
        emotion_tags: mockReply.emotion_tags,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
      if (shouldGenerateImage) {
        setGeneratedImageUrl(mockChatImageUrl);
      }
      return;
    }
    // TODO: call chatService.sendMessage(sessionId, text)
  }, [messages.length, generatedImageUrl]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setGeneratedImageUrl(null);
  }, []);

  return {
    messages,
    isTyping,
    sessionId,
    generatedImageUrl,
    sendMessage,
    clearChat,
  };
}
