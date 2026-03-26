import api from './api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  success: boolean;
  data: { reply: string };
}

export async function sendMessage(message: string, history: ChatMessage[]): Promise<string> {
  const { data: res } = await api.post<ChatResponse>('/ai/chat', { message, history });
  return res.data.reply;
}
