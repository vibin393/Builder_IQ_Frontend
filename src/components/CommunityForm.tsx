"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { ErrorNote, Field, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Community, CommunityInput, CommunityStatus } from "@/types/api";

export const COMMUNITY_STATUSES: { value: CommunityStatus; label: string }[] = [
  { value: "planning", label: "Planning — not on sale" },
  { value: "selling", label: "Selling" },
  { value: "sold_out", label: "Sold out — still building" },
  { value: "closed", label: "Closed — built out" },
];

/** Create a development, or edit one. Used by the list and the detail page. */
export function CommunityForm({
  community,
  open,
  onClose,
  onSaved,
}: {
  community?: Community | null;
  open: boolean;
  onClose: () => void;
  onSaved: (c: Community) => void;
}) {
  const users = useAsync(() => api.listUsers(1, 200), []);
  const editing = !!community;
  const [form, setForm] = useState<Record<string, string>>(() => ({
    code: community?.code ?? "",
    name: community?.name ?? "",
    status: community?.status ?? "selling",
    address: community?.address ?? "",
    city: community?.city ?? "",
    county: community?.county ?? "",
    postcode: community?.postcode ?? "",
    local_authority: community?.local_authority ?? "",
    planned_plots: community?.planned_plots?.toString() ?? "",
    target_sales_per_month: community?.target_sales_per_month ?? "",
    opened_on: community?.opened_on ?? "",
    sales_manager_id: community?.sales_manager_id ?? "",
    site_manager_id: community?.site_manager_id ?? "",
    description: community?.description ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const staff = (users.data?.items ?? []).filter((u) => u.is_active && u.role !== "homeowner" && u.role !== "trade");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const blank = (v: string) => (v.trim() ? v.trim() : null);
    const body: CommunityInput = {
      code: form.code.trim(),
      name: form.name.trim(),
      status: form.status as CommunityStatus,
      address: blank(form.address),
      city: blank(form.city),
      county: blank(form.county),
      postcode: blank(form.postcode),
      local_authority: blank(form.local_authority),
      planned_plots: form.planned_plots ? Number(form.planned_plots) : null,
      target_sales_per_month: blank(form.target_sales_per_month),
      opened_on: blank(form.opened_on),
      sales_manager_id: blank(form.sales_manager_id),
      site_manager_id: blank(form.site_manager_id),
      description: blank(form.description),
    };
    try {
      const saved = editing
        ? await api.updateCommunity(community!.id, body)
        : await api.createCommunity(body as CommunityInput & { code: string; name: string });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the community");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={editing ? `Edit ${community!.name}` : "New community"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={form.code} onChange={set("code")} required maxLength={32} placeholder="ASH" />
          </Field>
          <Field label="Name">
            <input className="input" value={form.name} onChange={set("name")} required maxLength={200} placeholder="Ashwood Park" />
          </Field>
        </div>
        <Field label="Status" hint="Sold out and closed are checked against the plots before they are accepted.">
          <select className="input" value={form.status} onChange={set("status")}>
            {COMMUNITY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Site / sales office address">
          <input className="input" value={form.address} onChange={set("address")} maxLength={300} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Town">
            <input className="input" value={form.city} onChange={set("city")} maxLength={120} placeholder="Wimborne" />
          </Field>
          <Field label="County">
            <input className="input" value={form.county} onChange={set("county")} maxLength={80} placeholder="Dorset" />
          </Field>
          <Field label="Postcode">
            <input className="input" value={form.postcode} onChange={set("postcode")} maxLength={20} placeholder="BH21 1AA" />
          </Field>
        </div>
        <Field label="Local planning authority" hint="Where the consent, its conditions and any S106 sit.">
          <input className="input" value={form.local_authority} onChange={set("local_authority")} maxLength={120} placeholder="Dorset Council" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Consented plots">
            <input className="input" type="number" min={0} value={form.planned_plots} onChange={set("planned_plots")} />
          </Field>
          <Field label="Target sales / month" hint="From the land appraisal.">
            <input className="input" inputMode="decimal" value={form.target_sales_per_month} onChange={set("target_sales_per_month")} />
          </Field>
          <Field label="Opened for sale">
            <input className="input" type="date" value={form.opened_on} onChange={set("opened_on")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sales manager">
            <select className="input" value={form.sales_manager_id} onChange={set("sales_manager_id")}>
              <option value="">—</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Site manager">
            <select className="input" value={form.site_manager_id} onChange={set("site_manager_id")}>
              <option value="">—</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input" rows={3} value={form.description} onChange={set("description")} maxLength={2000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create community"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Stacked bar of a development's plots by sales position. */
export function PlotBar({
  counts,
}: {
  counts: { not_released: number; available: number; held: number; sold: number; closed: number; total: number };
}) {
  const parts: { key: string; n: number; color: string; label: string }[] = [
    { key: "closed", n: counts.closed, color: "var(--fg-muted)", label: "handed over" },
    { key: "sold", n: counts.sold, color: "var(--ok)", label: "sold" },
    { key: "held", n: counts.held, color: "var(--warn)", label: "on hold" },
    { key: "available", n: counts.available, color: "var(--brand)", label: "for sale" },
    { key: "not_released", n: counts.not_released, color: "var(--border)", label: "not released" },
  ];
  if (!counts.total) return <span style={{ color: "var(--fg-subtle)" }}>No plots</span>;
  return (
    <div className="min-w-[10rem]">
      <div className="flex h-2 overflow-hidden rounded-full" style={{ background: "var(--neutral-soft)" }}>
        {parts.map((p) =>
          p.n ? (
            <div key={p.key} title={`${p.n} ${p.label}`} style={{ width: `${(p.n / counts.total) * 100}%`, background: p.color }} />
          ) : null,
        )}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
        {parts
          .filter((p) => p.n)
          .map((p) => `${p.n} ${p.label}`)
          .join(" · ")}
      </div>
    </div>
  );
}
