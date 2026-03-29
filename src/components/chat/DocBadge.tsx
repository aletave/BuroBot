"use client";

import type { BuroDoc } from "@/types/chat";

export interface DocBadgeProps {
  doc: BuroDoc;
  onRemove: () => void;
}

export function DocBadge({ doc, onRemove }: DocBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-3 py-1 text-sm text-slate-900">
      <span className="truncate max-w-[120px]" title={doc.filename}>
        {doc.displayName || doc.filename}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-gray-200"
        aria-label={`Rimuovi ${doc.displayName || doc.filename}`}
      >
        ×
      </button>
    </span>
  );
}
