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
  Playground: undefined;
  Journal: undefined;
  Profile: undefined;
};

export type CreateStackParamList = {
  Concepts: undefined;
  PromptDesign: { concept: Concept };
  PromptEdit: { prompt: string; style: string; concept: Concept };
  // `jobId` is optional and only present when we deep-link in from a
  // push notification tap — ResponseScreen skips the initial generate
  // call and resumes polling the pre-existing job.
  Response: { prompt: string; style: string; concept: Concept; jobId?: string };
  Reflect: { image: GeneratedImage; concept: Concept; sessionId: string };
};

export type JournalStackParamList = {
  JournalList: undefined;
  JournalDetail: { journalId: string; editMode?: boolean };
  Favorites: undefined;
};

/**
 * Playground stack — the tab landing on PlaygroundHubScreen, with each
 * "feature card" pushing into its own screen flow:
 *   - MindMate chat: Chat / ChatHistory / ChatImageReveal
 *   - Alexa Beta:    AlexaSetup -> AlexaGallery -> AlexaImageReveal
 *   - Immersive:     external link (no screen)
 *   - Reflection Environment: stub screen until designed
 */
export type PlaygroundStackParamList = {
  PlaygroundHub: undefined;
  Chat: { loadSessionId?: string } | undefined;
  ChatHistory: undefined;
  ChatImageReveal: { imageUrl: string };
  AlexaSetup: undefined;
  AlexaGallery: undefined;
  AlexaImageReveal: { imageUrl: string };
  ReflectionEnvironment: undefined;
  Learning: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Privacy: undefined;
};
