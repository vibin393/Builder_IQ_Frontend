"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { ErrorNote, Field, LOCALE, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import type { GarageType, HouseType, Plan, PlanInput } from "@/types/api";

export const HOUSE_TYPES: { value: HouseType; label: string }[] = [
  { value: "detached", label: "Detached" },
  { value: "semi_detached", label: "Semi-detached" },
  { value: "terraced", label: "Terraced" },
  { value: "end_terrace", label: "End of terrace" },
  { value: "bungalow", label: "Bungalow" },
  { value: "apartment", label: "Apartment" },
  { value: "maisonette", label: "Maisonette" },
  { value: "coach_house", label: "Coach house" },
];

export const GARAGES: { value: GarageType; label: string }[] = [
  { value: "none", label: "No garage" },
  { value: "single", label: "Single garage" },
  { value: "double", label: "Double garage" },
  { value: "integral", label: "Integral garage" },
  { value: "carport", label: "Carport" },
];

export const houseTypeLabel = (t: HouseType | null) => HOUSE_TYPES.find((h) => h.value === t)?.label ?? null;
export const garageLabel = (g: GarageType | null) => GARAGES.find((x) => x.value === g)?.label ?? null;

/** "172 m² · 1,850 sq ft" — UK buyers are quoted both. */
export function areaText(p: Pick<Plan, "floor_area_sqm" | "square_feet">): string {
  const parts = [];
  if (p.floor_area_sqm) parts.push(`${Number(p.floor_area_sqm).toLocaleString(LOCALE)} m²`);
  if (p.square_feet) parts.push(`${p.square_feet.toLocaleString(LOCALE)} sq ft`);
  return parts.join(" · ") || "—";
}

/** "4 bed · 2 bath (1 en-suite) + WC" */
export function roomsText(p: Pick<Plan, "bedrooms" | "bathrooms" | "en_suites" | "has_cloakroom">): string {
  const parts = [];
  if (p.bedrooms !== null) parts.push(`${p.bedrooms} bed`);
  if (p.bathrooms !== null) {
    const baths = Number(p.bathrooms);
    parts.push(`${baths} bath${p.en_suites ? ` (${p.en_suites} en-suite)` : ""}`);
  }
  let text = parts.join(" · ") || "—";
  if (p.has_cloakroom) text += " + WC";
  return text;
}

/** Create a house type, or edit one. Price changes ask for the reason. */
export function PlanForm({
  plan,
  onClose,
  onSaved,
}: {
  plan?: Plan | null;
  onClose: () => void;
  onSaved: (p: Plan) => void;
}) {
  const editing = !!plan;
  const [f, setF] = useState<Record<string, string>>(() => ({
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    house_type: plan?.house_type ?? "",
    storeys: plan?.storeys?.toString() ?? "",
    floor_area_sqm: plan?.floor_area_sqm ? String(Number(plan.floor_area_sqm)) : "",
    square_feet: plan?.square_feet?.toString() ?? "",
    bedrooms: plan?.bedrooms?.toString() ?? "",
    bathrooms: plan?.bathrooms ? String(Number(plan.bathrooms)) : "",
    en_suites: plan?.en_suites?.toString() ?? "",
    has_cloakroom: plan?.has_cloakroom ? "yes" : "",
    garage: plan?.garage ?? "",
    parking_spaces: plan?.parking_spaces?.toString() ?? "",
    epc_target: plan?.epc_target ?? "",
    base_price: plan ? String(Number(plan.base_price)) : "",
    price_reason: "",
    description: plan?.description ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const priceChanged = editing && f.base_price !== String(Number(plan!.base_price));
  // Area: whichever was touched last wins; the server fills the other.
  const [areaSource, setAreaSource] = useState<"sqm" | "sqft" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const body: PlanInput = {
      code: f.code.trim(),
      name: f.name.trim(),
      house_type: (f.house_type || null) as HouseType | null,
      storeys: num(f.storeys),
      bedrooms: num(f.bedrooms),
      bathrooms: f.bathrooms.trim() || null,
      en_suites: num(f.en_suites),
      has_cloakroom: f.has_cloakroom === "yes",
      garage: (f.garage || null) as GarageType | null,
      parking_spaces: num(f.parking_spaces),
      epc_target: f.epc_target || null,
      base_price: f.base_price || "0",
      description: f.description.trim() || null,
    };
    // Only send the area when it was touched, and only the measure that was typed.
    if (areaSource === "sqm") body.floor_area_sqm = f.floor_area_sqm.trim() || null;
    if (areaSource === "sqft") body.square_feet = num(f.square_feet);
    if (priceChanged) body.price_reason = f.price_reason.trim() || undefined;
    try {
      const saved = editing
        ? await api.updatePlan(plan!.id, body)
        : await api.createPlan(body as PlanInput & { code: string; name: string });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={editing ? `Edit ${plan!.code} ${plan!.name}` : "New house type"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={f.code} onChange={set("code")} required maxLength={32} placeholder="P4" />
          </Field>
          <Field label="Name">
            <input className="input" value={f.name} onChange={set("name")} required maxLength={200} placeholder="The Rowan" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="House type">
            <select className="input" value={f.house_type} onChange={set("house_type")}>
              <option value="">—</option>
              {HOUSE_TYPES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Storeys">
            <input className="input" type="number" min={1} max={10} value={f.storeys} onChange={set("storeys")} />
          </Field>
          <Field label="EPC target">
            <select className="input" value={f.epc_target} onChange={set("epc_target")}>
              <option value="">—</option>
              {"ABCDEFG".split("").map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Floor area (m²)" hint="Gross internal area. Fill either; the other is worked out.">
            <input
              className="input"
              inputMode="decimal"
              value={f.floor_area_sqm}
              onChange={(e) => {
                setAreaSource("sqm");
                setF((prev) => ({ ...prev, floor_area_sqm: e.target.value, square_feet: "" }));
              }}
            />
          </Field>
          <Field label="Floor area (sq ft)">
            <input
              className="input"
              type="number"
              min={0}
              value={f.square_feet}
              onChange={(e) => {
                setAreaSource("sqft");
                setF((prev) => ({ ...prev, square_feet: e.target.value, floor_area_sqm: "" }));
              }}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Bedrooms">
            <input className="input" type="number" min={0} value={f.bedrooms} onChange={set("bedrooms")} />
          </Field>
          <Field label="Bathrooms" hint="En-suites included">
            <input className="input" type="number" min={0} value={f.bathrooms} onChange={set("bathrooms")} />
          </Field>
          <Field label="En-suites">
            <input className="input" type="number" min={0} value={f.en_suites} onChange={set("en_suites")} />
          </Field>
          <Field label="Cloakroom / WC">
            <select className="input" value={f.has_cloakroom} onChange={set("has_cloakroom")}>
              <option value="">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Garage">
            <select className="input" value={f.garage} onChange={set("garage")}>
              <option value="">—</option>
              {GARAGES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parking spaces" hint="Driveway / allocated, garage excluded">
            <input className="input" type="number" min={0} value={f.parking_spaces} onChange={set("parking_spaces")} />
          </Field>
        </div>
        <Field label="Base price" hint="The standard price. A development can set its own for this plan.">
          <input className="input" inputMode="decimal" value={f.base_price} onChange={set("base_price")} required placeholder="389000" />
        </Field>
        {priceChanged && (
          <Field label="Reason for the price change" hint="Kept on the price history. Signed contracts keep their price.">
            <input className="input" value={f.price_reason} onChange={set("price_reason")} maxLength={300} placeholder="Q4 price review" />
          </Field>
        )}
        <Field label="Description" hint="The sales pitch for this house type.">
          <textarea className="input" rows={3} value={f.description} onChange={set("description")} maxLength={2000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
