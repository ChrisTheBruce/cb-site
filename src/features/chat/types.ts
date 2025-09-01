export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

export interface ChatRequestPayload {
  model?: string; // server will default to gpt-4o-mini
  system?: string;
  messages: Array<Pick<ChatMessage, "role" | "content">>;
  temperature?: number;
  // reserved for future MCP/tooling
  tools?: unknown[];
}
