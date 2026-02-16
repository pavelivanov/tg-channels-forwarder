export interface JwtPayload {
  sub: string;
  telegramId: string;
}

export interface UserProfile {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  isPremium: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface WebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export class ValidateInitDataDto {
  initData!: string;
}
