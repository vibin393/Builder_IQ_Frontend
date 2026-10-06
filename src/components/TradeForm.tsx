"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { ErrorNote, Field, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import type { CISStatus, Vendor, VendorType } from "@/types/api";

/** Create a trade or supplier, or edit one. */
export function TradeForm({
  vendor,
  onClose,
  onSaved,
}: {
  vendor?: Vendor | null;
  onClose: () => void;
  onSaved: (v: Vendor) => void;
}) {
  const editing = !!vendor;
  const [f, setF] = useState<Record<string, string>>(() => ({
    code: vendor?.code ?? "",
    name: vendor?.name ?? "",
    vendor_type: vendor?.vendor_type ?? "trade",
    email: vendor?.email ?? "",
    phone: vendor?.phone ?? "",
    address: vendor?.address ?? "",
    postcode: vendor?.postcode ?? "",
    company_number: vendor?.company_number ?? "",
    vat_number: vendor?.vat_number ?? "",
    website: vendor?.website ?? "",
    cis_status: vendor?.cis_status ?? "",
    utr: vendor?.utr ?? "",
    payment_terms_days: vendor?.payment_terms_days?.toString() ?? "",
    labour_rate: vendor?.labour_rate ? String(Number(vendor.labour_rate)) : "",
    notes: vendor?.notes ?? "",
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
    const body = {
      code: f.code.trim(),
      name: f.name.trim(),
      vendor_type: f.vendor_type as VendorType,
      email: blank(f.email),
      phone: blank(f.phone),
      address: blank(f.address),
      postcode: blank(f.postcode)?.toUpperCase() ?? null,
      company_number: blank(f.company_number),
      vat_number: blank(f.vat_number),
      website: blank(f.website),
      cis_status: (f.cis_status || null) as CISStatus | null,
      utr: blank(f.utr),
      payment_terms_days: f.payment_terms_days ? Number(f.payment_terms_days) : null,
      labour_rate: blank(f.labour_rate),
      notes: blank(f.notes),
    };
    try {
      const saved = editing ? await api.updateVendor(vendor!.id, body) : await api.createVendor(body as Partial<Vendor> & { code: string; name: string });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const isTrade = f.vendor_type !== "supplier";

  return (
    <Modal open title={editing ? `Edit ${vendor!.name}` : "New trade or supplier"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={f.code} onChange={set("code")} required maxLength={32} placeholder="SPARK" />
          </Field>
          <Field label="Name">
            <input className="input" value={f.name} onChange={set("name")} required maxLength={200} placeholder="Sparks Electrical Ltd" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <select className="input" value={f.vendor_type} onChange={set("vendor_type")}>
              <option value="trade">Trade (subcontractor)</option>
              <option value="supplier">Supplier</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Email" hint="Links a portal login to this trade.">
            <input className="input" type="email" value={f.email} onChange={set("email")} />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={set("phone")} maxLength={40} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Address">
            <input className="input" value={f.address} onChange={set("address")} maxLength={300} />
          </Field>
          <Field label="Postcode">
            <input className="input" value={f.postcode} onChange={set("postcode")} maxLength={20} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Company number" hint="Companies House">
            <input className="input" value={f.company_number} onChange={set("company_number")} maxLength={8} />
          </Field>
          <Field label="VAT number">
            <input className="input" value={f.vat_number} onChange={set("vat_number")} maxLength={20} placeholder="GB123456789" />
          </Field>
          <Field label="Website">
            <input className="input" value={f.website} onChange={set("website")} maxLength={200} />
          </Field>
        </div>
        {isTrade && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CIS status" hint="From HMRC verification. Leave blank until verified.">
              <select className="input" value={f.cis_status} onChange={set("cis_status")}>
                <option value="">Not verified yet</option>
                <option value="gross">Gross — 0%</option>
                <option value="net">Net — 20%</option>
                <option value="unverified">Unverified — 30%</option>
              </select>
            </Field>
            <Field label="UTR" hint="Unique Taxpayer Reference">
              <input className="input" value={f.utr} onChange={set("utr")} maxLength={20} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment terms (days)" hint="Sets the due date on their invoices. Blank = 30.">
            <input className="input" type="number" min={0} max={120} value={f.payment_terms_days} onChange={set("payment_terms_days")} />
          </Field>
          {isTrade && (
            <Field label="Labour rate ($/hr)" hint="Default on timecards.">
              <input className="input" inputMode="decimal" value={f.labour_rate} onChange={set("labour_rate")} />
            </Field>
          )}
        </div>
        <Field label="Notes">
          <textarea className="input" rows={2} value={f.notes} onChange={set("notes")} maxLength={2000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
