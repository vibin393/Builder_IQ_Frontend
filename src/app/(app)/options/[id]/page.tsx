"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { OptionForm, categoryLabel } from "@/components/OptionForm";
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
  Tabs,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { OptionCostLine, OptionDetail } from "@/types/api";

const TABS = ["Cost lines", "Chosen on", "Price history", "Availability"] as const;
type Tab = (typeof TABS)[number];

export default function OptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const option = useAsync(() => api.getOption(id), [id]);
  const [tab, setTab] = useState<Tab>("Cost lines");
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  const o = option.data;
  const st = o?.stats;
  const pct = st?.margin_pct ? Number(st.margin_pct) : null;

  if (option.error) return <ErrorNote message={option.error} />;

  function archiveOrRestore() {
    if (!o) return;
    if (!o.is_active) {
      toast
        .promise(api.restoreOption(o.id), { success: `${o.code} offered again`, error: "Not restored" })
        .then(() => option.reload())
        .catch(() => undefined);
      return;
    }
    ask({
      title: `Archive ${o.code}?`,
      tone: "danger",
      confirmLabel: "Archive",
      body: "It stops being offered. Homes that already chose it keep it, and those selections can still be confirmed or reversed.",
      onConfirm: async () => {
        await toast.promise(api.archiveOption(o.id), { success: `${o.code} archived`, error: "Not archived" });
        option.reload();
      },
    });
  }

  return (
    <>
      <PageHeader
        title={o ? `${o.code} — ${o.name}` : "Option"}
        subtitle={o ? [categoryLabel(o.category), o.description].filter(Boolean).join(" · ") : undefined}
        action={
          o && (
            <div className="flex items-center gap-2">
              {o.is_structural && <Badge tone="warn">Structural</Badge>}
              {!o.is_active && <Badge tone="neutral">Archived</Badge>}
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Menu
                label="⋯"
                items={[
                  { label: "Copy as a new option…", run: () => setCopying(true) },
                  { label: o.is_active ? "Archive…" : "Offer again", tone: o.is_active ? "danger" : undefined, run: archiveOrRestore },
                ]}
              />
            </div>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Price"
          value={money(o?.price)}
          hint={o && o.max_quantity > 1 ? `Per ${o.unit ?? "unit"}, up to ${o.max_quantity}` : undefined}
        />
        <StatTile
          label="Cost"
          value={money(o?.total_cost)}
          tone={o && Number(o.price) && !o.cost_lines.length ? "danger" : "default"}
          hint={o ? (o.cost_lines.length ? `${o.cost_lines.length} cost code${o.cost_lines.length === 1 ? "" : "s"}` : "No cost lines: a sale won't move the budget") : undefined}
        />
        <StatTile
          label="Margin"
          value={money(st?.margin)}
          tone={pct !== null && pct < 20 ? "danger" : "ok"}
          hint={pct !== null ? `${pct.toFixed(1)}%` : undefined}
        />
        <StatTile
          label="Chosen"
          value={st?.confirmed ?? "—"}
          hint={
            st
              ? `${money(st.revenue)} revenue${st.attach_rate_pct ? ` · on ${st.attach_rate_pct}% of homes` : ""}${st.pending ? ` · ${st.pending} pending` : ""}`
              : undefined
          }
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Cost lines" && o && <CostLines option={o} onChange={option.reload} />}
      {tab === "Chosen on" && <ChosenOn optionId={id} />}
      {tab === "Price history" && <PriceHistory optionId={id} />}
      {tab === "Availability" && o && <Availability option={o} />}

      {editing && o && (
        <OptionForm
          option={o}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Option updated");
            option.reload();
          }}
        />
      )}
      {copying && o && (
        <CopyOption
          option={o}
          onClose={() => setCopying(false)}
          onDone={(newId) => {
            setCopying(false);
            router.push(`/options/${newId}`);
          }}
        />
      )}
      {dialog}
    </>
  );
}

function CostLines({ option, onChange }: { option: OptionDetail; onChange: () => void }) {
  const codes = useAsync(() => api.listCostCodes(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const code = byId(codes.data);
  const vendor = byId(vendors.data);
  const [editing, setEditing] = useState<OptionCostLine | "new" | null>(null);
  const toast = useToast();
  const total = option.cost_lines.reduce((s, l) => s + Number(l.amount), 0);

  async function remove(l: OptionCostLine) {
    try {
      await toast.promise(api.deleteOptionCostLine(l.id), { success: "Cost line removed", error: "Not removed" });
    } catch {
      /* toast */
    }
    onChange();
  }

  return (
    <Card
      title="What choosing it does to the budget"
      padded={false}
      action={
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          Add cost line
        </Button>
      }
    >
      <DataTable
        columns={[
          { key: "code", label: "Cost code" },
          { key: "trade", label: "Trade" },
          { key: "amount", label: `Amount${option.max_quantity > 1 ? " (each)" : ""}`, align: "right" },
          { key: "act", label: "", align: "right" },
        ]}
        empty="No cost lines. Confirming this option would raise the contract price and leave the budget untouched."
      >
        {option.cost_lines.map((l) => (
          <tr key={l.id}>
            <td>
              <div className="font-medium">{code.get(l.cost_code_id)?.code ?? "—"}</div>
              <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                {code.get(l.cost_code_id)?.name}
                {l.description ? ` · ${l.description}` : ""}
              </div>
            </td>
            <td style={{ color: "var(--fg-muted)" }}>{l.vendor_id ? vendor.get(l.vendor_id)?.name ?? "—" : "—"}</td>
            <td className="num" style={{ color: Number(l.amount) < 0 ? "var(--ok)" : undefined }}>
              {money(l.amount)}
            </td>
            <td className="num">
              <Menu
                label="⋯"
                items={[
                  { label: "Edit…", run: () => setEditing(l) },
                  { label: "Remove", tone: "danger", run: () => remove(l) },
                ]}
              />
            </td>
          </tr>
        ))}
        {option.cost_lines.length > 0 && (
          <tr style={{ borderTop: "2px solid var(--border)" }}>
            <td colSpan={2} className="font-semibold">
              Total cost
            </td>
            <td className="num font-semibold">{money(total)}</td>
            <td />
          </tr>
        )}
      </DataTable>
      <p className="px-5 pb-4 text-xs" style={{ color: "var(--fg-subtle)" }}>
        A selection snapshots these lines when it is made. Editing them changes the next selection only — and reversing a
        confirmed one takes back exactly what it put on.
      </p>
      {editing && (
        <CostLineDialog
          optionId={option.id}
          line={editing === "new" ? null : editing}
          used={new Set(option.cost_lines.map((l) => l.cost_code_id))}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function CostLineDialog({
  optionId,
  line,
  used,
  onClose,
  onDone,
}: {
  optionId: string;
  line: OptionCostLine | null;
  used: Set<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const codes = useAsync(() => api.listCostCodes(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const [costCodeId, setCostCodeId] = useState(line?.cost_code_id ?? "");
  const [amount, setAmount] = useState(line ? String(Number(line.amount)) : "");
  const [vendorId, setVendorId] = useState(line?.vendor_id ?? "");
  const [description, setDescription] = useState(line?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (line) await api.updateOptionCostLine(line.id, { amount, vendor_id: vendorId || null, description: description || null });
      else
        await api.addOptionCostLine(optionId, {
          cost_code_id: costCodeId,
          amount,
          vendor_id: vendorId || undefined,
          description: description || undefined,
        });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={line ? "Edit cost line" : "Add a cost line"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Cost code">
          <select className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} required disabled={!!line}>
            <option value="">Select…</option>
            {(codes.data ?? [])
              .filter((c) => c.id === line?.cost_code_id || !used.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" hint="Negative for a credit, e.g. a standard item removed.">
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Trade">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">—</option>
              {(vendors.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </Field>
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

function ChosenOn({ optionId }: { optionId: string }) {
  const rows = useAsync(() => api.optionSelections(optionId), [optionId]);
  return (
    <Card title="Homes that chose it" padded={false}>
      {rows.loading ? (
        <Loading />
      ) : (
        <DataTable
          columns={[
            { key: "home", label: "Home" },
            { key: "status", label: "Status" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "price", label: "Price then", align: "right" },
            { key: "cost", label: "Cost then", align: "right" },
            { key: "date", label: "Chosen", align: "right" },
          ]}
          empty="Not chosen on any home yet."
        >
          {(rows.data ?? []).map((r) => (
            <tr key={r.selection_id}>
              <td>
                <Link href={`/jobs/${r.job_id}`} style={{ color: "var(--brand)" }}>
                  {r.job_number}
                </Link>
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td className="num">{r.quantity}</td>
              <td className="num">{money(r.price_at_selection)}</td>
              <td className="num">{money(r.cost_at_selection)}</td>
              <td className="num text-sm">{day(r.selected_date)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

function PriceHistory({ optionId }: { optionId: string }) {
  const history = useAsync(() => api.optionPriceHistory(optionId), [optionId]);
  const users = useAsync(() => api.listUsers(1, 200), []);
  const who = byId(users.data?.items);
  return (
    <Card title="Price history" padded={false}>
      {history.loading ? (
        <Loading />
      ) : (
        <DataTable
          columns={[
            { key: "when", label: "Changed" },
            { key: "by", label: "By" },
            { key: "from", label: "From", align: "right" },
            { key: "to", label: "To", align: "right" },
            { key: "why", label: "Reason" },
          ]}
          empty="The price has not changed."
        >
          {(history.data ?? []).map((h) => (
            <tr key={h.id}>
              <td className="text-sm">{day(h.created_at)}</td>
              <td className="text-sm">{h.changed_by_id ? who.get(h.changed_by_id)?.full_name ?? "—" : "—"}</td>
              <td className="num">{money(h.old_price)}</td>
              <td className="num">{money(h.new_price)}</td>
              <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                {h.reason ?? "—"}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

function Availability({ option }: { option: OptionDetail }) {
  const plans = useAsync(() => api.listPlans(), []);
  const offered = new Set(option.plan_ids);
  return (
    <Card title="Offered on">
      {option.plan_ids.length === 0 ? (
        <p className="text-sm">Every house type. Edit the option to restrict it.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(plans.data ?? [])
            .filter((p) => offered.has(p.id))
            .map((p) => (
              <Link key={p.id} href={`/plans/${p.id}`} className="rounded-lg px-3 py-1.5 text-sm" style={{ background: "var(--brand-soft)", color: "var(--brand-fg)" }}>
                {p.code} {p.name}
              </Link>
            ))}
        </div>
      )}
      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt style={{ color: "var(--fg-muted)" }}>Schedule effect</dt>
          <dd>{option.schedule_days ? `${option.schedule_days > 0 ? "+" : ""}${option.schedule_days} days` : "None"}</dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--fg-muted)" }}>Quantity</dt>
          <dd>{option.max_quantity > 1 ? `Up to ${option.max_quantity}${option.unit ? ` ${option.unit}` : ""}` : "Once per home"}</dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--fg-muted)" }}>Structural</dt>
          <dd>{option.is_structural ? "Yes — refused after the home's structural cut-off" : "No"}</dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--fg-muted)" }}>Supplier reference</dt>
          <dd>{option.supplier_ref ?? "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}

function CopyOption({ option, onClose, onDone }: { option: OptionDetail; onClose: () => void; onDone: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(`${option.name} (variant)`);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const copy = await api.copyOption(option.id, { code, name });
      onDone(copy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy");
    }
  }

  return (
    <Modal open title={`Copy ${option.code}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="New code">
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={32} />
          </Field>
          <Field label="New name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary">
            Copy option
          </Button>
        </div>
      </form>
    </Modal>
  );
}
