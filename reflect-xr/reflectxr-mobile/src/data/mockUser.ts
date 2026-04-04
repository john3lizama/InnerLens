import { User } from '../types/user';

export const mockUser: User = {
  id: 'user-1',
  email: 'demo@reflectxr.app',
  display_name: 'Demo User',
  preferred_style: 'Watercolor',
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};
