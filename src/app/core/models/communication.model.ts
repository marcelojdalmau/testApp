/** Chat conversation */
export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  avatar?: string;
}

/** Chat message */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

/** Contract/service request */
export interface ServiceRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  type: 'consultation' | 'hiring' | 'sponsorship' | 'trial';
  title: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  amount?: string;
  createdAt: string;
}

/** Calendar event */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  type: 'training' | 'match' | 'medical' | 'meeting' | 'consultation';
  location?: string;
  participants?: string[];
}
