"use client";

/**
 * Comments — talk about a job.
 *
 * Notes pinned to the home everyone working on it can see, threaded so a reply
 * sits under what it answers. This is the discussion layer the audit-style
 * correspondence log never was.
 */

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import { Card, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Comment, Job } from "@/types/api";

function jobLabel(j: Job): string {
  return j.elevation ? `${j.job_number} · ${j.elevation}` : j.job_number;
}
function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function CommentBubble({ c, onReply, onDelete }: { c: Comment; onReply: (c: Comment) => void; onDelete: (c: Comment) => void }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
        style={{ background: "var(--brand-soft)", color: "var(--brand-fg)" }}>
        {initials(c.author_name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{c.author_name}</span>
          <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{when(c.created_at)}</span>
        </div>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
        <div className="mt-1 flex gap-3">
          <button className="text-xs" style={{ color: "var(--brand)" }} onClick={() => onReply(c)}>Reply</button>
          <button className="text-xs" style={{ color: "var(--fg-subtle)" }} onClick={() => onDelete(c)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function CommentsPage() {
  const toast = useToast();
  const jobs = useAsync(() => api.jobOptions(), []);
  const [jobId, setJobId] = useState("");
  useEffect(() => {
    if (!jobId && jobs.data?.length) setJobId(jobs.data[0].id);
  }, [jobs.data, jobId]);

  const comments = useAsync(() => (jobId ? api.listComments(jobId) : Promise.resolve([] as Comment[])), [jobId]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);

  const threaded = useMemo(() => {
    const list = comments.data ?? [];
    const children = new Map<string, Comment[]>();
    const roots: Comment[] = [];
    for (const c of list) {
      if (c.parent_id) {
        children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c]);
      } else roots.push(c);
    }
    return { roots, children };
  }, [comments.data]);

  async function submit() {
    if (!jobId || !body.trim()) return;
    setBusy(true);
    try {
      await api.addComment({ job_id: jobId, body: body.trim(), parent_id: replyTo?.id ?? null });
      setBody("");
      setReplyTo(null);
      comments.reload();
    } catch (err) { toast.error("Could not post", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  async function remove(c: Comment) {
    try { await api.deleteComment(c.id); comments.reload(); }
    catch (err) { toast.error("Could not delete", err instanceof Error ? err.message : undefined); }
  }

  return (
    <div>
      <PageHeader
        title="Comments"
        subtitle="Threaded notes on a home, visible to everyone working on it."
        action={
          <select className="input w-auto max-w-[16rem]" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Home">
            {(jobs.data ?? []).map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
          </select>
        }
      />
      {jobs.error && <ErrorNote message={jobs.error} />}

      <Card>
        {comments.loading ? <Loading variant="text" /> : comments.error ? <ErrorNote message={comments.error} /> : (
          <div className="space-y-5">
            {threaded.roots.length === 0 && (
              <p className="py-6 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                No comments yet. Start the conversation below.
              </p>
            )}
            {threaded.roots.map((c) => (
              <div key={c.id} className="space-y-3">
                <CommentBubble c={c} onReply={setReplyTo} onDelete={remove} />
                {(threaded.children.get(c.id) ?? []).length > 0 && (
                  <div className="ml-11 space-y-3 border-l pl-4" style={{ borderColor: "var(--border)" }}>
                    {(threaded.children.get(c.id) ?? []).map((r) => (
                      <CommentBubble key={r.id} c={r} onReply={setReplyTo} onDelete={remove} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded px-2 py-1 text-xs" style={{ background: "var(--neutral-soft)" }}>
              <span>Replying to {replyTo.author_name}</span>
              <button onClick={() => setReplyTo(null)} style={{ color: "var(--fg-subtle)" }}>Cancel</button>
            </div>
          )}
          <textarea
            className="input"
            rows={2}
            placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <button className="btn btn-primary" disabled={busy || !body.trim() || !jobId} onClick={submit}>
              {busy ? "Posting…" : replyTo ? "Reply" : "Comment"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
