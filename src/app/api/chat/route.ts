import { NextResponse } from "next/server";
import { getChatModel } from "@/lib/gemini";
import { BUROBOT_SYSTEM_PROMPT } from "@/lib/prompts";
import { ChatRequestSchema } from "@/lib/validators";
import type { BuroDoc, ChatResponse } from "@/types/chat";
import type { Content, Part } from "@google/generative-ai";

function buildUserMessageParts(message: string, documents: BuroDoc[]): Part[] {
  const parts: Part[] = [];
  for (const doc of documents) {
    parts.push({
      fileData: {
        mimeType: doc.mimeType,
        fileUri: doc.fileUri,
      },
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

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { message, history, documents } = parsed.data;
  const geminiHistory = toGeminiHistory(history);
  const userContent: Part[] =
    documents.length > 0
      ? buildUserMessageParts(message, documents)
      : [{ text: message }];

  const model = getChatModel(BUROBOT_SYSTEM_PROMPT);
  const chat = model.startChat({ history: geminiHistory });

  try {
    const result = await chat.sendMessage(userContent);
    let reply: string;
    try {
      reply = result.response.text();
    } catch (textError) {
      console.error("[chat] response.text() failed (e.g. safety filter):", textError);
      return NextResponse.json(
        { error: "Model did not return text (safety or empty response)" },
        { status: 502 }
      );
    }
    const response: ChatResponse = { reply };
    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    console.error("[chat] Gemini API error:", e);
    const message = e instanceof Error ? e.message : "Chat request failed";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
