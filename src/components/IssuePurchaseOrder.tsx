"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { ErrorNote, Field, Modal } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

type Gate = "compliance" | "budget";

type Pending = {
  po: { id: string; po_number: string };
  gate: Gate;
  message: string;
  /** Overrides already agreed on an earlier pass, so a second refusal adds to them. */
  agreed: Gate[];
  reason: string;
};

/** Which issue gate refused, read from the service's override hint. */
function gateFrom(message: string): Gate | null {
  if (message.includes("skip_compliance")) return "compliance";
  if (message.includes("allow_over_budget")) return "budget";
  return null;
}

/** The refusal without the machine instruction about query flags. */
function humanise(message: string): string {
  return message
    .split(/(?<=\.)\s+/)
    .filter((s) => !s.includes("re-issue with"))
    .join(" ");
}

/**
 * Issue a purchase order, and when a gate refuses, ask for a deliberate override
 * against the gate that actually refused — with a reason, which is written onto the PO.
 *
 * Both screens that issue POs share this, so neither can guess the wrong gate: a
 * compliance refusal used to be presented as a budget one, and the budget override
 * offered in its place could never succeed.
 */
export function useIssuePurchaseOrder(onDone: () => void) {
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attempt(po: Pending["po"], agreed: Gate[], reason?: string) {
    try {
      await api.issuePurchaseOrder(po.id, {
        skipCompliance: agreed.includes("compliance"),
        allowOverBudget: agreed.includes("budget"),
        reason,
      });
      toast.success(
        `${po.po_number} issued`,
        agreed.length
          ? `Override recorded: ${agreed.join(" and ")}. The money is now committed.`
          : "The money is now committed.",
      );
      setPending(null);
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not issue";
      const gate = err instanceof ApiError && err.status === 409 ? gateFrom(message) : null;
      if (gate && !agreed.includes(gate)) {
        setPending({ po, gate, message: humanise(message), agreed, reason: reason ?? "" });
        setError(null);
      } else {
        setPending(null);
        toast.error(`${po.po_number} not issued`, humanise(message));
      }
    }
  }

  function issue(po: Pending["po"]) {
    void attempt(po, []);
  }

  async function confirm() {
    if (!pending) return;
    if (pending.reason.trim().length < 5) {
      setError("Give a reason — it is written onto the purchase order.");
      return;
    }
    setBusy(true);
    await attempt(pending.po, [...pending.agreed, pending.gate], pending.reason.trim());
    setBusy(false);
  }

  const dialog = (
    <Modal
      open={pending !== null}
      title={
        pending
          ? pending.gate === "compliance"
            ? `${pending.po.po_number}: trade not cleared`
            : `${pending.po.po_number}: over budget`
          : ""
      }
      onClose={() => setPending(null)}
    >
      {pending && (
        <div className="space-y-4">
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {pending.message}
          </div>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {pending.gate === "compliance"
              ? "Issuing anyway commits work to a trade the compliance gate refused. If their cover has lapsed, the exposure is the builder's. Renewing the paperwork is usually the right fix."
              : "Issuing anyway commits more than the remaining budget. Raising a change order is usually the right fix."}
          </p>
          <Field label="Reason for the override" hint="Recorded on the PO with who issued it.">
            <textarea
              className="input"
              rows={2}
              value={pending.reason}
              onChange={(e) => setPending({ ...pending, reason: e.target.value })}
              placeholder={
                pending.gate === "compliance"
                  ? "e.g. Renewal certificate seen by email, originals to follow"
                  : "e.g. Buyer upgrade agreed, change order CO00012 to follow"
              }
            />
          </Field>
          {error && <ErrorNote message={error} />}
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
            <Button variant="danger" disabled={busy} onClick={() => confirm()}>
              {busy ? "Issuing…" : "Issue with override"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return { issue, dialog };
}
