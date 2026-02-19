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

export interface SourceChannel {
  id: string;
  telegramId: string;
  username: string;
  title: string | null;
  isActive: boolean;
}

export interface SubscriptionList {
  id: string;
  name: string;
  destinationUsername: string | null;
  isActive: boolean;
  sourceChannels: SourceChannel[];
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
