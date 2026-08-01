/** Client-side types for the BizScope Assistant chat feature. */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id:          string;
  role:        ChatRole;
  content:     string;
  timestamp:   number;
  redirected?: boolean;                       // true: scope-redirect response
  cta?:        { label: string; path: string }; // optional action button for redirect
}

export interface PageContext {
  route?:      string;
  reportType?: string;
}

export type ChatStatus = 'idle' | 'loading' | 'error';
