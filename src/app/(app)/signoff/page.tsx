"use client";

/**
 * Materials selection signoff.
 *
 * The question this screen answers is the one the selection sheet could not: has
 * the *customer* approved the material? The builder picks a home, sends its
 * selections to the buyer with a deadline, and the buyer approves each with a
 * typed signature or declines with a reason. Approval is tracked apart from the
 * contractual status — a decline is a buyer saying "not that one", not a budget
 * movement — so the two never get conflated.
 */

import { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  Tabs,
  Tone,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Job, SelectionApprovalStatus, SelectionSignoff } from "@/types/api";

type Filter = "all" | SelectionApprovalStatus;

const FILTERS: readonly Filter[] = [
  "all",
  "not_submitted",
  "awaiting",
  "approved",
  "declined",
] as const;

const LABELS: Record<Filter, string> = {
  all: "All",
  not_submitted: "Not submitted",
  awaiting: "Awaiting buyer",
  approved: "Approved",
  declined: "Declined",
};

function approvalTone(s: SelectionApprovalStatus): Tone {
  switch (s) {
    case "approved":
      return "ok";
    case "declined":
      return "danger";
    case "awaiting":
      return "warn";
    default:
      return "neutral";
  }
}

function jobLabel(j: Job): string {
  return j.elevation ? `${j.job_number} · ${j.elevation}` : j.job_number;
}

export default function SignoffPage() {
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const jobs = useAsync(() => api.jobOptions(), []);
  const [jobId, setJobId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");

  // Default to the first home once the list arrives.
  useEffect(() => {
    if (!jobId && jobs.data && jobs.data.length) setJobId(jobs.data[0].id);
  }, [jobs.data, jobId]);

  const summary = useAsync(
    () => (jobId ? api.signoffSummary(jobId) : Promise.resolve(null)),
    [jobId],
  );
  const rows = useAsync(
    () =>
      jobId
        ? api.listSignoff(jobId, filter === "all" ? undefined : filter)
        : Promise.resolve([] as SelectionSignoff[]),
    [jobId, filter],
  );

  const reloadAll = () => {
    summary.reload();
    rows.reload();
  };

  // --- modals ---
  const [requestOpen, setRequestOpen] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  const [decision, setDecision] = useState<
    | { kind: "approve" | "decline"; row: SelectionSignoff }
    | null
  >(null);
  const [signature, setSignature] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  // choices + allowance
  const [choicesForId, setChoicesForId] = useState<string | null>(null);
  const choicesFor = (rows.data ?? []).find((r) => r.id === choicesForId) ?? null;
  const [allowanceInput, setAllowanceInput] = useState("");
  const [requiresInput, setRequiresInput] = useState(false);
  const [choiceForm, setChoiceForm] = useState({ description: "", price: "" });

  function openChoices(r: SelectionSignoff) {
    setChoicesForId(r.id);
    setAllowanceInput(r.allowance_amount ?? "");
    setRequiresInput(r.requires_client_selection);
    setChoiceForm({ description: "", price: "" });
  }
  async function saveAllowance() {
    if (!choicesFor) return;
    try {
      await api.setSelectionAllowance(choicesFor.id, {
        allowance_amount: allowanceInput ? Number(allowanceInput) : null,
        requires_client_selection: requiresInput,
      });
      toast.success("Allowance saved");
      summary.reload(); rows.reload();
    } catch (e) { toast.error("Could not save", e instanceof Error ? e.message : undefined); }
  }
  async function addChoice() {
    if (!choicesFor || !choiceForm.description.trim()) { toast.error("A description is required."); return; }
    try {
      await api.addSelectionChoice(choicesFor.id, { description: choiceForm.description.trim(), price: Number(choiceForm.price) || 0 });
      setChoiceForm({ description: "", price: "" });
      rows.reload();
    } catch (e) { toast.error("Could not add choice", e instanceof Error ? e.message : undefined); }
  }
  async function pickChoice(choiceId: string) {
    try { await api.selectSelectionChoice(choiceId); rows.reload(); }
    catch (e) { toast.error("Could not select", e instanceof Error ? e.message : undefined); }
  }
  async function removeChoice(choiceId: string) {
    try { await api.deleteSelectionChoice(choiceId); rows.reload(); }
    catch (e) { toast.error("Could not remove", e instanceof Error ? e.message : undefined); }
  }

  const counts = useMemo(() => {
    const s = summary.data;
    if (!s) return undefined;
    return {
      not_submitted: s.not_submitted,
      awaiting: s.awaiting,
      approved: s.approved,
      declined: s.declined,
    } as Partial<Record<Filter, number>>;
  }, [summary.data]);

  async function sendForApproval() {
    if (!jobId) return;
    setBusy(true);
    try {
      const sent = await api.requestSelectionApproval(jobId, {
        deadline: deadline || null,
      });
      toast.success(
        `Sent to the buyer`,
        `${sent.length} selection${sent.length === 1 ? "" : "s"} now awaiting approval.`,
      );
      setRequestOpen(false);
      setDeadline("");
      reloadAll();
    } catch (err) {
      toast.error("Could not send for approval", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  function openDecision(kind: "approve" | "decline", row: SelectionSignoff) {
    setDecision({ kind, row });
    setSignature(row.buyer_signature ?? "");
    setReason("");
    setComment("");
  }

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    try {
      if (decision.kind === "approve") {
        if (!signature.trim()) {
          toast.error("A signature is required to approve.");
          setBusy(false);
          return;
        }
        await api.approveSelection(decision.row.id, {
          signature: signature.trim(),
          comment: comment.trim() || null,
        });
        toast.success("Approved", `${decision.row.option_name} signed off.`);
      } else {
        if (!reason.trim()) {
          toast.error("A reason is required to decline.");
          setBusy(false);
          return;
        }
        await api.declineSelection(decision.row.id, {
          reason: reason.trim(),
          signature: signature.trim() || null,
          comment: comment.trim() || null,
        });
        toast.success("Decline recorded", `${decision.row.option_name} sent back.`);
      }
      setDecision(null);
      reloadAll();
    } catch (err) {
      toast.error("That did not go through", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  function reset(row: SelectionSignoff) {
    confirm({
      title: "Pull back from signoff?",
      body: `${row.option_name} will return to "not submitted" so it can be corrected and re-sent.`,
      confirmLabel: "Pull back",
      onConfirm: async () => {
        try {
          await api.resetSelectionSignoff(row.id);
          toast.success("Pulled back", `${row.option_name} is editable again.`);
          reloadAll();
        } catch (err) {
          toast.error("Could not reset", err instanceof Error ? err.message : undefined);
        }
      },
    });
  }

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Selection signoff"
        subtitle="Send a home's chosen materials to the buyer, and capture their approval or decline against each one."
        action={
          <div className="flex items-center gap-2">
            <select
              className="input w-auto max-w-[16rem]"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              aria-label="Home"
            >
              {(jobs.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {jobLabel(j)}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={!jobId || busy}
              onClick={() => setRequestOpen(true)}
            >
              Request approval
            </button>
          </div>
        }
      />

      {jobs.error && <ErrorNote message={jobs.error} />}

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Total" value={s.total} />
          <StatTile label="Not submitted" value={s.not_submitted} />
          <StatTile label="Awaiting buyer" value={s.awaiting} tone={s.awaiting ? "warn" : "default"} />
          <StatTile label="Approved" value={s.approved} tone={s.approved ? "ok" : "default"} />
          <StatTile
            label="Overdue"
            value={s.overdue}
            tone={s.overdue ? "danger" : "default"}
            hint={s.declined ? `${s.declined} declined` : undefined}
          />
        </div>
      )}

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} counts={counts} />

      <Card padded={false}>
        {rows.loading ? (
          <Loading />
        ) : rows.error ? (
          <div className="p-5">
            <ErrorNote message={rows.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "sel", label: "Selection" },
              { key: "price", label: "Price", align: "right" },
              { key: "allowance", label: "Allowance" },
              { key: "status", label: "Approval" },
              { key: "when", label: "Requested / decided" },
              { key: "sig", label: "Signature / reason" },
              { key: "act", label: "" },
            ]}
            empty="No selections match this filter for this home."
          >
            {(rows.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="font-medium">{r.option_name}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {r.option_category ?? "—"}
                    {r.quantity > 1 ? ` · ×${r.quantity}` : ""}
                  </div>
                </td>
                <td className="num tnum">{money(r.extended_price)}</td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {r.allowance_amount ? (
                    <>
                      {money(r.allowance_amount)}
                      {r.over_allowance && Number(r.over_allowance) !== 0 && (
                        <span className="ml-1" style={{ color: Number(r.over_allowance) > 0 ? "var(--danger)" : "var(--ok)" }}>
                          ({Number(r.over_allowance) > 0 ? "+" : ""}{money(r.over_allowance)})
                        </span>
                      )}
                      {r.requires_client_selection && <span className="ml-1 text-xs" style={{ color: "var(--warn)" }}>· required</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Badge tone={approvalTone(r.approval_status)}>
                    {LABELS[r.approval_status]}
                  </Badge>
                  {r.approval_overdue && (
                    <span className="ml-2">
                      <Badge tone="danger">overdue</Badge>
                    </span>
                  )}
                </td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {r.decided_at
                    ? day(r.decided_at)
                    : r.approval_deadline
                      ? `due ${day(r.approval_deadline)}`
                      : r.approval_requested_at
                        ? `sent ${day(r.approval_requested_at)}`
                        : "—"}
                </td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {r.approval_status === "approved"
                    ? (r.buyer_signature ?? "—")
                    : r.approval_status === "declined"
                      ? (r.decline_reason ?? "—")
                      : "—"}
                </td>
                <td className="num">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn btn-sm btn-ghost" onClick={() => openChoices(r)}>
                      Choices{r.choices.length ? ` (${r.choices.length})` : ""}
                    </button>
                    {(r.approval_status === "awaiting" ||
                      r.approval_status === "not_submitted") && (
                      <>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openDecision("approve", r)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => openDecision("decline", r)}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {(r.approval_status === "approved" ||
                      r.approval_status === "declined") && (
                      <button className="btn btn-sm btn-ghost" onClick={() => reset(r)}>
                        Reset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {/* Request-approval modal */}
      <Modal open={requestOpen} title="Send selections for approval" onClose={() => setRequestOpen(false)}>
        <p className="mb-4 text-sm" style={{ color: "var(--fg-muted)" }}>
          Every not-yet-submitted selection on this home will be sent to the buyer.
          Selections already awaiting or approved are left as they are.
        </p>
        <Field label="Response deadline" hint="Optional. The date the buyer's answer is wanted by.">
          <input
            type="date"
            className="input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setRequestOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={sendForApproval}>
            {busy ? "Sending…" : "Send to buyer"}
          </button>
        </div>
      </Modal>

      {/* Approve / decline modal */}
      <Modal
        open={decision !== null}
        title={
          decision?.kind === "approve"
            ? `Approve: ${decision?.row.option_name ?? ""}`
            : `Decline: ${decision?.row.option_name ?? ""}`
        }
        onClose={() => setDecision(null)}
      >
        {decision?.kind === "approve" ? (
          <Field label="Buyer signature" hint="The buyer's full name, typed as their signature.">
            <input
              className="input"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="e.g. Elva Alcaron"
            />
          </Field>
        ) : (
          <>
            <Field label="Reason for decline" hint="Required — what the buyer wants instead.">
              <textarea
                className="input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="mt-3">
              <Field label="Buyer signature" hint="Optional.">
                <input
                  className="input"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
        <div className="mt-3">
          <Field label="Comment" hint="Optional note recorded with the decision.">
            <textarea
              className="input"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setDecision(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={submitDecision}
          >
            {busy
              ? "Saving…"
              : decision?.kind === "approve"
                ? "Record approval"
                : "Record decline"}
          </button>
        </div>
      </Modal>

      {/* choices + allowance modal */}
      <Modal open={choicesFor !== null} title={`Choices — ${choicesFor?.option_name ?? ""}`} onClose={() => setChoicesForId(null)}>
        {choicesFor && (
          <div className="space-y-4">
            <div className="rounded-lg p-3" style={{ background: "var(--neutral-soft)" }}>
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Allowance ($)" hint="The buyer's budget for this selection.">
                  <input className="input" type="number" value={allowanceInput} onChange={(e) => setAllowanceInput(e.target.value)} />
                </Field>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={requiresInput} onChange={(e) => setRequiresInput(e.target.checked)} />{" "}
                  Require client to pick
                </label>
              </div>
              <div className="mt-2 flex justify-end"><button className="btn btn-sm btn-primary" onClick={saveAllowance}>Save allowance</button></div>
            </div>

            <div className="space-y-2">
              {choicesFor.choices.length === 0 && (
                <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>No choices yet — add the options the buyer picks between.</p>
              )}
              {choicesFor.choices.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: c.is_selected ? "var(--brand-soft)" : "var(--neutral-soft)" }}>
                  <div className="min-w-0">
                    <span className="font-medium">{c.description}</span>
                    <span className="ml-2 text-sm">{money(c.price)}</span>
                    {c.over_allowance && Number(c.over_allowance) !== 0 && (
                      <span className="ml-1 text-xs" style={{ color: Number(c.over_allowance) > 0 ? "var(--danger)" : "var(--ok)" }}>
                        ({Number(c.over_allowance) > 0 ? "+" : ""}{money(c.over_allowance)} vs allowance)
                      </span>
                    )}
                    {c.is_selected && <span className="ml-2"><Badge tone="brand">picked</Badge></span>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {!c.is_selected && <button className="btn btn-sm btn-ghost" onClick={() => pickChoice(c.id)}>Pick</button>}
                    <button className="btn btn-sm btn-ghost" onClick={() => removeChoice(c.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 items-end gap-2">
              <input className="input col-span-2" placeholder="Choice description" value={choiceForm.description} onChange={(e) => setChoiceForm({ ...choiceForm, description: e.target.value })} />
              <input className="input" type="number" placeholder="Price" value={choiceForm.price} onChange={(e) => setChoiceForm({ ...choiceForm, price: e.target.value })} />
            </div>
            <div className="flex justify-end"><button className="btn btn-sm btn-primary" onClick={addChoice}>Add choice</button></div>
          </div>
        )}
      </Modal>

      {confirmDialog}
    </div>
  );
}
