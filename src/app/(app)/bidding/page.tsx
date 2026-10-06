"use client";

import { useState } from "react";

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
  StatusBadge,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { BidPackage, TradeScore } from "@/types/api";

export default function BiddingPage() {
  const packages = useAsync(() => api.listBidPackages(), []);
  const summary = useAsync(() => api.bidSummary(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const plans = useAsync(() => api.listPlans(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  // Price is one input. Whether they finish on time, clear their punch list and
  // can legally hold a purchase order are the others, and this is the moment
  // they matter - after the award it is somebody else's problem.
  const scores = useAsync(() => api.tradeScorecard(), []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BidPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const vendor = byId(vendors.data);
  const code = byId(codes.data);

  const all = packages.data ?? [];
  const s = summary.data;

  function reloadAll() {
    packages.reload();
    summary.reload();
  }

  async function guard(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function invite(pkgId: string, vendorId: string) {
    await guard(() => api.inviteToBid(pkgId, [vendorId]), "Could not invite");
  }
  async function submit(pkgId: string, bidId: string, amount: string) {
    await guard(() => api.submitBid(pkgId, bidId, amount), "Could not record the bid");
  }
  async function decline(pkgId: string, bidId: string) {
    await guard(() => api.declineBid(pkgId, bidId), "Could not record the no-bid");
  }
  async function cancel(pkgId: string) {
    await guard(() => api.cancelBidPackage(pkgId), "Could not cancel");
  }

  async function award(pkgId: string, bidId: string, jobId?: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.awardBid(pkgId, bidId, jobId || undefined);
      const saved =
        result.savings_vs_estimate != null
          ? ` ${Number(result.savings_vs_estimate) >= 0 ? "Saved" : "Over estimate by"} ${money(Math.abs(Number(result.savings_vs_estimate)))} vs estimate.`
          : "";
      setNote(
        (result.po_number
          ? `Awarded at ${money(result.amount)} — purchase order ${result.po_number} raised at the bid price.`
          : `Awarded at ${money(result.amount)}. No job selected, so no purchase order was raised.`) + saved,
      );
      reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not award");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bid management"
        subtitle="Get trades to price the work before committing to it. Awarding a bid raises the purchase order at the quoted price."
        action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            New bid package
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Out for bid"
          value={s?.out_for_bid ?? "—"}
          tone={s?.out_for_bid ? "warn" : "default"}
          hint={s?.response_rate != null ? `${Math.round(s.response_rate * 100)}% response` : "Awaiting prices"}
        />
        <StatTile
          label="Overdue"
          value={s?.overdue ?? "—"}
          tone={s?.overdue ? "danger" : "ok"}
          hint="Past due, still open"
        />
        <StatTile label="Awarded" value={s?.awarded ?? "—"} tone="ok" hint={s ? money(s.awarded_value) : undefined} />
        <StatTile
          label="Saved vs estimate"
          value={s ? money(s.savings) : "—"}
          tone={s && Number(s.savings) >= 0 ? "ok" : "danger"}
          hint="Across awarded packages"
        />
      </div>

      {note && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
        >
          {note}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      {packages.loading ? (
        <Loading />
      ) : all.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
            No bid packages yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {all.map((pkg) => (
            <Card
              key={pkg.id}
              title={`${pkg.package_number} — ${pkg.name}`}
              padded={false}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">rev {pkg.document_revision}</Badge>
                  {pkg.is_overdue && <Badge tone="danger">Overdue</Badge>}
                  <StatusBadge status={pkg.status} />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExpanded(expanded === pkg.id ? null : pkg.id)}
                  >
                    {expanded === pkg.id ? "Hide" : "Bids"}
                  </button>
                  {pkg.status !== "awarded" && pkg.status !== "cancelled" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(pkg)}>
                      Edit
                    </button>
                  )}
                  {pkg.status !== "awarded" && pkg.status !== "cancelled" && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--danger)" }}
                      disabled={busy}
                      onClick={() => void cancel(pkg.id)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              }
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 px-5 py-3 text-sm">
                <span style={{ color: "var(--fg-muted)" }}>
                  Cost code <strong style={{ color: "var(--fg)" }}>{code.get(pkg.cost_code_id)?.code ?? "—"}</strong>
                </span>
                <span style={{ color: "var(--fg-muted)" }}>
                  Coverage{" "}
                  <strong style={{ color: "var(--fg)" }}>
                    {pkg.submitted_count}/{pkg.invited_count}
                  </strong>
                  {pkg.declined_count > 0 && (
                    <span style={{ color: "var(--fg-subtle)" }}> ({pkg.declined_count} declined)</span>
                  )}
                </span>
                {pkg.estimate && (
                  <span style={{ color: "var(--fg-muted)" }}>
                    Estimate <strong style={{ color: "var(--fg)" }}>{money(pkg.estimate)}</strong>
                  </span>
                )}
                <span style={{ color: "var(--fg-muted)" }}>
                  Low <strong style={{ color: "var(--fg)" }}>{pkg.low_bid ? money(pkg.low_bid) : "—"}</strong>
                </span>
                {pkg.high_bid && pkg.high_bid !== pkg.low_bid && (
                  <span style={{ color: "var(--fg-muted)" }}>
                    High <strong style={{ color: "var(--fg)" }}>{money(pkg.high_bid)}</strong>
                  </span>
                )}
                {pkg.spread && (
                  <span style={{ color: "var(--fg-muted)" }}>
                    Spread <strong style={{ color: "var(--fg)" }}>{money(pkg.spread)}</strong>
                  </span>
                )}
                {pkg.savings_vs_estimate != null && (
                  <span style={{ color: "var(--fg-muted)" }}>
                    {Number(pkg.savings_vs_estimate) >= 0 ? "Under est." : "Over est."}{" "}
                    <strong style={{ color: Number(pkg.savings_vs_estimate) >= 0 ? "var(--ok)" : "var(--danger)" }}>
                      {money(Math.abs(Number(pkg.savings_vs_estimate)))}
                    </strong>
                  </span>
                )}
                <span style={{ color: pkg.is_overdue ? "var(--danger)" : "var(--fg-muted)" }}>Due {day(pkg.due_date)}</span>
              </div>

              {expanded === pkg.id && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <BidRows
                    pkg={pkg}
                    vendors={vendors.data ?? []}
                    jobs={jobs.data ?? []}
                    vendorName={(id) => vendor.get(id)?.name ?? "—"}
                    busy={busy}
                    onInvite={(vid) => invite(pkg.id, vid)}
                    onSubmit={(bid, amt) => submit(pkg.id, bid, amt)}
                    onDecline={(bid) => decline(pkg.id, bid)}
                    onAward={(bid, job) => award(pkg.id, bid, job)}
                    scoreFor={(vendorId) =>
                      (scores.data ?? []).find((sc) => sc.vendor_id === vendorId) ?? null
                    }
                    onRevise={() => guard(() => api.reviseBidPackage(pkg.id), "Could not revise")}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <NewPackage
        open={open}
        codes={codes.data ?? []}
        plans={plans.data ?? []}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          reloadAll();
        }}
      />
      <EditPackage
        pkg={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          reloadAll();
        }}
      />
    </>
  );
}

function BidRows({
  pkg,
  vendors,
  jobs,
  vendorName,
  busy,
  onInvite,
  onSubmit,
  onDecline,
  onAward,
  onRevise,
  scoreFor,
}: {
  pkg: { id: string; status: string; document_revision: number; bids: import("@/types/api").Bid[] };
  vendors: { id: string; name: string }[];
  jobs: { id: string; job_number: string }[];
  vendorName: (id: string) => string;
  busy: boolean;
  onInvite: (vendorId: string) => void;
  onSubmit: (bidId: string, amount: string) => void;
  onDecline: (bidId: string) => void;
  onAward: (bidId: string, jobId?: string) => void;
  onRevise: () => void;
  scoreFor: (vendorId: string) => TradeScore | null;
}) {
  const [inviteVendor, setInviteVendor] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [awardJob, setAwardJob] = useState("");

  const invited = new Set(pkg.bids.map((b) => b.vendor_id));

  return (
    <>
      <div className="flex flex-wrap items-end gap-2 px-5 py-4">
        <select
          className="input max-w-xs"
          value={inviteVendor}
          onChange={(e) => setInviteVendor(e.target.value)}
        >
          <option value="">Invite a trade…</option>
          {vendors
            .filter((v) => !invited.has(v.id))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
        <button
          className="btn btn-primary btn-sm"
          disabled={!inviteVendor || busy}
          onClick={() => {
            onInvite(inviteVendor);
            setInviteVendor("");
          }}
        >
          Invite
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onRevise} disabled={busy}>
          Revise drawings
        </button>
        <select className="input max-w-[12rem]" value={awardJob} onChange={(e) => setAwardJob(e.target.value)}>
          <option value="">Award to job…</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.job_number}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { key: "trade", label: "Trade" },
          { key: "record", label: "Record" },
          { key: "status", label: "Status" },
          { key: "rev", label: "Rev", align: "right" },
          { key: "amount", label: "Bid", align: "right" },
          { key: "act", label: "", align: "right" },
        ]}
        empty="No trades invited yet."
      >
        {pkg.bids.map((b) => {
          const stale = b.revision_bid !== pkg.document_revision;
          const score = scoreFor(b.vendor_id);
          const blocked = score?.dimensions.compliance.score === 0;
          return (
            <tr key={b.id}>
              <td className="font-medium">
                {vendorName(b.vendor_id)}
                {blocked && (
                  <div className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                    Cannot hold a purchase order today
                  </div>
                )}
              </td>
              <td>
                {score?.overall === null || !score ? (
                  <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    No history
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="tnum rounded-md px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        background:
                          score.overall >= 80
                            ? "var(--ok-soft)"
                            : score.overall >= 55
                              ? "var(--warn-soft)"
                              : "var(--danger-soft)",
                        color:
                          score.overall >= 80
                            ? "var(--ok)"
                            : score.overall >= 55
                              ? "var(--warn)"
                              : "var(--danger)",
                      }}
                    >
                      {score.overall}
                    </span>
                    {score.provisional && (
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        thin
                      </span>
                    )}
                  </span>
                )}
              </td>
              <td>
                <StatusBadge status={b.status} />
              </td>
              <td className="num">
                {stale ? (
                  <Badge tone="danger">stale r{b.revision_bid}</Badge>
                ) : (
                  <span style={{ color: "var(--fg-subtle)" }}>r{b.revision_bid}</span>
                )}
              </td>
              <td className="num">
                {b.status === "declined" ? (
                  <span style={{ color: "var(--fg-subtle)" }}>No bid</span>
                ) : b.amount ? (
                  money(b.amount)
                ) : (
                  <input
                    className="input max-w-[8rem] text-right"
                    placeholder="0.00"
                    value={amounts[b.id] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [b.id]: e.target.value }))}
                  />
                )}
              </td>
              <td className="num">
                <div className="flex justify-end gap-1.5">
                  {b.status === "invited" && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={!amounts[b.id] || busy}
                        onClick={() => onSubmit(b.id, amounts[b.id])}
                      >
                        Record
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--fg-subtle)" }}
                        disabled={busy}
                        onClick={() => onDecline(b.id)}
                      >
                        No bid
                      </button>
                    </>
                  )}
                  {b.amount && b.status === "submitted" && (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => onAward(b.id, awardJob)}
                      title={stale ? "This bid is priced against an old revision" : undefined}
                    >
                      Award
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </>
  );
}

function NewPackage({
  open,
  codes,
  plans,
  onClose,
  onDone,
}: {
  open: boolean;
  codes: { id: string; code: string; name: string }[];
  plans: { id: string; code: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [costCodeId, setCostCodeId] = useState("");
  const [planId, setPlanId] = useState("");
  const [scope, setScope] = useState("");
  const [estimate, setEstimate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createBidPackage({
        name,
        cost_code_id: costCodeId,
        plan_id: planId || undefined,
        scope: scope || undefined,
        estimate: estimate || undefined,
        due_date: dueDate || undefined,
      });
      setName("");
      setScope("");
      setEstimate("");
      setDueDate("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the package");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="New bid package" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Package name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Electrical rough-in, Plan 3" />
        </Field>
        <Field label="Cost code">
          <select className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} required>
            <option value="">Select…</option>
            {codes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan" hint="Optional. Production builders bid per plan.">
          <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estimate ($)" hint="Your own target — bids level against it.">
            <input className="input" inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="20000.00" />
          </Field>
          <Field label="Bids due">
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Scope">
          <input className="input" value={scope} onChange={(e) => setScope(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditPackage({
  pkg,
  onClose,
  onDone,
}: {
  pkg: BidPackage | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    if (!pkg) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateBidPackage(pkg.id, {
        name: String(form.get("name")),
        scope: String(form.get("scope") || "") || undefined,
        estimate: String(form.get("estimate") || "") || undefined,
        due_date: String(form.get("due_date") || "") || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={pkg !== null} title={`Edit ${pkg?.package_number ?? ""}`} onClose={onClose}>
      {pkg && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(new FormData(e.currentTarget));
          }}
        >
          <Field label="Package name">
            <input name="name" className="input" required defaultValue={pkg.name} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estimate ($)" hint="Your own target — bids level against it.">
              <input name="estimate" className="input" inputMode="decimal" defaultValue={pkg.estimate ?? ""} />
            </Field>
            <Field label="Bids due">
              <input name="due_date" type="date" className="input" defaultValue={pkg.due_date ?? ""} />
            </Field>
          </div>
          <Field label="Scope">
            <input name="scope" className="input" defaultValue={pkg.scope ?? ""} />
          </Field>
          {error && <ErrorNote message={error} />}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
