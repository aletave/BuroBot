export type MessageRole = "user" | "model";

export interface GroundingSource {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  sources?: GroundingSource[];
  docs?: BuroDoc[];
}

export interface BuroDoc {
  fileUri: string;       // "https://generativelanguage.googleapis.com/v1beta/files/xyz"
  mimeType: "application/pdf";
  filename: string;      // nome originale del file, solo per la UI
  displayName: string;   // etichetta leggibile, es. "Busta paga marzo"
}

export interface GeminiMessage {
  role: MessageRole;
  parts: Array<{ text: string }>;
}

export interface ChatRequest {
  message: string;
  history: GeminiMessage[];
  documents: BuroDoc[];
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
}

export interface GroundedChatResponse {
  reply: string;
  sources?: GroundingSource[];
}

export interface UploadResponse {
  fileUri: string;
  displayName: string;
  filename: string;
  mimeType: "application/pdf";
}
