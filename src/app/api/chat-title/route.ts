import { NextResponse } from "next/server";
import { getModel } from "@/lib/gemini";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const firstMessage =
    typeof (body as any)?.firstMessage === "string"
      ? (body as any).firstMessage
      : null;

  if (!firstMessage || !firstMessage.trim()) {
    return NextResponse.json(
      { error: "firstMessage is required" },
      { status: 400 }
    );
  }

  const prompt = `In massimo 5 parole, genera un titolo descrittivo per questa conversazione basandoti su questo messaggio utente: "${firstMessage}". Rispondi solo con il titolo, nessun altro testo.`;

  try {
    const model = getModel("gemini-flash-latest");
    const result = await model.generateContent(prompt);
    const titleRaw = result.response.text().trim();
    const title = titleRaw.replace(/\s+/g, " ").slice(0, 80) || "Chat";
    return NextResponse.json({ title }, { status: 200 });
  } catch (e) {
    console.error("[chat-title] Gemini title generation error:", e);
    return NextResponse.json(
      { error: "Failed to generate chat title" },
      { status: 502 }
    );
  }
}

