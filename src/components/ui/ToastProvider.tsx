"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "default" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  addToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "default") => {
    setToasts((prev) => {
      const id = Date.now() + Math.random();
      const next: Toast = { id, message, variant };
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 2600);
      return [...prev, next];
    });
  }, []);

  const value = useMemo(
    () => ({
      addToast,
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4 sm:justify-end sm:px-6">
        <div className="flex max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={[
                "pointer-events-auto message-fade-in rounded-2xl border border-teal-950/[0.08] bg-white/90 px-4 py-2.5 text-xs font-medium text-stone-700 shadow-sm shadow-teal-950/8 backdrop-blur-xl",
                toast.variant === "success"
                  ? "ring-1 ring-emerald-200/70 text-emerald-900"
                  : toast.variant === "error"
                  ? "ring-1 ring-red-200/80 text-red-800"
                  : "ring-1 ring-teal-200/50",
              ].join(" ")}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

