import api from './api';
import type { Conversation, Message } from '../types/message.types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await api.get<{ data: Conversation[] }>('/messages/conversations');
  return unwrap(res.data);
}

export async function getOrCreateConversation(
  jobId: string,
  recipientId: string,
): Promise<Conversation> {
  const res = await api.post<{ data: Conversation }>('/messages/conversations', {
    jobId,
    recipientId,
  });
  return unwrap(res.data);
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  const res = await api.get<{ data: Conversation }>(`/messages/conversations/${conversationId}`);
  return unwrap(res.data);
}

export async function getMessages(
  conversationId: string,
  before?: string,
): Promise<Message[]> {
  const params: Record<string, string> = {};
  if (before) params.before = before;
  const res = await api.get<{ data: { messages: Message[] } }>(
    `/messages/conversations/${conversationId}/messages`,
    { params },
  );
  return res.data.data.messages;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  replyToId?: string,
): Promise<Message> {
  const res = await api.post<{ data: Message }>(
    `/messages/conversations/${conversationId}/messages`,
    { content, ...(replyToId ? { replyToId } : {}) },
  );
  return unwrap(res.data);
}

export async function editMessage(messageId: string, content: string): Promise<Message> {
  const res = await api.put<{ data: Message }>(`/messages/messages/${messageId}`, { content });
  return unwrap(res.data);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await api.delete(`/messages/messages/${messageId}`);
}

export async function reportMessage(
  messageId:  string,
  reason:     string,
  description?: string,
): Promise<void> {
  await api.post(`/messages/messages/${messageId}/report`, { reason, description });
}

export async function getTotalUnreadCount(): Promise<{ total: number }> {
  const res = await api.get<{ data: { total: number } }>('/messages/conversations/unread-count');
  return unwrap(res.data);
}
