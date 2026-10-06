"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Icons } from "@/components/icons";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastApi {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  /**
   * Run a promise with toast feedback. Returns the resolved value so callers can keep
   * chaining, and re-throws on failure so a caller that needs to branch still can.
   */
  promise: <T>(
    work: Promise<T>,
    messages: { success: string | ((v: T) => string); error?: string },
  ) => Promise<T>;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone, title, detail }]);
      // Errors linger; people need time to read what went wrong.
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
      promise: async (work, messages) => {
        try {
          const value = await work;
          push(
            "success",
            typeof messages.success === "function" ? messages.success(value) : messages.success,
          );
          return value;
        } catch (err) {
          push(
            "error",
            messages.error ?? "That did not work",
            err instanceof Error ? err.message : undefined,
          );
          throw err;
        }
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon =
    toast.tone === "success" ? Icons.warranty : toast.tone === "error" ? Icons.close : Icons.reports;

  return (
    <div className={`toast toast-${toast.tone}`}>
      <span className="toast-icon">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.title}</p>
        {toast.detail && (
          <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--fg-muted)" }}>
            {toast.detail}
          </p>
        )}
      </div>
      <button className="toast-close" onClick={onDismiss} aria-label="Dismiss">
        <Icons.close size={13} />
      </button>
    </div>
  );
}
