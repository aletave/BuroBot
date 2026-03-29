/**
 * BuroBot Webhook — Cloud Function per Dialogflow CX.
 * Input/Output nel formato webhook Dialogflow CX (obbligatorio).
 */

import * as functions from "@google-cloud/functions-framework";
import type { Request, Response } from "@google-cloud/functions-framework";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface DialogflowCXWebhookRequest {
  intentInfo?: { displayName?: string };
  sessionInfo?: { parameters?: Record<string, unknown> };
  // Dialogflow CX include il testo dell'utente nel campo `text` del payload webhook.
  text?: string;
}

/** Formato webhook Dialogflow CX — obbligatorio per la risposta. */
export interface DialogflowCXFulfillmentResponse {
  fulfillmentResponse: {
    messages: Array<{ text: { text: string[] } }>;
  };
}

function toFulfillmentMessage(message: string): DialogflowCXFulfillmentResponse {
  return {
    fulfillmentResponse: {
      messages: [{ text: { text: [message] } }],
    },
  };
}

function handleTrovaUfficio(parameters: Record<string, unknown>): string {
  const citta = (parameters?.città ?? parameters?.citta ?? "non specificata") as string;
  const tipoDocumento = (parameters?.tipoDocumento ?? "documento") as string;
  // Mappa semplificata: in produzione si può collegare a un DB o API
  const uffici: Record<string, string> = {
    Cosenza: "Ufficio Protocollo Comune di Cosenza, Piazza dei Bruzi 1. Per documenti amministrativi: SUAP Cosenza.",
    Roma: "Ufficio Relazioni con il Pubblico (URP) o Sportello Unico Attività Produttive (SUAP) del Comune di Roma.",
    Milano: "Sportello Unico Imprese (SUI) o URP del Comune di Milano.",
  };
  const ufficio = uffici[citta] ?? `Per ${citta} contatta l'Ufficio Protocollo o lo Sportello Unico del Comune.`;
  return `Per "${tipoDocumento}" a ${citta}: ${ufficio} Consigliamo di verificare orari e requisiti sul sito del Comune.`;
}

function handleCalcolaScadenza(parameters: Record<string, unknown>): string {
  const dataDoc = (parameters?.dataDocumento ?? "") as string;
  const giorniStr = (parameters?.giorniLegge ?? "30") as string;
  const giorni = parseInt(giorniStr, 10) || 30;
  let base: Date;
  if (dataDoc) {
    base = new Date(dataDoc);
    if (Number.isNaN(base.getTime())) base = new Date();
  } else {
    base = new Date();
  }
  const scadenza = new Date(base);
  scadenza.setDate(scadenza.getDate() + giorni);
  const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `Data documento: ${fmt(base)}. Con ${giorni} giorni di legge la scadenza cade il ${fmt(scadenza)}. Verifica sempre il testo di legge applicabile.`;
}

function handleFallback(): string {
  return "Non ho capito bene la tua richiesta. Prova a caricare un documento PDF oppure riformula la domanda.";
}

const GEMINI_SYSTEM_PROMPT =
  "Sei BuroBot, assistente per documenti burocratici italiani. Rispondi in modo utile e conciso a domande sulla burocrazia italiana. Se non sai rispondere con certezza, suggerisci di caricare il documento PDF per un'analisi precisa.";

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: GEMINI_SYSTEM_PROMPT,
  });
}

async function handleGeminiFallback(body: DialogflowCXWebhookRequest): Promise<string> {
  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  if (!rawText) {
    // Nessun testo disponibile: ricadiamo sul fallback statico.
    return handleFallback();
  }

  try {
    const model = getGeminiModel();
    const result = await model.generateContent(rawText);
    const reply = result.response.text().trim();
    if (!reply) {
      return handleFallback();
    }
    // eslint-disable-next-line no-console
    console.log("[fallback] input:", rawText, "output:", reply);
    return reply;
  } catch (err) {
    // In caso di errore Gemini, non rompiamo il flusso CX: usiamo un messaggio safe.
    // eslint-disable-next-line no-console
    console.error("[burobotWebhook] Gemini fallback error:", err);
    return handleFallback();
  }
}

/**
 * HTTP handler — riceve il payload Dialogflow CX e restituisce fulfillmentResponse.
 */
export async function burobotWebhook(req: Request, res: Response): Promise<void> {
  res.set("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.status(405).json(toFulfillmentMessage("Metodo non consentito."));
    return;
  }

  // Log completo del body per debugging su GCP
  // ATTENZIONE: non loggare dati sensibili in produzione.
  // eslint-disable-next-line no-console
  console.log("[burobotWebhook] body:", JSON.stringify(req.body));

  const body = (req.body ?? {}) as DialogflowCXWebhookRequest;
  const displayName = body.intentInfo?.displayName ?? "";
  const parameters = body.sessionInfo?.parameters ?? {};

  let message: string;
  switch (displayName) {
    case "trova-ufficio":
      message = handleTrovaUfficio(parameters);
      break;
    case "calcola-scadenza":
      message = handleCalcolaScadenza(parameters);
      break;
    // Intent CX di default per no-match
    case "sys.no-match-default":
    default:
      message = await handleGeminiFallback(body);
      break;
  }

  const response: DialogflowCXFulfillmentResponse = toFulfillmentMessage(message);
  // eslint-disable-next-line no-console
  console.log("[burobotWebhook] response:", JSON.stringify(response));
  res.status(200).json(response);
}

// Registrazione per gcloud (--entry-point burobotWebhook)
functions.http("burobotWebhook", burobotWebhook);
