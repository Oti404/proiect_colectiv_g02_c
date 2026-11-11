import { User } from './user.model';

export interface Conversation {
  id: string;
  createdAt: string;
  participantIds: string[];
  lastReadByUser: Record<string, string | null>;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  sentAt: string;
  isSimulatedReply?: boolean;
}

export interface ConversationSummary {
  conversation: Conversation;
  otherParticipants: User[];
  lastMessage: Message | null;
  unreadCount: number;
}
