export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio: string | null;
  neighborhood: string;
  approxLatitude: number;
  approxLongitude: number;
  consentAt: string;
  createdAt: string;
}

export interface DemoAccountOption {
  userId: string;
  label: string;
  roleHint: string;
}

export interface BlockRelation {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export interface UserProfileUpdate {
  firstName: string;
  lastName: string;
  bio: string | null;
  neighborhood: string;
  avatarUrl?: string | null;
}
