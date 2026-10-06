"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { ErrorNote, Field, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { LandPhaseStatus, LandProject, LandProjectInput, PlanningStatus } from "@/types/api";

export const LAND_STATUS: { value: LandPhaseStatus; label: string }[] = [
  { value: "planning", label: "Appraisal" },
  { value: "entitlement", label: "Securing consent" },
  { value: "development", label: "Infrastructure works" },
  { value: "complete", label: "Complete" },
  { value: "on_hold", label: "On hold" },
];

export const PLANNING: { value: PlanningStatus; label: string }[] = [
  { value: "not_submitted", label: "Not submitted" },
  { value: "submitted", label: "Application submitted" },
  { value: "outline", label: "Outline consent" },
  { value: "reserved_matters", label: "Reserved matters approved" },
  { value: "full", label: "Full permission" },
  { value: "refused", label: "Refused" },
  { value: "appeal", label: "At appeal" },
];

export const landStatusLabel = (s: LandPhaseStatus) => LAND_STATUS.find((x) => x.value === s)?.label ?? s;
export const planningLabel = (s: PlanningStatus) => PLANNING.find((x) => x.value === s)?.label ?? s;

/** Create a land project, or edit one - the appraisal, the site, and planning. */
export function LandForm({ project, onClose, onSaved }: { project?: LandProject | null; onClose: () => void; onSaved: (p: LandProject) => void }) {
  const communities = useAsync(() => api.listCommunities(), []);
  const editing = !!project;
  const [f, setF] = useState<Record<string, string>>(() => ({
    code: project?.code ?? "",
    name: project?.name ?? "",
    community_id: project?.community_id ?? "",
    site_area_ha: project?.site_area_ha ? String(Number(project.site_area_ha)) : "",
    planned_lots: project?.planned_lots?.toString() ?? "",
    acquisition_cost: project ? String(Number(project.acquisition_cost)) : "",
    gdv: project?.gdv ? String(Number(project.gdv)) : "",
    build_cost_estimate: project?.build_cost_estimate ? String(Number(project.build_cost_estimate)) : "",
    purchased_on: project?.purchased_on ?? "",
    projected_completion: project?.projected_completion ?? "",
    local_authority: project?.local_authority ?? "",
    planning_ref: project?.planning_ref ?? "",
    planning_status: project?.planning_status ?? "not_submitted",
    planning_approved_on: project?.planning_approved_on ?? "",
    planning_expires_on: project?.planning_expires_on ?? "",
    notes: project?.notes ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const blank = (v: string) => (v.trim() ? v.trim() : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: LandProjectInput = {
      code: f.code.trim(),
      name: f.name.trim(),
      community_id: blank(f.community_id),
      site_area_ha: blank(f.site_area_ha),
      planned_lots: f.planned_lots ? Number(f.planned_lots) : null,
      acquisition_cost: f.acquisition_cost || "0",
      gdv: blank(f.gdv),
      build_cost_estimate: blank(f.build_cost_estimate),
      purchased_on: blank(f.purchased_on),
      projected_completion: blank(f.projected_completion),
      local_authority: blank(f.local_authority),
      planning_ref: blank(f.planning_ref),
      notes: blank(f.notes),
    };
    if (editing) {
      body.planning_status = f.planning_status as PlanningStatus;
      body.planning_approved_on = blank(f.planning_approved_on);
      body.planning_expires_on = blank(f.planning_expires_on);
    }
    try {
      const saved = editing ? await api.updateLandProject(project!.id, body) : await api.createLandProject(body as LandProjectInput & { code: string; name: string });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={editing ? `Edit ${project!.code}` : "New land project"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={f.code} onChange={set("code")} required maxLength={32} placeholder="ASH-P1" />
          </Field>
          <Field label="Name">
            <input className="input" value={f.name} onChange={set("name")} required maxLength={200} placeholder="Ashwood Park, land north of Mill Lane" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Community" hint="Where delivered plots go.">
            <select className="input" value={f.community_id} onChange={set("community_id")}>
              <option value="">Not linked yet</option>
              {(communities.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Site area (ha)">
            <input className="input" inputMode="decimal" value={f.site_area_ha} onChange={set("site_area_ha")} />
          </Field>
          <Field label="Planned plots">
            <input className="input" type="number" min={0} value={f.planned_lots} onChange={set("planned_lots")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Land cost">
            <input className="input" inputMode="decimal" value={f.acquisition_cost} onChange={set("acquisition_cost")} />
          </Field>
          <Field label="GDV" hint="What the homes should sell for">
            <input className="input" inputMode="decimal" value={f.gdv} onChange={set("gdv")} />
          </Field>
          <Field label="Build cost estimate">
            <input className="input" inputMode="decimal" value={f.build_cost_estimate} onChange={set("build_cost_estimate")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Land purchased">
            <input className="input" type="date" value={f.purchased_on} onChange={set("purchased_on")} />
          </Field>
          <Field label="Projected completion">
            <input className="input" type="date" value={f.projected_completion} onChange={set("projected_completion")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Local planning authority">
            <input className="input" value={f.local_authority} onChange={set("local_authority")} maxLength={120} placeholder="Dorset Council" />
          </Field>
          <Field label="Planning reference">
            <input className="input" value={f.planning_ref} onChange={set("planning_ref")} maxLength={64} placeholder="P/FUL/2026/01234" />
          </Field>
        </div>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Planning status">
              <select className="input" value={f.planning_status} onChange={set("planning_status")}>
                {PLANNING.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Approved on">
              <input className="input" type="date" value={f.planning_approved_on} onChange={set("planning_approved_on")} />
            </Field>
            <Field label="Lapses on" hint="Blank: three years from approval">
              <input className="input" type="date" value={f.planning_expires_on} onChange={set("planning_expires_on")} />
            </Field>
          </div>
        )}
        <Field label="Notes">
          <textarea className="input" rows={2} value={f.notes} onChange={set("notes")} maxLength={2000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
