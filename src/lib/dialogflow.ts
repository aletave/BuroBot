import { SessionsClient } from "@google-cloud/dialogflow-cx";

const location = process.env.DIALOGFLOW_LOCATION ?? "europe-west1";
const apiEndpoint = `${location}-dialogflow.googleapis.com`;
const sessionsClient = new SessionsClient({ apiEndpoint });

/**
 * Detect intent: invia il testo all'agente CX e restituisce la risposta testuale.
 * Variabili da .env: GCP_PROJECT_ID, DIALOGFLOW_AGENT_ID, DIALOGFLOW_LOCATION.
 * Usa sempre l'environment "draft" di Dialogflow CX.
 */
export async function detectIntent(sessionId: string, text: string): Promise<string> {
  const projectId = process.env.GCP_PROJECT_ID;
  const agentId = process.env.DIALOGFLOW_AGENT_ID;
  if (!projectId) throw new Error("GCP_PROJECT_ID is not defined");
  if (!agentId) throw new Error("DIALOGFLOW_AGENT_ID is not defined");

  const sessionPath = sessionsClient.projectLocationAgentEnvironmentSessionPath(
    projectId,
    location,
    agentId,
    "draft",
    sessionId
  );
  const [response] = await sessionsClient.detectIntent({
    session: sessionPath,
    queryInput: {
      text: { text },
      languageCode: "it",
    },
  });
  // Log diagnostici per verificare sessionPath e risposta grezza di CX
  // ATTENZIONE: non lasciare in produzione se il payload contiene dati sensibili.
  // eslint-disable-next-line no-console
  console.log("[detectIntent] sessionPath:", sessionPath);
  // eslint-disable-next-line no-console
  console.log(
    "[detectIntent] responseMessages:",
    JSON.stringify(response.queryResult?.responseMessages)
  );
  const messages = response.queryResult?.responseMessages ?? [];
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.text?.text?.length) {
      parts.push(...msg.text.text);
    }
  }
  const reply = parts.join("\n").trim();
  // In Dialogflow CX, queryResult.text contiene in genere il testo utente:
  // evitare di rispedire indietro la domanda come risposta.
  return reply;
}
