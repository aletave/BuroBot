"use client";

import type { BuroDoc } from "@/types/chat";

export interface DocBadgeProps {
  doc: BuroDoc;
  onRemove: () => void;
}

export function DocBadge({ doc, onRemove }: DocBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100/90 px-3 py-1 text-sm text-teal-950 ring-1 ring-teal-200/70">
      <span className="truncate max-w-[120px]" title={doc.filename}>
        {doc.displayName || doc.filename}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-teal-800 hover:bg-teal-200/70"
        aria-label={`Rimuovi ${doc.displayName || doc.filename}`}
      >
        ×
      </button>
    </span>
  );
}
