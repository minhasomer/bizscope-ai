/** Client-side types for the BizScope Assistant chat feature. */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id:        string;
  role:      ChatRole;
  content:   string;
  timestamp: number;
}

export interface PageContext {
  route?:      string;
  reportType?: string;
}

export type ChatStatus = 'idle' | 'loading' | 'error';
