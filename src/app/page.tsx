"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Sidebar } from "@/components/chat/Sidebar";
import type { BuroDoc, Message } from "@/types/chat";

export default function Home() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<BuroDoc[]>([]);
  const [sessionDocumentNames, setSessionDocumentNames] = useState<string[]>(
    []
  );
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const handleNewChat = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setUploadedDocs([]);
    setSessionDocumentNames([]);
    setSessionTitle(null);
    setMobileNavOpen(false);
  }, []);

  const handleLoadSession = useCallback(
    (id: string, msgs: Message[], documentNames?: string[], title?: string) => {
      setSessionId(id);
      setMessages(msgs);
      setUploadedDocs([]);
      setSessionDocumentNames(documentNames ?? []);
      setSessionTitle(title ?? null);
      setMobileNavOpen(false);
    },
    []
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,_#f4faf8_0%,_#faf8f4_35%,_#eef4f1_100%)] text-stone-800">
      <Sidebar
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
        refreshKey={sidebarRefreshKey}
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNav={() => setMobileNavOpen(false)}
      />

      {/* Contenuto principale */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,253,248,0.92),_transparent_58%)]" />
        <div className="relative flex h-full min-h-0 flex-col">
          <ChatWindow
            sessionId={sessionId}
            messages={messages}
            setMessages={setMessages}
            uploadedDocs={uploadedDocs}
            setUploadedDocs={setUploadedDocs}
            historicalDocumentNames={sessionDocumentNames}
            sessionTitle={sessionTitle}
            onTitleChange={setSessionTitle}
            onSessionActivity={() => setSidebarRefreshKey((k) => k + 1)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
        </div>
      </main>
    </div>
  );
}
