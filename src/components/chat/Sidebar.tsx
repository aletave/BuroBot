"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { Message } from "@/types/chat";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/ToastProvider";

type ChatSessionRow = {
  session_id: string;
  title: string;
  updated_at: string;
  created_at: string;
};

type ChatMessageRow = {
  id: string;
  session_id: string;
  role: "user" | "model";
  text: string;
  created_at: string;
};

function relativeDayLabel(date: Date, now = new Date()): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000)
  );
  if (diffDays <= 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  return `${diffDays} giorni fa`;
}

export function Sidebar(props: {
  currentSessionId: string;
  onNewChat: () => void;
  onLoadSession: (
    sessionId: string,
    messages: Message[],
    documentNames?: string[],
    title?: string
  ) => void;
  refreshKey?: number;
}) {
  const { currentSessionId, onNewChat, onLoadSession, refreshKey } = props;
  const supabaseEnabled = Boolean(supabase);
  const { addToast } = useToast();

  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [mutatingSessionId, setMutatingSessionId] = useState<string | null>(
    null
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [sessionCache, setSessionCache] = useState<
    Record<string, { messages: Message[]; documentNames?: string[] }>
  >({});

  const canShowHistory = useMemo(() => supabaseEnabled, [supabaseEnabled]);

  const loadSessions = useCallback(async () => {
    if (!supabase) {
      console.error("[Sidebar.loadSessions] Supabase non inizializzato");
      setLoadError("Storico non disponibile: backend non configurato.");
      return;
    }
    setIsLoadingSessions(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("session_id,title,updated_at,created_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        throw new Error(
          `[Supabase] Errore caricando chat_sessions: ${error.message}`
        );
      }
      setSessions((data ?? []) as ChatSessionRow[]);
    } catch (err) {
      console.error("[Sidebar.loadSessions] Errore caricando le sessioni", err);
      const message =
        err instanceof Error ? err.message : "Errore sconosciuto nel caricamento.";
      setLoadError(message);
      setSessions([]);
      addToast(
        "Impossibile caricare lo storico delle chat. Controlla la configurazione.",
        "error"
      );
    } finally {
      setIsLoadingSessions(false);
    }
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!canShowHistory) return;
    void loadSessions();
  }, [canShowHistory, loadSessions, refreshKey]);

  const handleSelect = useCallback(
    async (sessionId: string) => {
      if (!supabase) {
        console.error("[Sidebar.handleSelect] Supabase non inizializzato");
        addToast(
          "Storico non disponibile: backend non configurato.",
          "error"
        );
        return;
      }
      if (mutatingSessionId) return;
      // Se abbiamo già in cache i messaggi di questa sessione, mostriamoli subito
      const cached = sessionCache[sessionId];
      const sessionMeta = sessions.find((s) => s.session_id === sessionId);
      if (cached) {
        onLoadSession(
          sessionId,
          cached.messages,
          cached.documentNames,
          sessionMeta?.title
        );
        return;
      }
      setLoadingSessionId(sessionId);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id,session_id,role,text,created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });
        if (error) {
          throw new Error(
            `[Supabase] Errore caricando chat_messages: ${error.message}`
          );
        }
        const rows = (data ?? []) as ChatMessageRow[];
        const msgs: Message[] = rows.map((r) => ({
          id: r.id,
          role: r.role,
          text: r.text,
          timestamp: new Date(r.created_at),
        }));
        let documentNames: string[] | undefined;
        const { data: sessionRow, error: sessionError } = await supabase
          .from("chat_sessions")
          .select("document_names")
          .eq("session_id", sessionId)
          .maybeSingle();
        if (sessionError) {
          throw new Error(
            `[Supabase] Errore caricando metadati sessione: ${sessionError.message}`
          );
        }
        if (sessionRow && Array.isArray((sessionRow as any).document_names)) {
          documentNames = (sessionRow as any).document_names as string[];
        }
        setSessionCache((prev) => ({
          ...prev,
          [sessionId]: { messages: msgs, documentNames },
        }));
        onLoadSession(sessionId, msgs, documentNames, sessionMeta?.title);
      } catch (err) {
        console.error("[Sidebar.handleSelect] Errore selezionando la sessione", err);
        const message =
          err instanceof Error ? err.message : "Errore sconosciuto nel caricamento.";
        setLoadError(message);
        addToast(
          "Impossibile caricare i messaggi della chat selezionata. Controlla le policy RLS.",
          "error"
        );
      } finally {
        setLoadingSessionId(null);
      }
    },
    [addToast, mutatingSessionId, onLoadSession, sessionCache, sessions, supabaseEnabled]
  );

  const handleRename = useCallback(
    async (sessionId: string) => {
      if (!supabase) return;
      const current = sessions.find((s) => s.session_id === sessionId);
      const initialTitle = current?.title ?? "";
      setEditingSessionId(sessionId);
      setEditingTitle(initialTitle);
    },
    [sessions]
  );

  const commitRename = useCallback(
    async () => {
      if (!supabase || !editingSessionId) {
        if (!supabase) {
          console.error("[Sidebar.commitRename] Supabase non inizializzato");
          addToast(
            "Impossibile rinominare la chat: backend non configurato.",
            "error"
          );
        }
        return;
      }
      const trimmed = editingTitle.trim();
      if (!trimmed) {
        setEditingSessionId(null);
        return;
      }
      const current = sessions.find((s) => s.session_id === editingSessionId);
      if (current && current.title === trimmed) {
        setEditingSessionId(null);
        return;
      }
      setMutatingSessionId(editingSessionId);
      setLoadError(null);
      const nowIso = new Date().toISOString();
      try {
        const { error } = await supabase
          .from("chat_sessions")
          .update({ title: trimmed, updated_at: nowIso })
          .eq("session_id", editingSessionId);
        if (error) {
          throw new Error(
            `[Supabase] Errore aggiornando titolo sessione: ${error.message}`
          );
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.session_id === editingSessionId
              ? { ...s, title: trimmed, updated_at: nowIso }
              : s
          )
        );
        addToast("Titolo della chat aggiornato.", "success");
      } catch (err) {
        console.error("[Sidebar.commitRename] Errore rinominando la sessione", err);
        const message =
          err instanceof Error ? err.message : "Errore sconosciuto durante il rename.";
        setLoadError(message);
        addToast("Errore durante l'aggiornamento del titolo.", "error");
      } finally {
        setMutatingSessionId(null);
        setEditingSessionId(null);
      }
    },
    [addToast, editingSessionId, editingTitle, sessions]
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      if (!supabase) {
        console.error("[Sidebar.handleDelete] Supabase non inizializzato");
        addToast(
          "Impossibile eliminare la chat: backend non configurato.",
          "error"
        );
        return;
      }
      setMutatingSessionId(sessionId);
      setLoadError(null);
      try {
        const { error: msgError } = await supabase
          .from("chat_messages")
          .delete()
          .eq("session_id", sessionId);
        if (msgError) {
          throw new Error(
            `[Supabase] Errore eliminando chat_messages: ${msgError.message}`
          );
        }
        const { error: sessError } = await supabase
          .from("chat_sessions")
          .delete()
          .eq("session_id", sessionId);
        if (sessError) {
          throw new Error(
            `[Supabase] Errore eliminando chat_sessions: ${sessError.message}`
          );
        }
        setSessions((prev) =>
          prev.filter((s) => s.session_id !== sessionId)
        );
        if (sessionId === currentSessionId) {
          onNewChat();
        }
        addToast("Chat eliminata.", "success");
      } catch (err) {
        console.error("[Sidebar.handleDelete] Errore eliminando la sessione", err);
        const message =
          err instanceof Error ? err.message : "Errore sconosciuto durante l'eliminazione.";
        setLoadError(message);
        addToast("Errore durante l'eliminazione della chat.", "error");
      } finally {
        setMutatingSessionId(null);
      }
    },
    [addToast, currentSessionId, onNewChat, sessions]
  );

  return (
    <aside className="glass-panel subtle-scroll flex w-72 flex-col border-r border-white/50 bg-white/35 px-4 py-4 text-slate-700 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-3xl bg-white/80 shadow-sm shadow-slate-200/70 ring-1 ring-white/60">
            <span className="text-lg font-semibold tracking-tight text-slate-700">
              B
            </span>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-700">
              BuroBot
            </h1>
            <p className="text-[11px] text-slate-500">Assistente burocratico</p>
          </div>
        </div>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto text-sm text-slate-600">
        <p className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
          Chat recenti
        </p>

        {!canShowHistory && (
          <p className="mt-2 px-1 text-sm text-slate-500">
            Storico disattivato (Supabase non configurato).
          </p>
        )}

        {canShowHistory && isLoadingSessions && (
          <p className="mt-3 px-1 text-xs text-slate-400">Caricamento…</p>
        )}

        {canShowHistory && !isLoadingSessions && sessions.length === 0 && (
          <p className="mt-3 px-1 text-xs text-slate-400">
            Nessuna chat recente.
          </p>
        )}

        {canShowHistory && sessions.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {sessions.map((s) => {
              const d = new Date(s.updated_at ?? s.created_at);
              const active = s.session_id === currentSessionId;
              const isLoadingThis = loadingSessionId === s.session_id;
              const isMutating = mutatingSessionId === s.session_id;
              const isEditing = editingSessionId === s.session_id;
              return (
                <div
                  key={s.session_id}
                  className={[
                    "group flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-transparent backdrop-blur-md transition-all",
                    active
                      ? "bg-white/80 ring-1 ring-slate-200"
                      : "bg-white/40 hover:-translate-y-0.5 hover:bg-white/80 hover:ring-1 hover:ring-slate-200/70",
                    isLoadingThis || isMutating ? "opacity-70" : "",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => !isEditing && void handleSelect(s.session_id)}
                    disabled={isLoadingThis || isMutating}
                    className="flex-1 text-left"
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitRename();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingSessionId(null);
                          }
                        }}
                        onBlur={() => {
                          // Salvataggio al blur della riga per un’interazione più fluida
                          void commitRename();
                        }}
                        autoFocus
                        className="w-full rounded-xl border border-white/70 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none ring-1 ring-transparent focus:border-slate-200 focus:ring-2 focus:ring-slate-200/90"
                      />
                    ) : (
                      <div className="line-clamp-1 text-[13px] font-medium text-slate-700">
                        {s.title}
                      </div>
                    )}
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {relativeDayLabel(d)}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 transition-all group-hover:translate-y-[-1px] group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRename(s.session_id);
                      }}
                      disabled={isLoadingThis || isMutating}
                      className="flex h-4 w-4 items-center justify-center text-slate-400 transition-all hover:-translate-y-0.5 hover:scale-105 hover:text-slate-600"
                      title="Rinomina chat"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteSessionId(s.session_id);
                      }}
                      disabled={isLoadingThis || isMutating}
                      className="flex h-4 w-4 items-center justify-center text-slate-400 transition-all hover:-translate-y-0.5 hover:scale-105 hover:text-rose-500"
                      title="Elimina chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loadError && (
          <p className="mt-3 px-1 text-xs text-red-500" role="alert">
            {loadError}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/40 pt-3">
        <button
          type="button"
          onClick={onNewChat}
          className="group inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-2xl bg-white/60 px-3 text-[11px] font-medium text-slate-600 shadow-sm shadow-slate-200/50 ring-1 ring-white/70 backdrop-blur-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:text-slate-700 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
        >
          <Plus size={12} className="text-slate-700" />
          <span>Nuova chat</span>
        </button>
      </div>

      {confirmDeleteSessionId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
          <div className="message-fade-in glass-elevated max-w-sm rounded-3xl border border-white/70 bg-white/80 px-5 py-4 text-sm text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Elimina chat
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Vuoi davvero eliminare definitivamente questa chat? L&apos;operazione non è reversibile.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteSessionId(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/70 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm shadow-slate-200/70 backdrop-blur-xl transition hover:bg-white/90"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = confirmDeleteSessionId;
                  setConfirmDeleteSessionId(null);
                  void handleDelete(id);
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-300/70 backdrop-blur-xl transition hover:bg-rose-600"
              >
                Elimina chat
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

