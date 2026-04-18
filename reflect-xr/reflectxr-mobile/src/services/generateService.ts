/**
 * generateService — talks to POST /generate and friends.
 *
 * The backend can return one of two shapes on /generate:
 *   200 { session_id, images }                 → images are ready
 *   202 { status: "pending", job_id }          → both providers failed in
 *                                                the sync path; a retry
 *                                                worker is running.
 *
 * The `GenerateResult` discriminated union lets callers handle both with
 * a single `switch (result.kind)`.
 */

import api from './api';

export interface GeneratedImage {
  id: string;
  image_url: string;
  thumbnail_url?: string;
  prompt_used: string;
  style_used: string;
}

export type GenerateResult =
  | { kind: 'ready'; session_id: string; images: GeneratedImage[] }
  | { kind: 'pending'; job_id: string };

export type PollResult =
  | { kind: 'ready'; session_id: string; images: GeneratedImage[] }
  | { kind: 'pending' }
  | { kind: 'failed'; error: string };

/**
 * Kick off generation. 200 returns images directly; 202 means we escalated
 * to the async retry worker and the caller should poll `pollJobStatus`.
 *
 * axios's default `validateStatus` treats any 2xx as success, so we
 * discriminate by `res.status` rather than relying on the response shape.
 */
export const generateImages = async (
  prompt: string,
  style: string,
  conceptId: string,
  count: number = 4,
): Promise<GenerateResult> => {
  const res = await api.post('/generate', {
    prompt,
    style,
    concept_id: conceptId,
    count,
  });
  if (res.status === 202) {
    return { kind: 'pending', job_id: res.data.job_id };
  }
  return {
    kind: 'ready',
    session_id: res.data.session_id,
    images: res.data.images,
  };
};

/**
 * Poll the async retry job. ResponseScreen calls this every 10 s while
 * the orb is in the extended-wait state. Notification-tap deep links
 * also hit this to hydrate ResponseScreen with the finished images.
 */
export const pollJobStatus = async (jobId: string): Promise<PollResult> => {
  const res = await api.get(`/generate/status/${jobId}`);
  const { status, session_id, images, error } = res.data;
  if (status === 'succeeded') {
    return {
      kind: 'ready',
      session_id,
      images: images ?? [],
    };
  }
  if (status === 'failed') {
    return { kind: 'failed', error: error ?? 'Image generation failed.' };
  }
  return { kind: 'pending' };
};

export const selectImage = async (imageId: string, sessionId: string) => {
  const res = await api.post('/generate/select', {
    image_id: imageId,
    session_id: sessionId,
  });
  return res.data;
};

// ── Push-token registration ─────────────────────────────────────────────
// Used by src/services/notificationService.ts after it obtains an Expo
// push token. Idempotent on the backend — safe to call on every launch.

export const registerPushToken = async (
  token: string,
  platform: 'ios' | 'android',
) => {
  const res = await api.post('/users/push_tokens', { token, platform });
  return res.data;
};

export const revokePushToken = async (token: string) => {
  // URL-encode the token — Expo tokens contain `[` and `]`.
  const res = await api.delete(
    `/users/push_tokens/${encodeURIComponent(token)}`,
  );
  return res.data;
};
