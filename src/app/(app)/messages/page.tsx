"use client";

/**
 * Messages — talk between people.
 *
 * An internal inbox: notes sent to named colleagues, grouped into threads, with
 * per-person read state. Email-shaped, in-house, and tied to a job when it helps.
 */

import { useEffect, useState } from "react";

import { useToast } from "@/components/Toast";
import { Badge, Card, ErrorNote, Field, Loading, Modal, PageHeader, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { MessageItem, ThreadSummary, User } from "@/types/api";

type Box = "inbox" | "sent";
const BOXES: readonly Box[] = ["inbox", "sent"] as const;

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MessagesPage() {
  const toast = useToast();
  const users = useAsync(() => api.listUsers(1, 200), []);
  const [box, setBox] = useState<Box>("inbox");
  const summary = useAsync(() => api.inboxSummary(), []);
  const threads = useAsync(() => (box === "inbox" ? api.inbox() : api.sentMessages()), [box]);

  const [openThread, setOpenThread] = useState<string | null>(null);
  const thread = useAsync(
    () => (openThread ? api.readThread(openThread) : Promise.resolve([] as MessageItem[])),
    [openThread],
  );

  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  // compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<{ subject: string; body: string; recipients: string[] }>({ subject: "", body: "", recipients: [] });

  function reloadLists() {
    threads.reload();
    summary.reload();
  }

  async function send() {
    if (!compose.subject.trim() || !compose.body.trim() || compose.recipients.length === 0) {
      toast.error("Subject, message and at least one recipient are required.");
      return;
    }
    setBusy(true);
    try {
      await api.sendMessage({ subject: compose.subject.trim(), body: compose.body.trim(), recipient_ids: compose.recipients });
      toast.success("Message sent");
      setComposeOpen(false);
      setCompose({ subject: "", body: "", recipients: [] });
      reloadLists();
    } catch (err) { toast.error("Could not send", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  async function sendReply() {
    if (!openThread || !reply.trim()) return;
    setBusy(true);
    try {
      await api.replyMessage(openThread, reply.trim());
      setReply("");
      thread.reload();
      reloadLists();
    } catch (err) { toast.error("Could not reply", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  // Reloading the thread list marks inbox threads read when opened.
  useEffect(() => { if (openThread) reloadLists(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [thread.data]);

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Your internal inbox — send and reply to colleagues, grouped into threads."
        action={<button className="btn btn-primary" onClick={() => setComposeOpen(true)}>New message</button>}
      />

      <div className="mb-4 flex items-center gap-3">
        <Tabs tabs={BOXES} active={box} onChange={setBox} counts={s ? { inbox: s.unread } : undefined} />
      </div>

      <Card padded={false}>
        {threads.loading ? <Loading /> : threads.error ? <div className="p-5"><ErrorNote message={threads.error} /></div> : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {(threads.data ?? []).length === 0 && (
              <p className="py-10 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                {box === "inbox" ? "Your inbox is empty." : "You haven't sent anything yet."}
              </p>
            )}
            {(threads.data ?? []).map((t: ThreadSummary) => (
              <button
                key={t.thread_id}
                onClick={() => setOpenThread(t.thread_id)}
                className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--neutral-soft)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm ${t.unread ? "font-semibold" : "font-medium"}`}>{t.subject}</span>
                    {t.unread > 0 && <Badge tone="danger">{t.unread}</Badge>}
                    {t.message_count > 1 && <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>· {t.message_count}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--fg-muted)" }}>
                    {t.participants.join(", ")} — {t.snippet}
                  </p>
                </div>
                <span className="shrink-0 text-xs" style={{ color: "var(--fg-subtle)" }}>{when(t.last_at)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* thread view */}
      <Modal open={openThread !== null} title={thread.data?.[0]?.subject ?? "Thread"} onClose={() => { setOpenThread(null); setReply(""); }}>
        {thread.loading ? <Loading variant="text" /> : (
          <div className="space-y-4">
            <div className="max-h-[50vh] space-y-4 overflow-auto">
              {(thread.data ?? []).map((m) => (
                <div key={m.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{m.sender_name}</span>
                    <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{when(m.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                    To: {m.recipients.map((r) => r.user_name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <textarea className="input" rows={2} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="mt-2 flex justify-end">
                <button className="btn btn-primary" disabled={busy || !reply.trim()} onClick={sendReply}>{busy ? "Sending…" : "Reply"}</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* compose */}
      <Modal open={composeOpen} title="New message" onClose={() => setComposeOpen(false)}>
        <div className="space-y-3">
          <Field label="To" hint="Pick one or more colleagues.">
            <select
              className="input"
              multiple
              size={5}
              value={compose.recipients}
              onChange={(e) => setCompose({ ...compose, recipients: Array.from(e.target.selectedOptions, (o) => o.value) })}
            >
              {(users.data?.items ?? []).map((u: User) => (
                <option key={u.id} value={u.id}>{u.full_name}{u.job_title ? ` — ${u.job_title}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject"><input className="input" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} /></Field>
          <Field label="Message"><textarea className="input" rows={4} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setComposeOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </Modal>
    </div>
  );
}
