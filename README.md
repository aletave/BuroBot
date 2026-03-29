# BuroBot

**BuroBot** è un assistente conversazionale che aiuta a **capire documenti e pratiche burocratiche**: buste paga, lettere dell’Agenzia delle Entrate, avvisi della PA, scadenze, moduli e messaggi poco chiari. Non sostituisce commercialisti, CAF o avvocati, ma **traduce il “linguaggio ufficiale” in spiegazioni ordinate**: cosa c’è scritto, cosa chiedono, eventuali rischi, cosa fare dopo e quando rivolgersi a un professionista.

L’interfaccia è una **chat**: puoi scrivere domande a parole tue e, se serve, **allegare PDF** perché il modello li legga insieme al contesto.

---

## Contesto: AI Week — Develhope

Questo repository è il **progetto sviluppato per l’AI Week Challenge** — percorso *Opening Future* promosso da **Develhope** insieme a **Google Cloud**, **Intesa Sanpaolo** e **TIM Enterprise** (edizione **23–27 marzo 2026**).

La challenge invita a costruire una soluzione concreta che integri **modelli generativi** (Gemini), **servizi su Google Cloud** (Vertex AI, Dialogflow CX dove serve) e un’esperienza utente chiara, in vista del Demo Day conclusivo. BuroBot nasce come risposta a quel brief: un assistente accessibile su web per chi fatica con la burocrazia e i documenti ufficiali.

---

## A chi è rivolto

Il tono e le istruzioni del bot sono pensati per chi trova ostica la burocrazia digitale o il gergo amministrativo:

- **Persone anziane** che preferiscono una risposta calma, passo passo, senza pressa.
- **Adulti con poca dimestichezza** con computer, portali e PDF: meno assunzioni tecniche, più chiarezza.
- **Stranieri che vivono in Italia** (permessi, contratti, lettere in italiano complesso): risposte in **italiano semplice**, pazienti, con termini spiegati quando servono.

> **Nota:** BuroBot può sbagliare o non avere normativa aggiornatissima. Per decisioni importanti, conferma sempre con un professionista o con gli uffici competenti.

---

## Stack tecnologico

Stack applicato nel progetto per l’AI Week:

- **Next.js** (App Router), TypeScript, Tailwind CSS v4  
- **Gemini API** (`@google/generative-ai`) per chat e analisi documenti  
- Opzionale: **Dialogflow CX** (primo turno strutturato), **Vertex AI** (route con grounding), **Supabase** (storico sessioni se configurato)

Le chiavi API restano **solo lato server** (API Routes); non finiscono nel bundle del browser.

---

## Avvio in locale

```bash
npm install
cp .env.example .env
# Compila .env con almeno GEMINI_API_KEY
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

---


## Variabili d’ambiente (riepilogo)

| Variabile | Ruolo |
|-----------|--------|
| `GEMINI_API_KEY` | Chat, upload PDF, fallback se Dialogflow non è disponibile |
| `NEXT_PUBLIC_SUPABASE_*` | Client Supabase (storico chat, se abilitato) |
| `GCP_PROJECT_ID`, `DIALOGFLOW_AGENT_ID`, `DIALOGFLOW_LOCATION` | Dialogflow CX sul primo messaggio (opzionale) |
| `GCP_PROJECT_ID`, `GCP_REGION` | Vertex per `/api/chat-grounded` (opzionale) |


---

## API utili (sviluppo)

- **`POST /api/orchestrator`** — Endpoint principale della chat (documenti + history + opzionale Dialogflow).  
- **`POST /api/upload`** — Upload PDF verso i file di Gemini.  
- **`POST /api/chat-title`** — Titolo sintetico della conversazione.  
- **`POST /api/chat-grounded`** — Variante con grounding Vertex (richiede GCP).  

Dettagli body/response: vedi gli schemi Zod in `src/lib/validators.ts` e le route sotto `src/app/api/`.

---

## Architettura (schema cartelle)

```
src/
├── app/
│   ├── api/orchestrator/route.ts   # Chat principale
│   ├── api/upload/route.ts
│   └── page.tsx
├── components/chat/                 # UI chat + sidebar
├── lib/                             # gemini, vertexai, dialogflow, prompts, validators
└── types/chat.ts
```

---

## Note di sviluppo

Architettura a layer chiari (API → logica di dominio). Il modello linguistico non sostituisce consulenza legale o fiscale; va usato con attenzione su dati personali.

Perché la **history** è sul client: l’API Gemini è stateless; ogni richiesta può includere la conversazione precedente. Per sessioni persistenti si può usare Supabase (se configurato nel progetto).

---

## Licenza e uso

Verifica i termini d’uso delle **API Gemini** e di eventuali servizi Google Cloud collegati. Non pubblicare chiavi o dati sensibili nel repository.
