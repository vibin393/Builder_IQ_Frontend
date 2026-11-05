"use client";

import { useState } from "react";

import {
  Badge,
  Card,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
  day,
  money,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { SelectionSignoff } from "@/types/api";

export default function MySelectionsPage() {
  const sel = useAsync(() => api.homeownerSelections(), []);
  const toast = useToast();
  const [decision, setDecision] = useState<{ row: SelectionSignoff; mode: "approve" | "decline" } | null>(
    null,
  );

  if (sel.loading) return <Loading label="Loading your selections" />;
  if (sel.error) return <ErrorNote message={sel.error} />;

  const rows = sel.data ?? [];
  const awaiting = rows.filter((r) => r.approval_status === "awaiting");
  const decided = rows.filter((r) => r.approval_status !== "awaiting");

  async function pick(choiceId: string) {
    try {
      await api.homeownerPickChoice(choiceId);
      toast.success("Choice recorded");
      sel.reload();
    } catch (e) {
      toast.error("Could not record your choice", e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <>
      <PageHeader
        title="My selections"
        subtitle="Review the materials chosen for your home and approve them."
      />

      {rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
            Nothing is waiting for your approval right now.
          </p>
        </Card>
      ) : (
        <>
          {awaiting.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--fg-muted)" }}>
                Waiting for you ({awaiting.length})
              </h2>
              <div className="grid gap-4">
                {awaiting.map((r) => (
                  <SelectionCard key={r.id} row={r} onPick={pick} onDecide={setDecision} />
                ))}
              </div>
            </div>
          )}

          {decided.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--fg-muted)" }}>
                Already decided ({decided.length})
              </h2>
              <div className="grid gap-4">
                {decided.map((r) => (
                  <SelectionCard key={r.id} row={r} onPick={pick} onDecide={setDecision} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {decision && (
        <DecisionModal
          row={decision.row}
          mode={decision.mode}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            sel.reload();
          }}
        />
      )}
    </>
  );
}

function SelectionCard({
  row,
  onPick,
  onDecide,
}: {
  row: SelectionSignoff;
  onPick: (choiceId: string) => void;
  onDecide: (d: { row: SelectionSignoff; mode: "approve" | "decline" }) => void;
}) {
  const awaiting = row.approval_status === "awaiting";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{row.option_name}</div>
          {row.option_category && (
            <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              {row.option_category}
            </div>
          )}
        </div>
        <StatusBadge status={row.approval_status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-6 text-sm">
        <Stat label="Price" value={money(row.extended_price)} />
        {row.allowance_amount && <Stat label="Allowance" value={money(row.allowance_amount)} />}
        {row.over_allowance && Number(row.over_allowance) > 0 && (
          <Stat label="Over allowance" value={<Badge tone="warn">+{money(row.over_allowance)}</Badge>} />
        )}
        {row.approval_deadline && (
          <Stat
            label="Please respond by"
            value={
              row.approval_overdue ? (
                <Badge tone="danger">{day(row.approval_deadline)}</Badge>
              ) : (
                day(row.approval_deadline)
              )
            }
          />
        )}
      </div>

      {row.choices.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
            Your options
          </div>
          <div className="grid gap-2">
            {row.choices.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: c.is_selected ? "var(--brand)" : "var(--border)",
                  background: c.is_selected ? "var(--brand-subtle, transparent)" : "transparent",
                }}
              >
                <div>
                  <span className="font-medium">{c.description}</span>
                  <span className="ml-2" style={{ color: "var(--fg-subtle)" }}>
                    {money(c.price)}
                  </span>
                </div>
                {c.is_selected ? (
                  <Badge tone="ok">Selected</Badge>
                ) : (
                  awaiting && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onPick(c.id)}>
                      Choose this
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {row.buyer_signature && (
        <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
          Signed “{row.buyer_signature}”{row.decided_at ? ` on ${day(row.decided_at)}` : ""}
        </p>
      )}
      {row.decline_reason && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger, #b91c1c)" }}>
          Declined: {row.decline_reason}
        </p>
      )}

      {awaiting && (
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" onClick={() => onDecide({ row, mode: "approve" })}>
            Approve
          </button>
          <button className="btn btn-ghost" onClick={() => onDecide({ row, mode: "decline" })}>
            Decline
          </button>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {label}
      </div>
      <div className="tnum font-medium">{value}</div>
    </div>
  );
}

function DecisionModal({
  row,
  mode,
  onClose,
  onDone,
}: {
  row: SelectionSignoff;
  mode: "approve" | "decline";
  onClose: () => void;
  onDone: () => void;
}) {
  const [signature, setSignature] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "approve") {
        await api.homeownerApproveSelection(row.id, { signature, comment: comment || undefined });
      } else {
        await api.homeownerDeclineSelection(row.id, {
          reason,
          signature: signature || undefined,
          comment: comment || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`${mode === "approve" ? "Approve" : "Decline"}: ${row.option_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {mode === "decline" && (
          <Field label="Why are you declining?">
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="I'd like a different colour"
            />
          </Field>
        )}
        <Field
          label={mode === "approve" ? "Type your full name to sign" : "Type your name (optional)"}
          hint={mode === "approve" ? "This is your signature on this selection." : undefined}
        >
          <input
            className="input"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            required={mode === "approve"}
            placeholder="Jordan Alarcon"
          />
        </Field>
        <Field label="Anything to add? (optional)">
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : mode === "approve" ? "Approve selection" : "Decline selection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
