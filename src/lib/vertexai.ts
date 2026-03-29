import { VertexAI } from "@google-cloud/vertexai";

const location = process.env.GCP_REGION ?? "europe-west1";

let vertexClient: VertexAI | null = null;

function getVertexClient(): VertexAI {
  const project = process.env.GCP_PROJECT_ID;
  if (!project) {
    throw new Error("GCP_PROJECT_ID is not defined");
  }
  if (!vertexClient) {
    vertexClient = new VertexAI({ project, location });
  }
  return vertexClient;
}

/**
 * Modello generativo con grounding Ricerca Google.
 * Inizializzazione differita: così `next build` può completarsi senza variabili Vertex (es. solo chiave Gemini).
 */
export function getGroundedModel(systemInstruction?: string) {
  return getVertexClient().getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction,
    tools: [{ googleSearchRetrieval: {} }],
  });
}
