"use client";

import { useCallback, useState } from "react";
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

  const handleNewChat = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setUploadedDocs([]);
    setSessionDocumentNames([]);
    setSessionTitle(null);
  }, []);

  const handleLoadSession = useCallback(
    (id: string, msgs: Message[], documentNames?: string[], title?: string) => {
      setSessionId(id);
      setMessages(msgs);
      setUploadedDocs([]);
      setSessionDocumentNames(documentNames ?? []);
      setSessionTitle(title ?? null);
    },
    []
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#f9fafb,_#f3f4f6,_#e5e7eb)] text-slate-700">
      <Sidebar
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
        refreshKey={sidebarRefreshKey}
      />

      {/* Contenuto principale */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_55%)]" />
        <div className="relative flex h-full flex-col">
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
          />
        </div>
      </main>
    </div>
  );
}
