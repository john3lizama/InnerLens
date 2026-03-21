export interface User {
  id: string;
  email: string;
  display_name: string;
  preferred_style?: string;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}
