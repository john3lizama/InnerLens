import { useState, useCallback } from 'react';
import { Message } from '../types/chat';
import * as chatService from '../services/chatService';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
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

    try {
      const res = await chatService.sendMessage(sessionId, text);
      setSessionId(res.session_id);

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: res.reply,
        emotion_tags: res.emotion_tags,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // If the backend says it's time to generate an image, do it
      if (res.should_generate_image && !generatedImageUrl) {
        try {
          const genRes = await chatService.generateFromChat(res.session_id);
          if (genRes.image?.image_url) {
            const imageUrl = genRes.image.image_url;
            setGeneratedImageUrl(imageUrl);
            // Insert the image as a special message so it flows inline
            const imageMsg: Message = {
              id: `img-${Date.now()}`,
              role: 'assistant',
              content: `__IMAGE__${imageUrl}`,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, imageMsg]);
          }
        } catch (err) {
          console.error('Failed to generate chat image:', err);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId, generatedImageUrl]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
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
