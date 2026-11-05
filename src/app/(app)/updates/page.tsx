"use client";

/**
 * Activity & client updates.
 *
 * "Activity" is the merged timeline of what has happened on the job — comments,
 * invoices, shifts, selections, updates — newest first. "Client updates" is the
 * builder's broadcast channel to the homeowner: posts the owner sees in their
 * portal.
 */

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import { Badge, Card, ErrorNote, Field, Loading, Modal, PageHeader, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { ActivityEvent, ClientUpdate, Job } from "@/types/api";

type Tab = "activity" | "updates";
const TABS: readonly Tab[] = ["activity", "updates"] as const;
const TAB_LABEL: Record<Tab, string> = { activity: "Activity", updates: "Client updates" };

const KIND_TONE: Record<string, "ok" | "warn" | "danger" | "brand" | "neutral"> = {
  comment: "neutral", client_update: "brand", invoice: "ok", shift: "warn", selection: "brand",
};
function jobLabel(j: Job): string {
  return j.elevation ? `${j.job_number} · ${j.elevation}` : j.job_number;
}
function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UpdatesPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const jobs = useAsync(() => api.jobOptions(), []);
  const [jobId, setJobId] = useState("");
  const [tab, setTab] = useState<Tab>("activity");
  useEffect(() => { if (!jobId && jobs.data?.length) setJobId(jobs.data[0].id); }, [jobs.data, jobId]);

  const feed = useAsync(
    () => (jobId && tab === "activity" ? api.activityFeed(jobId) : Promise.resolve([] as ActivityEvent[])),
    [jobId, tab],
  );
  const updates = useAsync(
    () => (jobId && tab === "updates" ? api.listClientUpdates(jobId) : Promise.resolve([] as ClientUpdate[])),
    [jobId, tab],
  );

  const [postOpen, setPostOpen] = useState(false);
  const [post, setPost] = useState({ title: "", body: "", is_published: true });
  const [busy, setBusy] = useState(false);

  async function submitPost() {
    if (!jobId || !post.title.trim() || !post.body.trim()) { toast.error("Title and body are required."); return; }
    setBusy(true);
    try {
      await api.postClientUpdate({ job_id: jobId, title: post.title.trim(), body: post.body.trim(), is_published: post.is_published });
      toast.success("Update posted");
      setPostOpen(false); setPost({ title: "", body: "", is_published: true });
      updates.reload();
    } catch (e) { toast.error("Could not post", e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  function removeUpdate(u: ClientUpdate) {
    confirm({ title: "Delete update?", body: `"${u.title}" will be removed.`, confirmLabel: "Delete", tone: "danger",
      onConfirm: async () => { try { await api.deleteClientUpdate(u.id); toast.success("Deleted"); updates.reload(); } catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); } } });
  }

  return (
    <div>
      <PageHeader
        title="Activity & updates"
        subtitle="The job's timeline, and the updates you broadcast to the homeowner."
        action={
          <div className="flex items-center gap-2">
            <select className="input w-auto max-w-[16rem]" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Home">
              {(jobs.data ?? []).map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
            </select>
            {tab === "updates" && <button className="btn btn-primary" disabled={!jobId} onClick={() => setPostOpen(true)}>Post update</button>}
          </div>
        }
      />
      {jobs.error && <ErrorNote message={jobs.error} />}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "activity" ? (
        <Card>
          {feed.loading ? <Loading variant="text" /> : feed.error ? <ErrorNote message={feed.error} /> : (feed.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>No activity on this home yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l pl-5" style={{ borderColor: "var(--border)" }}>
              {(feed.data ?? []).map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: "var(--brand)" }} />
                  <div className="flex items-center gap-2">
                    <Badge tone={KIND_TONE[e.kind] ?? "neutral"}>{e.kind.replace(/_/g, " ")}</Badge>
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>· {when(e.at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                    {e.actor}{e.detail ? ` — ${e.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : (
        <Card padded={false}>
          {updates.loading ? <Loading variant="text" /> : updates.error ? <div className="p-5"><ErrorNote message={updates.error} /></div> : (updates.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>No client updates posted yet.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {(updates.data ?? []).map((u) => (
                <div key={u.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.title}</span>
                        {!u.is_published && <Badge tone="warn">draft</Badge>}
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "var(--fg-muted)" }}>{u.body}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>{u.posted_by_name} · {u.posted_on}</p>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => removeUpdate(u)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal open={postOpen} title="Post a client update" onClose={() => setPostOpen(false)}>
        <div className="space-y-3">
          <Field label="Title"><input className="input" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} autoFocus /></Field>
          <Field label="Update"><textarea className="input" rows={4} value={post.body} onChange={(e) => setPost({ ...post, body: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={post.is_published} onChange={(e) => setPost({ ...post, is_published: e.target.checked })} />
            Publish to the owner&apos;s portal now
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setPostOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submitPost}>{busy ? "Posting…" : "Post"}</button>
        </div>
      </Modal>
      {dialog}
    </div>
  );
}
