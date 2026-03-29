"use client";

import { useState, useRef } from "react";
import { FileUp, SendHorizontal } from "lucide-react";
import type { BuroDoc } from "@/types/chat";
import type { UploadResponse } from "@/types/chat";
import { DocBadge } from "./DocBadge";

export interface ChatInputProps {
  onSend: (text: string) => void;
  onUploadSuccess: (doc: BuroDoc) => void;
  docs: BuroDoc[];
  onRemoveDoc: (index: number) => void;
  onUploadError?: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onUploadSuccess,
  docs,
  onRemoveDoc,
  onUploadError,
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const uploadFile = async (file: File): Promise<void> => {
    if (!file || file.type !== "application/pdf") {
      onUploadError?.("Carica solo file PDF.");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as UploadResponse | { error?: string };
      if (!res.ok) {
        onUploadError?.((data as { error?: string }).error ?? "Upload fallito");
        return;
      }
      const upload = data as UploadResponse;
      const doc: BuroDoc = {
        fileUri: upload.fileUri,
        mimeType: "application/pdf",
        filename: upload.filename,
        displayName: upload.displayName,
      };
      onUploadSuccess(doc);
    } catch {
      onUploadError?.("Errore di connessione durante l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div
        className={`flex flex-col gap-1.5 rounded-2xl border border-teal-950/[0.08] bg-white px-3 py-2 text-stone-800 shadow-sm shadow-teal-950/6 transition-all sm:px-3.5 sm:py-2 ${
          isDragging ? "ring-2 ring-teal-500/30" : "ring-0"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {docs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            {docs.map((doc, i) => (
              <DocBadge
                key={doc.fileUri}
                doc={doc}
                onRemove={() => onRemoveDoc(i)}
              />
            ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Scrivi un messaggio..."
            disabled={disabled}
            className="flex-1 rounded-md border border-transparent bg-transparent px-3 py-1.5 text-[13px] text-stone-900 outline-none placeholder:text-stone-400 focus:border-teal-300/50 focus:ring-0 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-900 shadow-sm shadow-teal-950/8 ring-1 ring-teal-900/10 transition-all hover:bg-teal-100 disabled:opacity-50"
          >
            {isUploading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            ) : (
              <FileUp size={14} />
            )}
          </button>
          <button
            type="submit"
            disabled={disabled || isUploading || !value.trim()}
            className="inline-flex h-8 items-center justify-center rounded-full bg-teal-800 px-4 text-[11px] font-semibold text-teal-50 shadow-md shadow-teal-950/25 transition-all hover:bg-teal-900 disabled:opacity-40"
          >
            <SendHorizontal size={14} className="mr-1" />
            <span>Invia</span>
          </button>
        </div>
      </div>
    </form>
  );
}
