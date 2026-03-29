import ReactMarkdown from "react-markdown";
import { useEffect, useState } from "react";
import type { Message } from "@/types/chat";

function DocChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg bg-slate-100/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-white/80 transition hover:bg-slate-200/80"
    >
      {label}
    </a>
  );
}

export interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [displayedText, setDisplayedText] = useState(
    isUser || !isStreaming ? message.text : ""
  );

  // Effetto “una lettera alla volta” solo per il messaggio in arrivo (streaming).
  useEffect(() => {
    if (isUser || !isStreaming) {
      setDisplayedText(message.text);
      return;
    }

    const full = message.text ?? "";
    if (!full) {
      setDisplayedText("");
      return;
    }

    let index = 0;
    let timeoutId: number | undefined;

    const step = () => {
      index += 3;
      setDisplayedText(full.slice(0, index));
      if (index < full.length) {
        timeoutId = window.setTimeout(step, 12);
      }
    };

    timeoutId = window.setTimeout(step, 40);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isUser, isStreaming, message.text]);

  // Nessuno scroll interno: lo scorrimento è centralizzato in ChatWindow
  // per evitare movimenti concorrenti e salti di layout durante lo streaming.

  return (
    <div
      className={`message-fade-in w-fit max-w-[85%] px-4 py-2 text-[13px] leading-relaxed ${
        isUser
          ? "ml-auto rounded-2xl rounded-tr-sm bg-neutral-900 text-white shadow-sm shadow-black/30"
          : "mr-auto rounded-2xl bg-white text-neutral-800 shadow-sm shadow-slate-200/80 ring-1 ring-neutral-200"
      }`}
    >
      {isUser ? (
        <>
          {message.docs && message.docs.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.docs.map((d) => (
                <DocChip
                  key={d.fileUri}
                  href={d.fileUri}
                  label={d.displayName || d.filename}
                />
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {message.text}
          </p>
        </>
      ) : (
        <>
          <div
            className={`text-[13px] leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:font-semibold ${
              isStreaming ? "typewriter-content" : ""
            }`}
          >
            <ReactMarkdown>{displayedText}</ReactMarkdown>
          </div>
          {message.sources && message.sources.length > 0 && (
            <div className="mt-2 border-t border-gray-200 pt-2">
              <p className="mb-1 text-xs font-semibold text-slate-600">Fonti</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                {message.sources.map((src, i) => (
                  <li key={i}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 underline hover:text-indigo-800"
                    >
                      {src.title || src.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
