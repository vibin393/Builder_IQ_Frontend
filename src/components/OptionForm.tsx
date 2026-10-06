"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { ErrorNote, Field, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { BuildOption, OptionCategory, OptionDetail, OptionInput } from "@/types/api";

export const OPTION_CATEGORIES: { value: OptionCategory; label: string }[] = [
  { value: "structural", label: "Structural" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "interior", label: "Interior" },
  { value: "flooring", label: "Flooring" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "heating", label: "Heating & energy" },
  { value: "technology", label: "Technology" },
  { value: "appliance", label: "Appliances" },
  { value: "exterior", label: "Exterior" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
];

export const categoryLabel = (c: OptionCategory) => OPTION_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Create an option, or edit one. Plans it is offered on are chosen here too. */
export function OptionForm({
  option,
  onClose,
  onSaved,
}: {
  option?: OptionDetail | null;
  onClose: () => void;
  onSaved: (o: BuildOption) => void;
}) {
  const plans = useAsync(() => api.listPlans(true), []);
  const editing = !!option;
  const [f, setF] = useState({
    code: option?.code ?? "",
    name: option?.name ?? "",
    category: (option?.category ?? "interior") as OptionCategory,
    price: option ? String(Number(option.price)) : "",
    price_reason: "",
    schedule_days: String(option?.schedule_days ?? 0),
    is_structural: option?.is_structural ?? false,
    max_quantity: String(option?.max_quantity ?? 1),
    unit: option?.unit ?? "",
    supplier_ref: option?.supplier_ref ?? "",
    description: option?.description ?? "",
  });
  const [planIds, setPlanIds] = useState<string[]>(option?.plan_ids ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const priceChanged = editing && f.price !== String(Number(option!.price));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: OptionInput = {
      code: f.code.trim(),
      name: f.name.trim(),
      category: f.category,
      price: f.price || "0",
      schedule_days: Number(f.schedule_days) || 0,
      is_structural: f.is_structural,
      max_quantity: Math.max(1, Number(f.max_quantity) || 1),
      unit: f.unit.trim() || null,
      supplier_ref: f.supplier_ref.trim() || null,
      description: f.description.trim() || null,
    };
    if (priceChanged) body.price_reason = f.price_reason.trim() || undefined;
    try {
      let saved: OptionDetail;
      if (editing) {
        saved = await api.updateOption(option!.id, body);
        const before = [...(option!.plan_ids ?? [])].sort().join();
        if ([...planIds].sort().join() !== before) saved = await api.setOptionPlans(option!.id, planIds);
      } else {
        saved = await api.createOption({ ...(body as OptionInput & { code: string; name: string }), plan_ids: planIds });
      }
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the option");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={editing ? `Edit ${option!.code}` : "New option"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={f.code} onChange={set("code")} required maxLength={32} placeholder="KIT-UP" />
          </Field>
          <Field label="Name">
            <input className="input" value={f.name} onChange={set("name")} required maxLength={200} placeholder="Upgraded kitchen" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select className="input" value={f.category} onChange={set("category")}>
              {OPTION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price to the buyer">
            <input className="input" inputMode="decimal" value={f.price} onChange={set("price")} required placeholder="8500" />
          </Field>
        </div>
        {priceChanged && (
          <Field label="Reason for the price change" hint="Kept on the price history. Selections already made keep their price.">
            <input className="input" value={f.price_reason} onChange={set("price_reason")} maxLength={300} placeholder="Supplier increase" />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Schedule days" hint="Added to the build. Negative saves time.">
            <input className="input" type="number" value={f.schedule_days} onChange={set("schedule_days")} />
          </Field>
          <Field label="Max quantity" hint="1 for a one-off upgrade.">
            <input className="input" type="number" min={1} max={999} value={f.max_quantity} onChange={set("max_quantity")} />
          </Field>
          <Field label="Unit" hint="each, m², room…">
            <input className="input" value={f.unit} onChange={set("unit")} maxLength={20} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Supplier reference">
            <input className="input" value={f.supplier_ref} onChange={set("supplier_ref")} maxLength={64} />
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.is_structural}
              onChange={(e) => setF((prev) => ({ ...prev, is_structural: e.target.checked }))}
            />
            Structural — refused after a home&apos;s structural cut-off
          </label>
        </div>
        <Field
          label="Offered on"
          hint={planIds.length ? `${planIds.length} house type${planIds.length === 1 ? "" : "s"} only` : "Every house type. Tick to restrict."}
        >
          <div className="flex flex-wrap gap-2">
            {(plans.data ?? []).map((p) => {
              const on = planIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={on ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 } : { border: "1px solid var(--border)" }}
                  onClick={() => setPlanIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                >
                  {on ? "✓ " : ""}
                  {p.code} {p.name}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Description" hint="What the buyer sees in the design studio.">
          <textarea className="input" rows={3} value={f.description} onChange={set("description")} maxLength={1000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create option"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
