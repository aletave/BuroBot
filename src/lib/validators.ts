import { z } from "zod";
import type { ChatRequest, UploadResponse } from "@/types/chat";

// --- Sotto-schemi (forma allineata a types/chat.ts) ---

const MessageRoleSchema = z.enum(["user", "model"]);

const GeminiMessageSchema = z.object({
  role: MessageRoleSchema,
  parts: z.array(z.object({ text: z.string() })),
});

const BuroDocSchema = z.object({
  fileUri: z.string(),
  mimeType: z.literal("application/pdf"),
  filename: z.string(),
  displayName: z.string(),
});

// --- Schemi API (limiti: history max 50, messaggio max 4000, documenti 0–10) ---

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(GeminiMessageSchema).max(50),
  documents: z.array(BuroDocSchema).min(0).max(10),
  sessionId: z.string().uuid().optional(),
});

export const UploadResponseSchema = z.object({
  fileUri: z.string(),
  displayName: z.string(),
  filename: z.string(),
  mimeType: z.literal("application/pdf"),
});

// --- Tipi inferiti (una sola fonte di verità: i tipi di dominio restano in types/chat.ts) ---

export type ValidatedChatRequest = z.infer<typeof ChatRequestSchema>;
export type ValidatedUploadResponse = z.infer<typeof UploadResponseSchema>;

// Allineamento a tempo di compilazione: output degli schemi assegnabili ai tipi di dominio
type _ChatRequestAlignment = ValidatedChatRequest extends ChatRequest
  ? ChatRequest extends ValidatedChatRequest
    ? true
    : false
  : false;
type _UploadResponseAlignment = ValidatedUploadResponse extends UploadResponse
  ? UploadResponse extends ValidatedUploadResponse
    ? true
    : false
  : false;
// Controllo a tempo di compilazione: output schemi = tipi in chat.ts
const _assertAlignment: _ChatRequestAlignment & _UploadResponseAlignment = true;
void _assertAlignment;
