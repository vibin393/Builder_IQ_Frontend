"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/feedback";
import { TradeForm } from "@/components/TradeForm";
import { useToast } from "@/components/Toast";
import { Badge, Card, DataTable, ErrorNote, Loading, PageHeader, StatTile, money, titleCase } from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { CISStatus, TradeRow } from "@/types/api";

/** HMRC's three outcomes, and the share of labour each withholds. */
const CIS_OPTIONS: { value: CISStatus; label: string }[] = [
  { value: "gross", label: "Gross — 0%" },
  { value: "net", label: "Net — 20%" },
  { value: "unverified", label: "Unverified — 30%" },
];

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [costCodeId, setCostCodeId] = useState("");
  const [archived, setArchived] = useState(false);
  const [view, setView] = useState<"all" | "trade" | "supplier" | "attention">("all");
  const trades = useAsync(
    () =>
      api.tradesDirectory({
        include_archived: archived,
        cost_code_id: costCodeId || undefined,
        search: search.trim() || undefined,
      }),
    [archived, costCodeId, search],
  );
  const summary = useAsync(() => api.tradesSummary(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const code = byId(codes.data);
  const s = summary.data;

  const needsAttention = (t: TradeRow) =>
    t.compliant === false || (t.vendor_type !== "supplier" && !t.cis_status) || t.overdue > 0;
  const rows = (trades.data ?? []).filter((t) =>
    view === "all"
      ? true
      : view === "attention"
        ? needsAttention(t)
        : view === "trade"
          ? t.vendor_type !== "supplier"
          : t.vendor_type === "supplier",
  );

  async function setCis(t: TradeRow, value: CISStatus | null) {
    try {
      await toast.promise(api.updateVendor(t.id, { cis_status: value }), { success: `${t.name} updated`, error: "Not updated" });
    } catch {
      /* toast */
    }
    trades.reload();
    summary.reload();
  }

  return (
    <>
      <PageHeader
        title="Trades and suppliers"
        subtitle="Everyone the builder pays: whether they are cleared to work, what is committed to them, what they are owed, and what they do. A trade's contact email is what links their portal login to this record."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New trade
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active" value={s?.active ?? "—"} hint={s ? `${s.trades} trades · ${s.suppliers} suppliers · ${s.archived} archived` : undefined} />
        <StatTile
          label="Not cleared to work"
          value={s?.not_compliant ?? "—"}
          tone={s?.not_compliant ? "danger" : "ok"}
          hint="Prequalification rejected, lapsed or out of date"
        />
        <StatTile
          label="CIS not verified"
          value={s?.cis_unverified ?? "—"}
          tone={s?.cis_unverified ? "warn" : "ok"}
          hint="Verify with HMRC before the first payment"
        />
        <StatTile
          label="Owed to trades"
          value={<AnimatedNumber value={Number(s?.outstanding ?? 0)} format={(v) => money(v)} />}
          tone={s?.overdue_invoices ? "danger" : "default"}
          hint={
            s
              ? `${s.overdue_invoices} invoice${s.overdue_invoices === 1 ? "" : "s"} past terms · ${money(s.open_commitment)} still committed`
              : undefined
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["trade", "Trades"],
            ["supplier", "Suppliers"],
            ["attention", "Needs attention"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            className="btn btn-ghost btn-sm"
            onClick={() => setView(v)}
            style={
              view === v
                ? { background: v === "attention" ? "var(--warn-soft)" : "var(--brand-soft)", color: v === "attention" ? "var(--warn)" : "var(--brand-fg)" }
                : {}
            }
          >
            {label}
          </button>
        ))}
        <input className="input" style={{ width: "13rem" }} placeholder="Search name, code, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)}>
          <option value="">Any specialism</option>
          {(codes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              Does {c.code} {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />{" "}
          Include archived
        </label>
      </div>

      <Card padded={false}>
        {trades.loading ? (
          <Loading />
        ) : trades.error ? (
          <div className="p-4">
            <ErrorNote message={trades.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Trade" },
              { key: "does", label: "Does" },
              { key: "contact", label: "Contact" },
              { key: "clear", label: "Cleared" },
              { key: "cis", label: "CIS" },
              { key: "committed", label: "Committed", align: "right" },
              { key: "owed", label: "Owed", align: "right" },
            ]}
            empty={costCodeId ? "Nobody is recorded as doing that. Add it as a specialism on a trade." : "No trades match."}
          >
            {rows.map((t) => (
              <tr key={t.id} style={t.is_archived ? { opacity: 0.6 } : undefined}>
                <td>
                  <Link href={`/vendors/${t.id}`} className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
                    {t.name}
                  </Link>
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {t.code} · {titleCase(t.vendor_type)}
                    {t.is_archived && <Badge tone="neutral">archived</Badge>}
                  </div>
                </td>
                <td className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {t.specialism_ids.length
                    ? t.specialism_ids
                        .map((id) => code.get(id)?.code)
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(", ") + (t.specialism_ids.length > 3 ? ` +${t.specialism_ids.length - 3}` : "")
                    : "—"}
                </td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {t.contact_name ?? "—"}
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {t.email ?? t.phone ?? ""}
                  </div>
                </td>
                <td>
                  {t.compliant === null ? (
                    <span style={{ color: "var(--fg-subtle)" }}>n/a</span>
                  ) : t.compliant ? (
                    <Badge tone={t.compliance_note ? "warn" : "ok"}>{t.compliance_note ? "Unchecked" : "Cleared"}</Badge>
                  ) : (
                    <Badge tone="danger">Blocked</Badge>
                  )}
                  {t.compliance_note && (
                    <div className="max-w-[12rem] text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {t.compliance_note}
                    </div>
                  )}
                </td>
                <td>
                  {t.vendor_type === "supplier" ? (
                    <span style={{ color: "var(--fg-subtle)" }}>n/a</span>
                  ) : (
                    <select
                      className="input"
                      style={{ width: "auto", ...(t.cis_status ? {} : { borderColor: "var(--warn)" }) }}
                      value={t.cis_status ?? ""}
                      onChange={(e) => setCis(t, (e.target.value || null) as CISStatus | null)}
                      aria-label={`CIS status for ${t.name}`}
                    >
                      <option value="">Not verified</option>
                      {CIS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="num">{Number(t.open_commitment) ? money(t.open_commitment) : "—"}</td>
                <td className="num">
                  {Number(t.outstanding) ? money(t.outstanding) : "—"}
                  {t.overdue > 0 && (
                    <div className="text-xs" style={{ color: "var(--danger)" }}>
                      {t.overdue} past terms
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {open && (
        <TradeForm
          onClose={() => setOpen(false)}
          onSaved={(v) => {
            setOpen(false);
            toast.success(`${v.name} added`);
            trades.reload();
            summary.reload();
          }}
        />
      )}
    </>
  );
}
