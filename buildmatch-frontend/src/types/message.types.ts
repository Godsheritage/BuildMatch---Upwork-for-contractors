export interface ConversationUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: 'INVESTOR' | 'CONTRACTOR';
}

export interface LastMessage {
  content: string;
  createdAt: string;
  senderId: string;
}

export interface Conversation {
  id: string;
  jobId: string;
  jobTitle: string;
  otherUser: ConversationUser;
  lastMessage: LastMessage | null;
  unreadCount: number;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isFiltered: boolean;
  filterWarning?: string;
  readAt: string | null;
  createdAt: string;
  sender: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}
