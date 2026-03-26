export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
export declare function chat(messages: ChatMessage[], userContext?: {
    firstName: string;
    role: string;
}): Promise<string>;
//# sourceMappingURL=ai.service.d.ts.map