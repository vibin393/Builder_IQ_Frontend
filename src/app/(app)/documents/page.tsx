"use client";

import { useState } from "react";

import { Donut, SERIES } from "@/components/charts";
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
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { DocumentCategory, DocumentRecord } from "@/types/api";

const CATEGORIES: DocumentCategory[] = [
  "plan",
  "specification",
  "contract",
  "addendum",
  "purchase_order",
  "change_order",
  "permit",
  "inspection",
  "photo",
  "warranty",
  "insurance",
  "lien_waiver",
  "other",
];

/** Categories that carry legal or financial weight if they go missing. */
const CRITICAL: DocumentCategory[] = ["contract", "permit", "lien_waiver", "warranty", "insurance"];

function expiryTone(d: DocumentRecord) {
  if (d.is_expired) return "danger" as const;
  if (d.is_expiring) return "warn" as const;
  return "neutral" as const;
}

export default function DocumentsPage() {
  const [jobFilter, setJobFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [search, setSearch] = useState("");

  const documents = useAsync(
    () =>
      api.listDocuments({
        job_id: jobFilter || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        expiring_only: expiringOnly || undefined,
        search: search.trim() || undefined,
      }),
    [jobFilter, categoryFilter, statusFilter, expiringOnly, search],
  );
  const summary = useAsync(() => api.documentsSummary(jobFilter || undefined), [jobFilter]);
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);

  const [open, setOpen] = useState(false);
  const [superseding, setSuperseding] = useState<DocumentRecord | null>(null);
  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const job = byId(jobs.data);
  const rows = documents.data ?? [];
  const s = summary.data;

  const byCategory = s
    ? Object.entries(s.by_category).sort((a, b) => b[1] - a[1])
    : [];

  function refresh() {
    documents.reload();
    summary.reload();
  }
  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  async function create(form: FormData) {
    setError(null);
    try {
      await api.createDocument({
        name: String(form.get("name")),
        category: String(form.get("category")),
        storage_key: String(form.get("storage_key")),
        reference: String(form.get("reference") || "") || undefined,
        issued_on: String(form.get("issued_on") || "") || undefined,
        expires_on: String(form.get("expires_on") || "") || undefined,
        job_id: String(form.get("job_id") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      setOpen(false);
      refresh();
    } catch (err) {
      fail(err, "Could not register the document");
    }
  }

  async function supersede(form: FormData) {
    if (!superseding) return;
    setError(null);
    try {
      const next = await api.supersedeDocument(superseding.id, {
        storage_key: String(form.get("storage_key")),
        reference: String(form.get("reference") || "") || undefined,
        issued_on: String(form.get("issued_on") || "") || undefined,
        expires_on: String(form.get("expires_on") || "") || undefined,
      });
      setNote(`${superseding.name} is now revision ${next.revision}. The prior version is kept as the record of what was in force.`);
      setSuperseding(null);
      refresh();
    } catch (err) {
      fail(err, "Could not supersede the document");
    }
  }

  async function saveEdit(form: FormData) {
    if (!editing) return;
    setError(null);
    try {
      await api.updateDocument(editing.id, {
        name: String(form.get("name")),
        category: String(form.get("category")),
        reference: String(form.get("reference") || "") || undefined,
        issued_on: String(form.get("issued_on") || "") || undefined,
        expires_on: String(form.get("expires_on") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      setEditing(null);
      refresh();
    } catch (err) {
      fail(err, "Could not save");
    }
  }

  async function archive(d: DocumentRecord) {
    setError(null);
    try {
      if (d.status === "archived") await api.restoreDocument(d.id);
      else await api.archiveDocument(d.id);
      refresh();
    } catch (err) {
      fail(err, "Could not update the document");
    }
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="The register of what exists and where it lives. Contracts, permits and lien waivers are the ones that cost money when they cannot be found — and the ones with expiry dates worth chasing before they lapse."
        action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Register a document
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Documents" value={s?.total ?? "—"} hint="Live on the register" />
        <StatTile
          label="Contracts, permits & waivers"
          value={s?.critical ?? "—"}
          tone={s?.critical ? "ok" : "warn"}
          hint="The ones with legal weight"
        />
        <StatTile
          label="Expiring soon"
          value={s?.expiring_soon ?? "—"}
          tone={s?.expiring_soon ? "warn" : "ok"}
          hint="Lapse within 30 days"
        />
        <StatTile
          label="Expired"
          value={s?.expired ?? "—"}
          tone={s?.expired ? "danger" : "ok"}
          hint="Lapsed — renew now"
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

      <div className="mb-6 grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card
            title="Register"
            padded={false}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input"
                  style={{ width: "12rem" }}
                  placeholder="Search name or reference…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search documents"
                />
                <select
                  className="input"
                  style={{ width: "auto" }}
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                  aria-label="Filter by home"
                >
                  <option value="">All homes</option>
                  {(jobs.data ?? []).map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.job_number}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ width: "auto" }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="">Any category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {titleCase(c)}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ width: "auto" }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="">Live only</option>
                  {["active", "draft", "superseded", "archived"].map((st) => (
                    <option key={st} value={st}>
                      {titleCase(st)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={expiringOnly}
                    onChange={(e) => setExpiringOnly(e.target.checked)}
                  />
                  Expiring
                </label>
              </div>
            }
          >
            {documents.loading ? (
              <Loading />
            ) : (
              <DataTable
                columns={[
                  { key: "name", label: "Document" },
                  { key: "cat", label: "Category" },
                  { key: "home", label: "Home" },
                  { key: "rev", label: "Rev", align: "right" },
                  { key: "expiry", label: "Expires" },
                  { key: "status", label: "Status" },
                  { key: "act", label: "" },
                ]}
                empty="Nothing registered yet."
              >
                {rows.map((d) => (
                  <tr key={d.id} style={d.is_expired ? { background: "var(--danger-soft)" } : undefined}>
                    <td>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs" style={{ color: "var(--fg-subtle)", wordBreak: "break-all" }}>
                        {d.reference ? `${d.reference} · ` : ""}
                        {d.storage_key}
                      </div>
                    </td>
                    <td>
                      <Badge tone={d.is_critical ? "brand" : "neutral"}>{titleCase(d.category)}</Badge>
                    </td>
                    <td>{d.job_id ? (job.get(d.job_id)?.job_number ?? "—") : "—"}</td>
                    <td className="num tnum">{d.revision}</td>
                    <td>
                      {d.expires_on ? (
                        <Badge tone={expiryTone(d)}>
                          {day(d.expires_on)}
                          {d.is_expired
                            ? " · lapsed"
                            : d.days_to_expiry != null
                              ? ` · ${d.days_to_expiry}d`
                              : ""}
                        </Badge>
                      ) : (
                        <span style={{ color: "var(--fg-subtle)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {d.status !== "superseded" && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(d)}>
                            Edit
                          </button>
                        )}
                        {(d.status === "active" || d.status === "draft") && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setSuperseding(d)}>
                            Supersede
                          </button>
                        )}
                        {d.status !== "superseded" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: d.status === "archived" ? undefined : "var(--danger)" }}
                            onClick={() => void archive(d)}
                          >
                            {d.status === "archived" ? "Restore" : "Archive"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <Card title="By category">
          {byCategory.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
              Nothing to chart yet.
            </p>
          ) : (
            <Donut
              centerValue={String(s?.total ?? 0)}
              centerLabel="documents"
              slices={byCategory.slice(0, 3).map(([label, value], i) => ({
                label: titleCase(label),
                value,
                color: [SERIES.one, SERIES.two, SERIES.three][i],
              }))}
            />
          )}
        </Card>
      </div>

      {/* --- modals --- */}

      <Modal open={open} title="Register a document" onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(new FormData(e.currentTarget));
          }}
        >
          <Field label="Name">
            <input name="name" className="input" required placeholder="Signed purchase agreement" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select name="category" className="input" required defaultValue="contract">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Home">
              <select name="job_id" className="input" defaultValue="">
                <option value="">Not home-specific</option>
                {(jobs.data ?? []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_number}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Reference" hint="Permit / contract no.">
              <input name="reference" className="input" placeholder="BP-2026-778" />
            </Field>
            <Field label="Issued">
              <input name="issued_on" type="date" className="input" />
            </Field>
            <Field label="Expires" hint="Permits, insurance, warranties.">
              <input name="expires_on" type="date" className="input" />
            </Field>
          </div>
          <Field
            label="Storage key"
            hint="Where the file actually lives. There is no object store wired up yet, so this records the location rather than holding the file."
          >
            <input
              name="storage_key"
              className="input"
              required
              placeholder="sharepoint://contracts/J00001-agreement.pdf"
            />
          </Field>
          <Field label="Notes">
            <input name="notes" className="input" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Register
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={superseding !== null}
        title={`Supersede ${superseding?.name ?? ""}`}
        onClose={() => setSuperseding(null)}
      >
        {superseding && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void supersede(new FormData(e.currentTarget));
            }}
          >
            <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              Registers revision {superseding.revision + 1}. The current version is kept and marked
              superseded, so what was in force at any point can still be produced. Category and
              home carry forward.
            </p>
            <Field label="Storage key of the new version">
              <input name="storage_key" className="input" required placeholder="sharepoint://…-v2.pdf" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Reference">
                <input name="reference" className="input" defaultValue={superseding.reference ?? ""} />
              </Field>
              <Field label="Issued">
                <input name="issued_on" type="date" className="input" />
              </Field>
              <Field label="Expires">
                <input name="expires_on" type="date" className="input" />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setSuperseding(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Register new version
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={editing !== null} title={`Edit ${editing?.name ?? ""}`} onClose={() => setEditing(null)}>
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit(new FormData(e.currentTarget));
            }}
          >
            <Field label="Name">
              <input name="name" className="input" required defaultValue={editing.name} />
            </Field>
            <Field label="Category">
              <select name="category" className="input" defaultValue={editing.category}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Reference">
                <input name="reference" className="input" defaultValue={editing.reference ?? ""} />
              </Field>
              <Field label="Issued">
                <input name="issued_on" type="date" className="input" defaultValue={editing.issued_on ?? ""} />
              </Field>
              <Field label="Expires">
                <input name="expires_on" type="date" className="input" defaultValue={editing.expires_on ?? ""} />
              </Field>
            </div>
            <Field label="Notes">
              <input name="notes" className="input" defaultValue={editing.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
