import api from './api';

export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

/**
 * Legacy direct registration (no email verification).
 * Kept for backward compatibility — the app now uses the two-step flow.
 */
export const register = async (email: string, password: string, displayName: string) => {
  const res = await api.post('/auth/register', { email, password, display_name: displayName });
  return res.data;
};

/**
 * Step 1: Request registration — sends a 4-digit verification code to the email.
 * Password is hashed and stored server-side. Never sent again in step 2.
 */
export const requestRegistration = async (
  email: string,
  password: string,
  displayName: string
): Promise<{ message: string; dev_code?: string }> => {
  const res = await api.post('/auth/register/request', {
    email,
    password,
    display_name: displayName,
  });
  return res.data;
};

/**
 * Step 2: Verify the 4-digit code to complete registration.
 * Returns access + refresh tokens. No password needed — it's stored server-side.
 */
export const verifyRegistration = async (
  email: string,
  code: string
): Promise<{ access_token: string; refresh_token: string; token_type: string }> => {
  const res = await api.post('/auth/register/verify', { email, code });
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const updateMe = async (data: { preferred_style?: string; display_name?: string }) => {
  const res = await api.patch('/auth/me', data);
  return res.data;
};

/**
 * Step 1: Request an email change — sends a 4-digit code to the new email.
 */
export const requestEmailChange = async (newEmail: string) => {
  const res = await api.post('/auth/me/request-email-change', { new_email: newEmail });
  return res.data;
};

/**
 * Step 2: Verify the code and apply the email change.
 */
export const verifyEmailChange = async (newEmail: string, code: string) => {
  const res = await api.post('/auth/me/verify-email-change', { new_email: newEmail, code });
  return res.data;
};

/**
 * Upload a profile picture from a local file URI.
 */
export const uploadProfileImage = async (imageUri: string) => {
  const formData = new FormData();

  const filename = imageUri.split('/').pop() || 'profile.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  formData.append('file', {
    uri: imageUri,
    type: mimeType,
    name: filename,
  } as any);

  const res = await api.post('/auth/me/profile-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

/**
 * Remove the current profile picture.
 */
export const deleteProfileImage = async () => {
  const res = await api.delete('/auth/me/profile-image');
  return res.data;
};
