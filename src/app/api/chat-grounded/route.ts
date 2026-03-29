import { NextResponse } from "next/server";
import { getGroundedModel } from "@/lib/vertexai";
import { BUROBOT_SYSTEM_PROMPT } from "@/lib/prompts";
import { ChatRequestSchema } from "@/lib/validators";
import type { BuroDoc, GroundedChatResponse, GroundingSource } from "@/types/chat";
import type { Content, Part } from "@google-cloud/vertexai";

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

function toVertexHistory(history: Array<{ role: string; parts: Array<{ text: string }> }>): Content[] {
  return history.map((msg) => ({
    role: msg.role,
    parts: msg.parts.map((p) => ({ text: p.text })),
  }));
}

function extractSources(groundingMetadata: { groundingChunks?: Array<{ web?: { uri?: string; title?: string }; retrievedContext?: { uri?: string; title?: string } }> } | undefined): GroundingSource[] {
  if (!groundingMetadata?.groundingChunks?.length) return [];
  return groundingMetadata.groundingChunks
    .map((chunk) => {
      const web = chunk.web ?? chunk.retrievedContext;
      const url = web?.uri ?? "";
      const title = web?.title ?? "";
      return url ? { title, url } : null;
    })
    .filter((s): s is GroundingSource => s !== null);
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
  const vertexHistory = toVertexHistory(history);
  const userContent: Part[] =
    documents.length > 0
      ? buildUserMessageParts(message, documents)
      : [{ text: message }];

  const model = getGroundedModel(BUROBOT_SYSTEM_PROMPT);
  const chat = model.startChat({ history: vertexHistory });

  try {
    const result = await chat.sendMessage(userContent);
    const response = result.response;
    const candidate = response.candidates?.[0];
    let reply: string;
    try {
      const textPart = candidate?.content?.parts?.find((p): p is { text: string } => "text" in p && typeof p.text === "string");
      reply = textPart?.text ?? "";
    } catch {
      reply = "";
    }
    if (!reply) {
      console.error("[chat-grounded] No text in response");
      return NextResponse.json(
        { error: "Model did not return text (safety or empty response)" },
        { status: 502 }
      );
    }
    const sources = extractSources(candidate?.groundingMetadata);
    const bodyResponse: GroundedChatResponse = { reply, sources };
    return NextResponse.json(bodyResponse, { status: 200 });
  } catch (e) {
    console.error("[chat-grounded] Vertex AI error:", e);
    const message = e instanceof Error ? e.message : "Chat request failed";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
