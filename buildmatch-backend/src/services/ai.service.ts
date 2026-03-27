import Anthropic from '@anthropic-ai/sdk';
import { TradeType } from '@prisma/client';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── AI foundation ──────────────────────────────────────────────────────────

const MODEL  = 'claude-haiku-4-5-20251001';
const TOKENS = 1024;

const VALID_TRADE_TYPES = new Set<string>(Object.values(TradeType));

export async function polishMessage(
  rawMessage: string,
  context: 'investor' | 'contractor',
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: TOKENS,
      system:
        'You are a professional business communication editor. ' +
        `The following message was written by a real estate ${context}. ` +
        'Rewrite it to sound professional, clear, and courteous while ' +
        'preserving all the original meaning and key details. ' +
        'Do not add information that was not in the original. ' +
        'Return only the rewritten message, no explanation.',
      messages: [{ role: 'user', content: rawMessage }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    return block.text;
  } catch (err) {
    console.error('[ai.service] polishMessage error:', err);
    throw new Error('AI service unavailable');
  }
}

export async function summarizeThread(
  messages: { sender: string; body: string; createdAt: string }[],
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        'You are an assistant summarizing a job communication thread ' +
        'for a real estate contractor marketplace. ' +
        'Summarize the key points: what work is being done, current status, ' +
        'any agreements made, and any open questions or issues. ' +
        'Be concise — max 150 words. Use bullet points.',
      messages: [{ role: 'user', content: JSON.stringify(messages) }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    return block.text;
  } catch (err) {
    console.error('[ai.service] summarizeThread error:', err);
    throw new Error('AI service unavailable');
  }
}

export async function classifyJob(
  title: string,
  description: string,
): Promise<TradeType> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: TOKENS,
      system:
        'Classify this construction job into exactly one of these categories: ' +
        'GENERAL, ELECTRICAL, PLUMBING, HVAC, ROOFING, FLOORING, PAINTING, ' +
        'LANDSCAPING, DEMOLITION, OTHER. ' +
        `Job title: ${title}\n` +
        `Job description: ${description}\n` +
        'Respond with only the category name, nothing else.',
      messages: [{ role: 'user', content: `${title}\n${description}` }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    const candidate = block.text.trim().toUpperCase();
    return VALID_TRADE_TYPES.has(candidate) ? (candidate as TradeType) : TradeType.GENERAL;
  } catch (err) {
    console.error('[ai.service] classifyJob error:', err);
    throw new Error('AI service unavailable');
  }
}

export async function autoResolveQuery(
  emailBody: string,
  knowledgeBase: string,
): Promise<{ canResolve: boolean; suggestedReply: string | null; confidence: number }> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: TOKENS,
      system:
        'You are a support agent for BuildMatch, a contractor marketplace. ' +
        `Knowledge base: ${knowledgeBase}\n` +
        `A user sent this message: ${emailBody}\n` +
        'Can this be answered using only the knowledge base? ' +
        'Respond in JSON: { canResolve: boolean, suggestedReply: string | null, confidence: number (0-1) } ' +
        'If canResolve is false, suggestedReply should be null. ' +
        'Only suggest a reply if confidence > 0.75.',
      messages: [{ role: 'user', content: emailBody }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    const raw = block.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(raw) as { canResolve: boolean; suggestedReply: string | null; confidence: number };
  } catch (err) {
    console.error('[ai.service] autoResolveQuery error:', err);
    throw new Error('AI service unavailable');
  }
}

const SYSTEM_PROMPT = `You are a helpful AI assistant for BuildMatch, a marketplace platform that connects real estate investors with skilled contractors.

About BuildMatch:
- Investors can post construction/renovation jobs, review contractor profiles, and accept bids
- Contractors can create profiles showcasing their skills, browse available jobs, and submit competitive bids
- The platform covers trades: General Contracting, Electrical, Plumbing, HVAC, Roofing, Flooring, Painting, Landscaping, Demolition, and more

Platform features:
- Job posting with budget ranges, location, and trade type
- Contractor profiles with specialties, ratings, experience, and portfolio
- Bid system where contractors submit amounts and cover messages; investors can accept one bid
- Profile strength scoring to help contractors get discovered
- Dark mode and English/Spanish language support

Common questions you can help with:
- How to post a job or submit a bid
- How to improve profile visibility and strength
- Understanding bid statuses (Pending, Accepted, Rejected, Withdrawn)
- Job statuses (Open, Awarded, In Progress, Completed, Cancelled)
- Account settings, payments, and disputes
- Platform policies and terms

Be concise, friendly, and professional. If you don't know something specific to a user's account (like exact payment amounts or personal data), say so and direct them to check their dashboard or contact support at support@buildmatch.com.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(messages: ChatMessage[], userContext?: { firstName: string; role: string }): Promise<string> {
  const systemWithContext = userContext
    ? `${SYSTEM_PROMPT}\n\nCurrent user: ${userContext.firstName} (${userContext.role.toLowerCase()})`
    : SYSTEM_PROMPT;

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     systemWithContext,
      messages:   messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  } catch (err) {
    console.error('[ai.service] chat error:', err);
    throw err;
  }
}
