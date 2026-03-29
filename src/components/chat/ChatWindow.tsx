"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { PanelLeft } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Message,
  BuroDoc,
  GeminiMessage,
  ChatResponse,
  GroundedChatResponse,
} from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/ToastProvider";

function nextId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function ChatWindow(props: {
  sessionId: string;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  uploadedDocs: BuroDoc[];
  setUploadedDocs: Dispatch<SetStateAction<BuroDoc[]>>;
  historicalDocumentNames?: string[];
  onSessionActivity?: () => void;
  sessionTitle?: string | null;
  onTitleChange?: (title: string) => void;
  onOpenMobileNav?: () => void;
}) {
  const {
    sessionId,
    messages,
    setMessages,
    uploadedDocs,
    setUploadedDocs,
    historicalDocumentNames,
    onSessionActivity,
    sessionTitle,
    onTitleChange,
    onOpenMobileNav,
  } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { addToast } = useToast();
  const messagesRef = useRef<Message[]>([]);
  const uploadedDocsRef = useRef<BuroDoc[]>([]);
  const sessionTitleRef = useRef<string | null>(null);
  const firstUserMessageRef = useRef<string | null>(null);
  const hasGeneratedSmartTitleRef = useRef(false);
  const isInitialRenderRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const historyAsGemini = useCallback((msgs: Message[]): GeminiMessage[] => {
    return msgs.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    uploadedDocsRef.current = uploadedDocs;
  }, [uploadedDocs]);

  useEffect(() => {
    // Quando cambio sessione:
    // - se esiste già un titolo (manuale o generato in passato), lo sincronizzo nel ref
    //   e considero il titolo "stabile" (non va rigenerato).
    // - resetto solo il primo messaggio utente per la nuova sessione.
    sessionTitleRef.current = sessionTitle ?? null;
    firstUserMessageRef.current = null;
    hasGeneratedSmartTitleRef.current = Boolean(sessionTitle);
    // Nota: vogliamo reagire solo al cambio di sessione; eventuali
    // cambi di titolo per la stessa sessione sono gestiti altrove.
  }, [sessionId]);

  const saveMessageToSupabase = useCallback(
    async (
      msg: { role: "user" | "model"; text: string; timestamp: Date },
      options?: { documentNames?: string[] }
    ) => {
      if (!supabase) {
        console.error("[saveMessageToSupabase] Supabase non inizializzato");
        addToast(
          "Errore interno: servizio di persistenza non disponibile.",
          "error"
        );
        return;
      }
      const fallbackTitle =
        msg.role === "user"
          ? msg.text.trim().slice(0, 40) || "Chat"
          : "Chat";
      const title = sessionTitleRef.current ?? fallbackTitle;
      sessionTitleRef.current = title;
      if (msg.role === "user" && onTitleChange && !sessionTitle) {
        onTitleChange(title);
      }

      const nowIso = new Date().toISOString();
      try {
        const { error: upsertError } = await supabase
          .from("chat_sessions")
          .upsert(
            {
              session_id: sessionId,
              title,
              updated_at: nowIso,
              ...(options?.documentNames
                ? { document_names: options.documentNames }
                : {}),
            },
            { onConflict: "session_id" }
          );
        if (upsertError) {
          throw new Error(
            `[Supabase] Errore upsert chat_sessions: ${upsertError.message}`
          );
        }

        const { error: insertError } = await supabase
          .from("chat_messages")
          .insert({
            session_id: sessionId,
            role: msg.role,
            text: msg.text,
            created_at: msg.timestamp.toISOString(),
          });
        if (insertError) {
          throw new Error(
            `[Supabase] Errore insert chat_messages: ${insertError.message}`
          );
        }
        onSessionActivity?.();
      } catch (err) {
        console.error("[saveMessageToSupabase] Errore durante il salvataggio", err);
        const message =
          err instanceof Error ? err.message : "Errore sconosciuto nel salvataggio.";
        addToast(
          `Impossibile salvare il messaggio: ${message}`,
          "error"
        );
        throw err;
      }
    },
    [addToast, onSessionActivity, onTitleChange, sessionId, sessionTitle]
  );

  const generateSmartTitleIfNeeded = useCallback(async () => {
    if (
      !supabase ||
      hasGeneratedSmartTitleRef.current ||
      !firstUserMessageRef.current
    ) {
      return;
    }
    try {
      const res = await fetch("/api/chat-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstMessage: firstUserMessageRef.current }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { title?: string };
      const newTitle = data.title?.trim();
      if (!newTitle) return;
      hasGeneratedSmartTitleRef.current = true;
      sessionTitleRef.current = newTitle;
      onTitleChange?.(newTitle);
      const nowIso = new Date().toISOString();
      if (supabase) {
        const { error } = await supabase
          .from("chat_sessions")
          .update({ title: newTitle, updated_at: nowIso })
          .eq("session_id", sessionId);
        if (error) {
          console.error(
            "[generateSmartTitleIfNeeded] Errore aggiornando il titolo",
            error
          );
        } else {
          onSessionActivity?.();
        }
      }
    } catch (err) {
      console.error("[generateSmartTitleIfNeeded] Errore nella generazione titolo", err);
      // Tentativo non bloccante: niente toast, è solo un miglioramento estetico
    }
  }, [onSessionActivity, sessionId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId) {
        console.error(
          "[handleSend] sessionId mancante o non valido, blocco invio messaggio"
        );
        addToast(
          "Errore interno: sessione chat non valida. Riprova a riaprire la chat.",
          "error"
        );
        return;
      }
      const docsSnapshot = uploadedDocsRef.current;
      if (!firstUserMessageRef.current) {
        firstUserMessageRef.current = text;
      }
      const userMessage: Message = {
        id: nextId(),
        role: "user",
        text,
        timestamp: new Date(),
        ...(docsSnapshot.length ? { docs: docsSnapshot } : {}),
      };
      setMessages((prev) => [...prev, userMessage]);
      void saveMessageToSupabase(
        {
          role: "user",
          text: userMessage.text,
          timestamp: userMessage.timestamp,
        },
        docsSnapshot.length
          ? { documentNames: docsSnapshot.map((d) => d.filename) }
          : undefined
      ).catch((err) => {
        console.error(
          "[handleSend] Errore durante il salvataggio del messaggio utente",
          err
        );
      });
      setIsLoading(true);
      try {
        console.log(
          "[handleSend] history length:",
          historyAsGemini(messagesRef.current).length
        );
        const body = {
          message: text,
          history: historyAsGemini(messagesRef.current),
          documents: docsSnapshot,
          sessionId,
        };
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          reply?: string;
          error?: string;
          sources?: Array<{ title: string; url: string }>;
        };
        if (!res.ok) {
          const modelMessage: Message = {
            id: nextId(),
            role: "model",
            text: data.error ?? "Errore di risposta",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, modelMessage]);
          void saveMessageToSupabase({
            role: "model",
            text: modelMessage.text,
            timestamp: modelMessage.timestamp,
          }).catch((err) => {
            console.error(
              "[handleSend] Errore salvando il messaggio di errore modello",
              err
            );
          });
          addToast(
            data.error ?? "Errore durante la risposta del modello.",
            "error"
          );
          return;
        }
        const parsed = data as GroundedChatResponse | ChatResponse;
        const sources = "sources" in parsed && parsed.sources?.length ? parsed.sources : undefined;
        const modelMessage: Message = {
          id: nextId(),
          role: "model",
          text: parsed.reply,
          timestamp: new Date(),
          ...(sources ? { sources } : {}),
        };
        setMessages((prev) => [...prev, modelMessage]);
        void saveMessageToSupabase({
          role: "model",
          text: modelMessage.text,
          timestamp: modelMessage.timestamp,
        }).catch((err) => {
          console.error(
            "[handleSend] Errore salvando il messaggio del modello",
            err
          );
        });
        void generateSmartTitleIfNeeded();
      } catch (err) {
        console.error("[handleSend] Errore durante la chiamata a /api/orchestrator", err);
        addToast(
          "Errore di connessione o di orchestrazione. Riprova.",
          "error"
        );
        const modelMessage: Message = {
          id: nextId(),
          role: "model",
          text: "Errore di connessione. Riprova.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, modelMessage]);
        void saveMessageToSupabase({
          role: "model",
          text: modelMessage.text,
          timestamp: modelMessage.timestamp,
        }).catch((saveErr) => {
          console.error(
            "[handleSend] Errore salvando il messaggio di errore di connessione",
            saveErr
          );
        });
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, historyAsGemini, saveMessageToSupabase, sessionId, setMessages, setUploadedDocs]
  );

  const handleUploadSuccess = useCallback(
    (doc: BuroDoc) => {
      setUploadedDocs((prev) => [...prev, doc]);
      setUploadError(null);
    },
    [setUploadedDocs]
  );

  const handleUploadError = useCallback((message: string) => {
    setUploadError(message);
  }, []);

  const handleRemoveDoc = useCallback(
    (index: number) => {
      setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
    },
    [setUploadedDocs]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset dello scorrimento automatico quando cambio sessione
  useEffect(() => {
    isInitialRenderRef.current = true;
    prevMessageCountRef.current = 0;
  }, [sessionId]);

  // Scorrimento verso il messaggio più recente:
  // - prima visualizzazione o cambio sessione: salto istantaneo in fondo
  // - molti messaggi in blocco: salto istantaneo
  // - mentre arriva la risposta (isLoading): sempre salto istantaneo
  // - un solo messaggio nuovo a risposta finita: scorrimento fluido
  useEffect(() => {
    const endEl = messagesEndRef.current;
    if (!endEl) return;

    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    const hasNewMessages = currentCount > prevCount;
    const added = currentCount - prevCount;

    // Prima visualizzazione della sessione (o dopo reset)
    if (isInitialRenderRef.current) {
      endEl.scrollIntoView({ behavior: "auto", block: "end" });
      isInitialRenderRef.current = false;
      prevMessageCountRef.current = currentCount;
      return;
    }

    // Nessun nuovo messaggio → non fare nulla
    if (!hasNewMessages) {
      prevMessageCountRef.current = currentCount;
      return;
    }

    // Durante l’arrivo della risposta: resta agganciato in fondo con scroll istantaneo (evita “saltelli”).
    if (isLoading) {
      endEl.scrollIntoView({ behavior: "auto", block: "end" });
      prevMessageCountRef.current = currentCount;
      return;
    }

    // Caricamento massivo / cambio chat silenzioso:
    // se venivamo da zero o sono arrivati più di 1 messaggio in blocco,
    // usiamo scroll istantaneo.
    if (prevCount === 0 || added > 1) {
      endEl.scrollIntoView({ behavior: "auto", block: "end" });
      prevMessageCountRef.current = currentCount;
      return;
    }

    // Un solo messaggio nuovo con risposta già completa: scorrimento fluido verso il fondo.
    if (added === 1) {
      endEl.scrollIntoView({ behavior: "smooth", block: "end" });
      prevMessageCountRef.current = currentCount;
      return;
    }

    // Caso residuo: allinea subito in fondo
    endEl.scrollIntoView({ behavior: "auto", block: "end" });
    prevMessageCountRef.current = currentCount;
  }, [messages, sessionId, isLoading]);

  const chatTitle = useMemo(() => {
    if (sessionTitle && sessionTitle.trim()) return sessionTitle.trim();
    const firstUserMessage = messages.find((m) => m.role === "user");
    const base = firstUserMessage?.text?.trim();
    if (!base) return "Nuova chat";
    return base.length > 40 ? `${base.slice(0, 40)}…` : base;
  }, [messages, sessionTitle]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barra superiore fissa sopra l’area scrollabile */}
      <div className="glass-panel border-b border-teal-950/[0.06] bg-white/55 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {onOpenMobileNav && (
              <button
                type="button"
                onClick={onOpenMobileNav}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-teal-900/80 ring-1 ring-teal-900/10 transition hover:bg-teal-50/90 hover:text-teal-950 md:hidden"
                aria-label="Apri menu e cronologia chat"
              >
                <PanelLeft size={20} strokeWidth={2} />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-stone-800">
                {chatTitle}
              </h2>
              <p className="text-[11px] text-stone-500">
                Sessione attiva di BuroBot
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-36 sm:px-4 sm:py-4">
        <div className="mx-auto flex h-full max-w-3xl flex-col gap-5">
          {uploadError && (
            <p className="mb-3 text-base text-red-500" role="alert">
              {uploadError}
            </p>
          )}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="glass-elevated w-full max-w-xl rounded-3xl bg-white/65 px-5 py-7 text-stone-700 shadow-[0_8px_32px_rgba(15,77,72,0.08)] ring-1 ring-teal-950/[0.07] backdrop-blur-2xl sm:px-10 sm:py-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800/50">
                  Benvenuto in BuroBot
                </p>
                <h2 className="mt-3 text-lg font-semibold leading-snug text-stone-900 sm:text-xl">
                  Carica un PDF o chiedi
                  <span className="ml-1 bg-gradient-to-r from-teal-800 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                    in che ufficio andare.
                  </span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-stone-600">
                  BuroBot legge la burocrazia per te e ti restituisce prossimi
                  passi chiari, umani, senza legalese.
                </p>
                <div className="mt-7 grid gap-2.5 text-sm sm:grid-cols-3">
                  {[
                    "Analizza questa lettera dell'INPS",
                    "Che scadenze ho su questo avviso?",
                    "Dove devo andare per questo documento?",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleSend(example)}
                      className="group rounded-2xl border border-teal-950/[0.06] bg-white/50 px-4 py-3 text-left text-[13px] text-stone-700 shadow-sm shadow-teal-950/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-teal-50/60 hover:text-teal-950 hover:shadow-[0_10px_36px_rgba(15,77,72,0.12)]"
                    >
                      <span className="inline-flex items-center gap-2 text-[13px]">
                        <span>{example}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, index) => {
            const currentDate = msg.timestamp
              ? new Date(msg.timestamp)
              : undefined;
            const prev = index > 0 ? messages[index - 1] : undefined;
            const prevDate = prev?.timestamp
              ? new Date(prev.timestamp)
              : undefined;

            let showDateBadge = false;
            if (currentDate) {
              if (!prevDate) {
                showDateBadge = true;
              } else {
                const curDay = currentDate.toDateString();
                const prevDay = prevDate.toDateString();
                if (curDay !== prevDay) {
                  showDateBadge = true;
                }
              }
            }

            const label = (() => {
              if (!currentDate) return "";
              const today = new Date();
              const diffMs =
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate()
                ).getTime() -
                new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  currentDate.getDate()
                ).getTime();
              const diffDays = Math.round(
                diffMs / (24 * 60 * 60 * 1000)
              );
              if (diffDays === 0) return "Oggi";
              if (diffDays === 1) return "Ieri";
              return currentDate.toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
            })();

            const isCurrentlyStreaming =
              isLoading &&
              index === messages.length - 1 &&
              msg.role !== "user";

            return (
              <div key={msg.id}>
                {showDateBadge && label && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-stone-200/50 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm shadow-teal-950/5 ring-1 ring-stone-300/40">
                      {label}
                    </span>
                  </div>
                )}
                <MessageBubble message={msg} isStreaming={isCurrentlyStreaming} />
              </div>
            );
          })}
          {isLoading && (
            <div className="mr-auto flex max-w-[72%] items-center gap-2 rounded-3xl bg-white/75 px-4 py-2.5 text-sm text-stone-500 shadow-[0_8px_30px_rgba(15,77,72,0.06)] ring-1 ring-teal-950/[0.06] backdrop-blur-xl">
              <span className="typing-dot animate-typing-dot delay-0" />
              <span className="typing-dot animate-typing-dot delay-150" />
              <span className="typing-dot animate-typing-dot delay-300" />
            </div>
          )}
          <div className="h-1 shrink-0" />
          <div id="chat-end" ref={messagesEndRef} aria-hidden />
        </div>
      </div>
      <footer className="sticky bottom-0 border-t border-teal-950/[0.06] bg-[#fffcf8]/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(15,77,72,0.04)] backdrop-blur-md sm:px-3">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <ChatInput
            onSend={handleSend}
            onUploadSuccess={handleUploadSuccess}
            docs={uploadedDocs}
            onRemoveDoc={handleRemoveDoc}
            onUploadError={handleUploadError}
            disabled={isLoading}
          />
        </div>
      </footer>
    </div>
  );
}
