import { NextResponse } from "next/server";
import { sendChatWithRetry } from "@/lib/gemini";
import { detectIntent } from "@/lib/dialogflow";
import { BUROBOT_SYSTEM_PROMPT } from "@/lib/prompts";
import { ChatRequestSchema } from "@/lib/validators";
import type { BuroDoc } from "@/types/chat";
import type { Content, Part } from "@google/generative-ai";

function buildUserMessageParts(message: string, documents: BuroDoc[]): Part[] {
  const parts: Part[] = [];
  for (const doc of documents) {
    parts.push({
      fileData: { mimeType: doc.mimeType, fileUri: doc.fileUri },
    });
  }
  parts.push({ text: message });
  return parts;
}

function toGeminiHistory(history: Array<{ role: string; parts: Array<{ text: string }> }>): Content[] {
  return history.map((msg) => ({
    role: msg.role,
    parts: msg.parts.map((p) => ({ text: p.text })),
  }));
}

async function replyWithGemini(
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  message: string
): Promise<string> {
  const geminiHistory = toGeminiHistory(history);
  const result = await sendChatWithRetry({
    history: geminiHistory,
    userParts: [{ text: message }],
    systemPrompt: BUROBOT_SYSTEM_PROMPT,
  });
  return result.response.text();
}

function isDialogflowConfigured(): boolean {
  return Boolean(
    process.env.DIALOGFLOW_AGENT_ID?.trim() && process.env.GCP_PROJECT_ID?.trim()
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { message, history, documents, sessionId } = parsed.data;
  console.log(
    "[orchestrator POST] history length:",
    history.length,
    "documents length:",
    documents.length
  );
  const hasDocs = documents.length > 0;

  if (hasDocs) {
    try {
      const geminiHistory = toGeminiHistory(history);
      const userContent: Part[] = buildUserMessageParts(message, documents);
      const result = await sendChatWithRetry({
        history: geminiHistory,
        userParts: userContent,
        systemPrompt: BUROBOT_SYSTEM_PROMPT,
      });
      let reply: string;
      try {
        reply = result.response.text();
      } catch (textError) {
        console.error("[orchestrator] Gemini response.text() failed (e.g. safety filter):", textError);
        return NextResponse.json(
          { error: "Model did not return text (safety or empty response)" },
          { status: 502 }
        );
      }
      // In questa versione non restituiamo fonti web (niente grounding Vertex qui).
      return NextResponse.json({ reply }, { status: 200 });
    } catch (e) {
      console.error("[orchestrator] Gemini API error:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Chat request failed" },
        { status: 502 }
      );
    }
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId required when no documents" },
      { status: 400 }
    );
  }

  // Se abbiamo history, usiamo Gemini con tutto il contesto (no Dialogflow).
  if (history.length > 0) {
    try {
      const reply = await replyWithGemini(history, message);
      return NextResponse.json({ reply }, { status: 200 });
    } catch (textError) {
      console.error("[orchestrator] Gemini (no-docs, with history) error:", textError);
      return NextResponse.json(
        { error: "Agent did not return a response" },
        { status: 502 }
      );
    }
  }

  // Primo messaggio senza allegati: Dialogflow se configurato, altrimenti solo Gemini (deploy con sola chiave API possibile).
  if (isDialogflowConfigured()) {
    try {
      let reply = await detectIntent(sessionId, message);
      if (!reply || !reply.trim()) {
        reply = await replyWithGemini(history, message);
      }
      return NextResponse.json({ reply }, { status: 200 });
    } catch (e) {
      console.error("[orchestrator] Errore Dialogflow CX, ripiego su Gemini:", e);
      try {
        const reply = await replyWithGemini(history, message);
        return NextResponse.json({ reply }, { status: 200 });
      } catch (textError) {
        console.error("[orchestrator] Gemini dopo errore CX:", textError);
        return NextResponse.json(
          { error: "Agent did not return a response" },
          { status: 502 }
        );
      }
    }
  }

  try {
    const reply = await replyWithGemini(history, message);
    return NextResponse.json({ reply }, { status: 200 });
  } catch (textError) {
    console.error("[orchestrator] Gemini (first message, no CX) error:", textError);
    return NextResponse.json(
      { error: "Agent did not return a response" },
      { status: 502 }
    );
  }
}
