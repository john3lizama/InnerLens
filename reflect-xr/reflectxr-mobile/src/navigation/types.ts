import { Concept } from '../types/concept';
import { GeneratedImage } from '../types/image';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Create: undefined;
  MindMate: undefined;
  Journal: undefined;
  Profile: undefined;
};

export type CreateStackParamList = {
  Concepts: undefined;
  PromptDesign: { concept: Concept };
  PromptEdit: { prompt: string; style: string; concept: Concept };
  Response: { prompt: string; style: string; concept: Concept };
  Reflect: { image: GeneratedImage; concept: Concept; sessionId: string };
};

export type JournalStackParamList = {
  JournalList: undefined;
  JournalDetail: { journalId: string };
};

export type ChatStackParamList = {
  Chat: { loadSessionId?: string } | undefined;
  ChatHistory: undefined;
  ChatImageReveal: { imageUrl: string };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  AlexaGallery: undefined;
  AlexaImageReveal: { imageUrl: string };
};
