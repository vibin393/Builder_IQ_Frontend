"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { Badge, Card, DataTable, ErrorNote, Field, Loading, Menu, Modal, PageHeader, StatTile, money, titleCase } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { CostCode, CostType } from "@/types/api";

const TYPES: { value: CostType; label: string }[] = [
  { value: "labour", label: "Labour" },
  { value: "materials", label: "Materials" },
  { value: "subcontract", label: "Subcontract" },
  { value: "plant", label: "Plant" },
  { value: "preliminaries", label: "Preliminaries" },
  { value: "fees", label: "Fees" },
  { value: "other", label: "Other" },
];

const PAGE_SIZE = 25;

export default function CostCodesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const codes = useAsync(
    () => api.searchCostCodes({ search: search.trim() || undefined, page, size: PAGE_SIZE, include_archived: archived }),
    [search, page, archived],
  );
  const stats = useAsync(() => api.costCodeStats(), []);
  const summary = useAsync(() => api.costCodeSummary(), []);
  const [editing, setEditing] = useState<CostCode | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [archiving, setArchiving] = useState<CostCode | null>(null);
  const toast = useToast();
  const s = summary.data;
  const total = codes.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function reload() {
    codes.reload();
    stats.reload();
    summary.reload();
  }

  async function run(p: Promise<unknown>, done: string) {
    try {
      await toast.promise(p, { success: done, error: "Not changed" });
    } catch {
      /* toast */
    }
    reload();
  }

  return (
    <>
      <PageHeader
        title="Cost codes"
        subtitle="The shared key across estimating, purchasing, job costing and the ledger. Each code shows what is budgeted, committed and spent against it on every home — and nothing still in use can be archived."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button variant="primary" onClick={() => setEditing("new")}>
              New cost code
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active codes" value={s?.active ?? "—"} hint={s ? `${s.inactive} inactive · ${s.archived} archived` : undefined} />
        <StatTile
          label="Over budget"
          value={s?.over_budget ?? "—"}
          tone={s?.over_budget ? "danger" : "ok"}
          hint="Committed or spent above the revised budget, across homes"
        />
        <StatTile
          label="No nominal code"
          value={s?.unmapped ?? "—"}
          tone={s?.unmapped ? "warn" : "ok"}
          hint="Posts to the default cost account — set on Accounting"
        />
        <StatTile label="Never used" value={s?.unused ?? "—"} hint="Nothing budgeted, bought or priced against them" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input"
          style={{ width: "16rem" }}
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Include archived
        </label>
        {s && (
          <span className="ml-auto flex flex-wrap gap-1.5 text-xs">
            {Object.entries(s.by_type).map(([t, n]) => (
              <Badge key={t} tone="neutral">
                {t === "unset" ? "No type" : titleCase(t)} {n}
              </Badge>
            ))}
          </span>
        )}
      </div>

      <Card padded={false}>
        {codes.loading ? (
          <Loading />
        ) : codes.error ? (
          <div className="p-4">
            <ErrorNote message={codes.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "Code" },
              { key: "type", label: "Type" },
              { key: "gl", label: "Nominal" },
              { key: "budget", label: "Budget", align: "right" },
              { key: "committed", label: "Committed", align: "right" },
              { key: "actual", label: "Actual", align: "right" },
              { key: "remaining", label: "Remaining", align: "right" },
              { key: "used", label: "Used on", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty={search ? "No codes match." : "No cost codes yet. Add one, or import a list."}
          >
            {(codes.data?.items ?? []).map((c) => {
              const st = stats.data?.[c.id];
              const remaining = st ? Number(st.remaining) : null;
              return (
                <tr key={c.id} style={c.is_archived || !c.is_active ? { opacity: 0.6 } : undefined}>
                  <td>
                    <span className="font-medium tnum">{c.code}</span> {c.name}
                    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {c.division ?? "No division"}
                      {!c.is_active && <Badge tone="neutral">inactive</Badge>}
                      {c.is_archived && <Badge tone="neutral">archived</Badge>}
                    </div>
                  </td>
                  <td>{c.cost_type ? <Badge tone="neutral">{titleCase(c.cost_type)}</Badge> : <span style={{ color: "var(--fg-subtle)" }}>—</span>}</td>
                  <td className="tnum" style={{ color: c.gl_account ? undefined : "var(--warn)" }}>
                    {c.gl_account ?? "unmapped"}
                  </td>
                  <td className="num">{st && Number(st.budget_revised) ? money(st.budget_revised) : "—"}</td>
                  <td className="num">{st && Number(st.committed) ? money(st.committed) : "—"}</td>
                  <td className="num">{st && Number(st.actual) ? money(st.actual) : "—"}</td>
                  <td className="num" style={{ color: remaining !== null && remaining < 0 ? "var(--danger)" : undefined }}>
                    {st && (Number(st.budget_revised) || Number(st.committed)) ? money(st.remaining) : "—"}
                  </td>
                  <td className="num text-xs" style={{ color: "var(--fg-muted)" }}>
                    {st
                      ? [st.homes && `${st.homes} home${st.homes === 1 ? "" : "s"}`, st.plans && `${st.plans} plan${st.plans === 1 ? "" : "s"}`, st.trades && `${st.trades} trade${st.trades === 1 ? "" : "s"}`]
                          .filter(Boolean)
                          .join(" · ") || "—"
                      : "—"}
                  </td>
                  <td className="num">
                    <Menu
                      label="⋯"
                      items={[
                        { label: "Edit…", run: () => setEditing(c) },
                        ...(c.is_archived
                          ? [{ label: "Restore", run: () => run(api.restoreCostCode(c.id), `${c.code} restored`) }]
                          : [
                              {
                                label: c.is_active ? "Mark inactive" : "Mark active",
                                run: () => run(api.updateCostCode(c.id, { is_active: !c.is_active }), c.is_active ? `${c.code} inactive` : `${c.code} active`),
                              },
                              { label: "Archive…", tone: "danger" as const, run: () => setArchiving(c) },
                            ]),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--fg-muted)" }}>
              {total} codes · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing && (
        <CodeDialog
          code={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null);
            toast.success(msg);
            reload();
          }}
        />
      )}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            reload();
          }}
        />
      )}
      {archiving && (
        <ArchiveDialog
          code={archiving}
          onClose={() => setArchiving(null)}
          onDone={() => {
            setArchiving(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function CodeDialog({ code, onClose, onDone }: { code: CostCode | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [f, setF] = useState({
    code: code?.code ?? "",
    name: code?.name ?? "",
    division: code?.division ?? "",
    cost_type: code?.cost_type ?? "",
    gl_account: code?.gl_account ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      code: f.code.trim(),
      name: f.name.trim(),
      division: f.division.trim() || null,
      cost_type: (f.cost_type || null) as CostType | null,
      gl_account: f.gl_account.trim() || null,
    };
    try {
      if (code) {
        await api.updateCostCode(code.id, body);
        onDone(`${body.code} updated`);
      } else {
        await api.createCostCode({ ...body, division: body.division ?? undefined });
        onDone(`${body.code} created`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={code ? `Edit ${code.code}` : "New cost code"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {code && (
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            The code itself can be corrected — everything reconciles through it, so a typo here is the most expensive one in
            the system.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required maxLength={32} placeholder="06-100" />
          </Field>
          <Field label="Name">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={200} placeholder="Framing labour" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Division">
            <input className="input" value={f.division} onChange={(e) => setF({ ...f, division: e.target.value })} maxLength={100} placeholder="Superstructure" />
          </Field>
          <Field label="Cost type">
            <select className="input" value={f.cost_type} onChange={(e) => setF({ ...f, cost_type: e.target.value })}>
              <option value="">—</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nominal code" hint="In the accounting package">
            <input className="input" value={f.gl_account} onChange={(e) => setF({ ...f, gl_account: e.target.value })} maxLength={20} placeholder="5120" />
          </Field>
        </div>
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

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const types = new Set(TYPES.map((t) => t.value));

  // code, name, division, type, nominal — comma or tab separated, one per line.
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^code\b/i.test(l))
    .map((l) => l.split(l.includes("\t") ? "\t" : ",").map((c) => c.trim()))
    .filter((c) => c[0] && c[1])
    .map(([code, name, division, type, gl]) => ({
      code,
      name,
      division: division || undefined,
      cost_type: types.has(type?.toLowerCase() as CostType) ? (type.toLowerCase() as CostType) : undefined,
      gl_account: gl || undefined,
    }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.importCostCodes(rows);
      toast.success(`${r.created} code${r.created === 1 ? "" : "s"} imported`, r.skipped.length ? `${r.skipped.length} already existed and were skipped` : undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Import cost codes" onClose={onClose}>
      <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
        Paste from a spreadsheet: <strong>code, name, division, type, nominal</strong> — one code per line. Only code and
        name are required. Codes that already exist are skipped, so it is safe to run twice.
      </p>
      <textarea
        className="input font-mono text-xs"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"11-100, Groundworks, Substructure, subcontract, 5110\n11-200, Scaffold hire, Preliminaries, plant"}
      />
      <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
        {rows.length} code{rows.length === 1 ? "" : "s"} read
      </p>
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <Button variant="primary" disabled={!rows.length || busy} onClick={submit}>
          {busy ? "Importing…" : `Import ${rows.length}`}
        </Button>
      </div>
    </Modal>
  );
}

function ArchiveDialog({ code, onClose, onDone }: { code: CostCode; onClose: () => void; onDone: () => void }) {
  const usage = useAsync(() => api.costCodeUsage(code.id), [code.id]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const blocked = (usage.data ?? []).filter((u) => u.where !== "Trades that do it");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.archiveCostCode(code.id, reason);
      toast.success(`${code.code} archived`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive");
    }
  }

  return (
    <Modal open title={`Archive ${code.code} ${code.name}?`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {usage.loading ? (
          <Loading />
        ) : blocked.length ? (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <strong>Still in use:</strong> {blocked.map((u) => `${u.count} ${u.where.toLowerCase()}`).join(", ")}. Move that work to
            another code, or mark this one inactive instead.
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            Nothing is priced, committed or spent against it. It will stop appearing in pickers; history is kept.
          </p>
        )}
        <Field label="Why">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Merged into 06-100" />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="danger" disabled={blocked.length > 0}>
            Archive
          </Button>
        </div>
      </form>
    </Modal>
  );
}
