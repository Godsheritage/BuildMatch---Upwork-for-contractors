import api from './api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  success: boolean;
  data: { reply: string };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function sendMessage(message: string, history: ChatMessage[]): Promise<string> {
  const { data: res } = await api.post<ChatResponse>('/ai/chat', { message, history });
  return res.data.reply;
}

export async function polishReply(
  message: string,
  context: 'investor' | 'contractor',
): Promise<{ original: string; polished: string }> {
  const { data: res } = await api.post<ApiResponse<{ original: string; polished: string }>>(
    '/ai/polish-reply',
    { message, context },
  );
  return res.data;
}

export async function summarizeThread(
  jobId: string,
): Promise<{ summary: string; messageCount: number }> {
  const { data: res } = await api.post<ApiResponse<{ summary: string; messageCount: number }>>(
    `/ai/summarize/${jobId}`,
  );
  return res.data;
}

export async function classifyPreview(
  title: string,
  description: string,
): Promise<{ suggestedTradeType: string }> {
  const { data: res } = await api.post<ApiResponse<{ suggestedTradeType: string }>>(
    '/ai/classify-preview',
    { title, description },
  );
  return res.data;
}
