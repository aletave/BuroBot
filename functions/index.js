"use strict";
/**
 * BuroBot Webhook — Cloud Function per Dialogflow CX.
 * Input/Output nel formato webhook Dialogflow CX (obbligatorio).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.burobotWebhook = burobotWebhook;
const functions = __importStar(require("@google-cloud/functions-framework"));
const generative_ai_1 = require("@google/generative-ai");
function toFulfillmentMessage(message) {
    return {
        fulfillmentResponse: {
            messages: [{ text: { text: [message] } }],
        },
    };
}
function handleTrovaUfficio(parameters) {
    const citta = (parameters?.città ?? parameters?.citta ?? "non specificata");
    const tipoDocumento = (parameters?.tipoDocumento ?? "documento");
    // Mappa semplificata: in produzione si può collegare a un DB o API
    const uffici = {
        Cosenza: "Ufficio Protocollo Comune di Cosenza, Piazza dei Bruzi 1. Per documenti amministrativi: SUAP Cosenza.",
        Roma: "Ufficio Relazioni con il Pubblico (URP) o Sportello Unico Attività Produttive (SUAP) del Comune di Roma.",
        Milano: "Sportello Unico Imprese (SUI) o URP del Comune di Milano.",
    };
    const ufficio = uffici[citta] ?? `Per ${citta} contatta l'Ufficio Protocollo o lo Sportello Unico del Comune.`;
    return `Per "${tipoDocumento}" a ${citta}: ${ufficio} Consigliamo di verificare orari e requisiti sul sito del Comune.`;
}
function handleCalcolaScadenza(parameters) {
    const dataDoc = (parameters?.dataDocumento ?? "");
    const giorniStr = (parameters?.giorniLegge ?? "30");
    const giorni = parseInt(giorniStr, 10) || 30;
    let base;
    if (dataDoc) {
        base = new Date(dataDoc);
        if (Number.isNaN(base.getTime()))
            base = new Date();
    }
    else {
        base = new Date();
    }
    const scadenza = new Date(base);
    scadenza.setDate(scadenza.getDate() + giorni);
    const fmt = (d) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `Data documento: ${fmt(base)}. Con ${giorni} giorni di legge la scadenza cade il ${fmt(scadenza)}. Verifica sempre il testo di legge applicabile.`;
}
function handleFallback() {
    return "Non ho capito bene la tua richiesta. Prova a caricare un documento PDF oppure riformula la domanda.";
}
const GEMINI_SYSTEM_PROMPT = "Sei BuroBot, assistente per documenti burocratici italiani. Rispondi in modo utile e conciso a domande sulla burocrazia italiana. Se non sai rispondere con certezza, suggerisci di caricare il documento PDF per un'analisi precisa.";
let geminiClient = null;
function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined");
    }
    if (!geminiClient) {
        geminiClient = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return geminiClient.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: GEMINI_SYSTEM_PROMPT,
    });
}
async function handleGeminiFallback(body) {
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
    }
    catch (err) {
        // In caso di errore Gemini, non rompiamo il flusso CX: usiamo un messaggio safe.
        // eslint-disable-next-line no-console
        console.error("[burobotWebhook] Gemini fallback error:", err);
        return handleFallback();
    }
}
/**
 * HTTP handler — riceve il payload Dialogflow CX e restituisce fulfillmentResponse.
 */
async function burobotWebhook(req, res) {
    res.set("Content-Type", "application/json");
    if (req.method !== "POST") {
        res.status(405).json(toFulfillmentMessage("Metodo non consentito."));
        return;
    }
    // Log completo del body per debugging su GCP
    // ATTENZIONE: non loggare dati sensibili in produzione.
    // eslint-disable-next-line no-console
    console.log("[burobotWebhook] body:", JSON.stringify(req.body));
    const body = (req.body ?? {});
    const displayName = body.intentInfo?.displayName ?? "";
    const parameters = body.sessionInfo?.parameters ?? {};
    let message;
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
    const response = toFulfillmentMessage(message);
    // eslint-disable-next-line no-console
    console.log("[burobotWebhook] response:", JSON.stringify(response));
    res.status(200).json(response);
}
// Registrazione per gcloud (--entry-point burobotWebhook)
functions.http("burobotWebhook", burobotWebhook);
