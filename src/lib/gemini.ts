import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

export const genAI = new GoogleGenerativeAI(apiKey);

export const getModel = (modelName = "gemini-flash-latest") =>
  genAI.getGenerativeModel({ model: modelName });

export const getChatModel = (systemPrompt?: string) =>
  genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: systemPrompt,
  });

/**
 * Effettua una chiamata chat con retry:
 * - primo tentativo: gemini-flash-latest
 * - se riceve 503: secondo tentativo con gemini-2.0-flash-lite
 */
export async function sendChatWithRetry(params: {
  // Tipiamo in modo generico per evitare problemi con i tipi di Content/Part
  history: any[];
  userParts: any[];
  systemPrompt?: string;
}): Promise<any> {
  const { history, userParts, systemPrompt } = params;

  // Primo tentativo: modello principale
  try {
    const primaryModel = getChatModel(systemPrompt);
    const chat = primaryModel.startChat({ history: history as any });
    const result = await chat.sendMessage(userParts as any);
    return result;
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "";
    const status = (err as any)?.status ?? (err as any)?.cause?.status;
    const is503 =
      status === 503 ||
      /503/.test(message) ||
      /unavailable/i.test(message ?? "");

    if (!is503) {
      throw err;
    }

    // Secondo tentativo: modello di fallback
    const fallbackModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: systemPrompt,
    });
    const fallbackChat = fallbackModel.startChat({ history: history as any });
    const fallbackResult = await fallbackChat.sendMessage(userParts as any);
    return fallbackResult;
  }
}
