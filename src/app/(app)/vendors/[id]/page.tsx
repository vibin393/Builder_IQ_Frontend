"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { TradeForm } from "@/components/TradeForm";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Menu,
  Modal,
  PageHeader,
  StatTile,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { TradeDocRow, VendorContact } from "@/types/api";

export default function TradePage() {
  const { id } = useParams<{ id: string }>();
  const ov = useAsync(() => api.tradeOverview(id), [id]);
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState<VendorContact | "new" | null>(null);
  const [specs, setSpecs] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  if (ov.error) return <ErrorNote message={ov.error} />;
  if (!ov.data) return <Loading />;
  const o = ov.data;
  const v = o.vendor;
  const isTrade = v.vendor_type !== "supplier";

  async function restore() {
    try {
      await toast.promise(api.restoreVendor(v.id), { success: `${v.name} restored`, error: "Not restored" });
    } catch {
      /* toast */
    }
    ov.reload();
  }

  return (
    <>
      <PageHeader
        title={v.name}
        subtitle={[v.code, titleCase(v.vendor_type), v.company_number && `Co. ${v.company_number}`, v.vat_number && `VAT ${v.vat_number}`]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex items-center gap-2">
            {v.is_archived && <Badge tone="neutral">Archived</Badge>}
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Menu
              label="⋯"
              items={[
                { label: "Specialisms…", run: () => setSpecs(true) },
                { label: "Add a contact…", run: () => setContact("new") },
                v.is_archived
                  ? { label: "Restore", run: restore }
                  : { label: "Archive…", tone: "danger" as const, run: () => setArchiving(true) },
              ]}
            />
          </div>
        }
      />

      {isTrade && (
        <div
          className="mb-5 rounded-lg px-4 py-3 text-sm"
          style={{
            background: !o.compliance.ok ? "var(--danger-soft)" : o.compliance.warning || o.compliance.expiring.length ? "var(--warn-soft)" : "var(--ok-soft)",
            color: !o.compliance.ok ? "var(--danger)" : o.compliance.warning || o.compliance.expiring.length ? "var(--warn)" : "var(--ok)",
          }}
        >
          <strong>{!o.compliance.ok ? "Not cleared for work" : o.compliance.warning ? "Unchecked" : "Cleared for work"}</strong>
          {o.compliance.reason && ` — ${o.compliance.reason}`}
          {o.compliance.warning && ` — ${o.compliance.warning}`}
          {o.compliance.expired.length > 0 && ` · Expired: ${o.compliance.expired.join(", ")}`}
          {o.compliance.expiring.length > 0 && ` · Expiring soon: ${o.compliance.expiring.join(", ")}`}
          <Link href="/compliance" className="ml-2 underline">
            Compliance
          </Link>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Committed" value={money(o.committed)} hint={`${money(o.open_commitment)} not yet invoiced · ${o.homes} home${o.homes === 1 ? "" : "s"}`} />
        <StatTile
          label="Owed now"
          value={money(o.outstanding)}
          tone={o.overdue ? "danger" : "default"}
          hint={o.overdue ? `${o.overdue} invoice${o.overdue === 1 ? "" : "s"} past terms` : `Terms: ${v.payment_terms_days ?? 30} days`}
        />
        <StatTile
          label="Paid this tax year"
          value={money(o.paid_this_tax_year)}
          hint={`Since ${day(o.tax_year_from)}${isTrade ? ` · CIS ${money(o.cis_this_tax_year)} · retention held ${money(o.retention_held)}` : ""}`}
        />
        <StatTile
          label="Scorecard"
          value={o.score?.overall ?? "—"}
          tone={o.score?.overall != null ? (o.score.overall >= 75 ? "ok" : o.score.overall >= 50 ? "warn" : "danger") : "default"}
          hint={
            o.score?.overall != null
              ? `${o.score.provisional ? "Provisional · " : ""}${o.service_orders_total} warranty call-backs (${o.service_orders_open} open)`
              : "Not enough history yet"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Docs title="Purchase orders" rows={o.recent_pos} href={(r) => `/purchase-orders/${r.id}`} empty="No purchase orders yet." />
          <Docs title="Invoices" rows={o.recent_invoices} href={() => "/invoices"} empty="No invoices yet." />
        </div>
        <div className="space-y-5">
          <Card
            title="Contacts"
            padded={false}
            action={
              <Button variant="ghost" size="sm" onClick={() => setContact("new")}>
                Add
              </Button>
            }
          >
            {o.contacts.length === 0 ? (
              <p className="p-5 text-sm" style={{ color: "var(--fg-subtle)" }}>
                No contacts yet.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {o.contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <div className="font-medium">
                        {c.name} {c.is_primary && <Badge tone="brand">primary</Badge>}
                      </div>
                      <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        {[c.role, c.email, c.phone].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Menu
                      label="⋯"
                      items={[
                        { label: "Edit…", run: () => setContact(c) },
                        ...(!c.is_primary
                          ? [
                              {
                                label: "Make primary",
                                run: async () => {
                                  await toast.promise(api.updateVendorContact(c.id, { is_primary: true }), {
                                    success: `${c.name} is the main contact`,
                                    error: "Not changed",
                                  });
                                  ov.reload();
                                },
                              },
                            ]
                          : []),
                        {
                          label: "Remove",
                          tone: "danger" as const,
                          run: () =>
                            ask({
                              title: `Remove ${c.name}?`,
                              tone: "danger",
                              confirmLabel: "Remove",
                              body: "The trade record keeps its own contact details.",
                              onConfirm: async () => {
                                await toast.promise(api.deleteVendorContact(c.id), { success: "Contact removed", error: "Not removed" });
                                ov.reload();
                              },
                            }),
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Does"
            action={
              <Button variant="ghost" size="sm" onClick={() => setSpecs(true)}>
                Edit
              </Button>
            }
          >
            {o.specialisms.length ? (
              <div className="flex flex-wrap gap-1.5">
                {o.specialisms.map((sp) => (
                  <Badge key={sp.id} tone="neutral">
                    {sp.code} {sp.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
                No specialisms recorded, so this trade won&apos;t show when searching by cost code.
              </p>
            )}
          </Card>

          <Card title="Details">
            <dl className="space-y-2 text-sm">
              {(
                [
                  ["Address", [v.address, v.postcode].filter(Boolean).join(", ") || "—"],
                  ["Email", v.email ?? "—"],
                  ["Phone", v.phone ?? "—"],
                  ["Website", v.website ?? "—"],
                  ["Payment terms", `${v.payment_terms_days ?? 30} days`],
                  ...(isTrade
                    ? ([
                        ["CIS", v.cis_status ? titleCase(v.cis_status) : "Not verified"],
                        ["UTR", v.utr ?? "—"],
                        ["Labour rate", v.labour_rate ? `${money(v.labour_rate, 2)}/hr` : "—"],
                      ] as [string, string][])
                    : []),
                ] as [string, string][]
              ).map(([k, val]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt style={{ color: "var(--fg-muted)" }}>{k}</dt>
                  <dd className="text-right">{val}</dd>
                </div>
              ))}
            </dl>
            {v.notes && (
              <p className="mt-4 whitespace-pre-line text-sm" style={{ color: "var(--fg-muted)" }}>
                {v.notes}
              </p>
            )}
            {v.is_archived && v.archive_reason && (
              <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
                Archived: {v.archive_reason}
              </p>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <TradeForm
          vendor={v}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Trade updated");
            ov.reload();
          }}
        />
      )}
      {contact && (
        <ContactDialog
          vendorId={v.id}
          contact={contact === "new" ? null : contact}
          onClose={() => setContact(null)}
          onDone={() => {
            setContact(null);
            ov.reload();
          }}
        />
      )}
      {specs && (
        <SpecialismsDialog
          vendorId={v.id}
          current={o.specialisms.map((s) => s.id)}
          onClose={() => setSpecs(false)}
          onDone={() => {
            setSpecs(false);
            ov.reload();
          }}
        />
      )}
      {archiving && (
        <ArchiveDialog
          vendorId={v.id}
          name={v.name}
          onClose={() => setArchiving(false)}
          onDone={() => {
            setArchiving(false);
            ov.reload();
          }}
        />
      )}
      {dialog}
    </>
  );
}

function Docs({ title, rows, href, empty }: { title: string; rows: TradeDocRow[]; href: (r: TradeDocRow) => string; empty: string }) {
  return (
    <Card title={title} padded={false}>
      <DataTable
        columns={[
          { key: "no", label: "Number" },
          { key: "home", label: "Home" },
          { key: "status", label: "Status" },
          { key: "date", label: "Date" },
          { key: "total", label: "Total", align: "right" },
        ]}
        empty={empty}
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={href(r)} style={{ color: "var(--brand)" }}>
                {r.number}
              </Link>
            </td>
            <td>{r.job_number ?? "—"}</td>
            <td>
              <StatusBadge status={r.status} />
            </td>
            <td className="text-sm">{day(r.date)}</td>
            <td className="num">{money(r.total)}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

function ContactDialog({
  vendorId,
  contact,
  onClose,
  onDone,
}: {
  vendorId: string;
  contact: VendorContact | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    is_primary: contact?.is_primary ?? false,
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = { name: f.name.trim(), role: f.role || undefined, email: f.email || undefined, phone: f.phone || undefined, is_primary: f.is_primary };
    try {
      if (contact) await api.updateVendorContact(contact.id, { ...body, role: f.role || null, email: f.email || null, phone: f.phone || null });
      else await api.addVendorContact(vendorId, body);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={contact ? `Edit ${contact.name}` : "Add a contact"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={200} />
          </Field>
          <Field label="Role">
            <input className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} maxLength={100} placeholder="Director, QS, site lead…" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={40} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_primary} onChange={(e) => setF({ ...f, is_primary: e.target.checked })} />
          Main contact — the trade record&apos;s contact details follow this person
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SpecialismsDialog({
  vendorId,
  current,
  onClose,
  onDone,
}: {
  vendorId: string;
  current: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const codes = useAsync(() => api.listCostCodes(), []);
  const [picked, setPicked] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    try {
      await api.setVendorSpecialisms(vendorId, picked);
      toast.success("Specialisms saved");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title="What this trade does" onClose={onClose}>
      <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
        The cost codes they can be asked to price. Used when searching trades by specialism.
      </p>
      <div className="flex max-h-[50vh] flex-wrap gap-2 overflow-auto">
        {(codes.data ?? []).map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className="btn btn-ghost btn-sm"
              style={on ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 } : { border: "1px solid var(--border)" }}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
            >
              {on ? "✓ " : ""}
              {c.code} {c.name}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <Button variant="primary" onClick={save}>
          Save {picked.length}
        </Button>
      </div>
    </Modal>
  );
}

function ArchiveDialog({ vendorId, name, onClose, onDone }: { vendorId: string; name: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.archiveVendor(vendorId, reason);
      toast.success(`${name} archived`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive");
    }
  }

  return (
    <Modal open title={`Archive ${name}?`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          They stop appearing in pickers. History is kept. Refused while they still hold open purchase orders.
        </p>
        <Field label="Why">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ceased trading" />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="danger">
            Archive
          </Button>
        </div>
      </form>
    </Modal>
  );
}
