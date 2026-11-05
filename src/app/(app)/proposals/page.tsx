"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import { DataTable, ErrorNote, Field, Loading, Modal, PageHeader, StatusBadge, money } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function ProposalsPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const proposals = useAsync(() => api.listLeadProposals(), []);
  const leads = useAsync(() => api.listLeads({ size: 200 } as never).then((p) => p.items), []);

  const [form, setForm] = useState({ lead_id: "", title: "", amount: "", valid_until: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create() {
    if (!form.lead_id || !form.title) return toast.error("Pick a lead and give the proposal a title");
    try {
      await api.createLeadProposal({
        lead_id: form.lead_id,
        title: form.title,
        amount: form.amount ? Number(form.amount) : 0,
        valid_until: form.valid_until || null,
      });
      toast.success("Proposal created");
      setOpen(false);
      setForm({ lead_id: "", title: "", amount: "", valid_until: "" });
      proposals.reload();
    } catch (e) {
      toast.error("Could not create", e instanceof Error ? e.message : undefined);
    }
  }

  async function send(id: string) {
    try { await api.sendLeadProposal(id); toast.success("Marked as sent"); proposals.reload(); }
    catch (e) { toast.error("Could not send", e instanceof Error ? e.message : undefined); }
  }

  function remove(id: string, title: string) {
    confirm({
      title: `Delete "${title}"?`,
      body: "This removes the proposal permanently.",
      onConfirm: async () => {
        try { await api.deleteLeadProposal(id); toast.success("Deleted"); proposals.reload(); }
        catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); }
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Lead proposals"
        subtitle="Client-facing quotes sent to leads before a home is sold — the step between an enquiry and a contract."
        action={<Button variant="primary" onClick={() => setOpen(true)}>New proposal</Button>}
      />
      {proposals.error && <ErrorNote message={proposals.error} />}
      {proposals.loading ? (
        <Loading label="Loading proposals" />
      ) : (
        <DataTable
          columns={[
            { key: "lead", label: "Lead" },
            { key: "title", label: "Proposal" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "valid", label: "Valid until" },
            { key: "status", label: "Status" },
            { key: "actions", label: "" },
          ]}
          empty="No proposals yet. Create one to quote a lead before they sign."
        >
          {(proposals.data ?? []).map((p) => (
            <tr key={p.id}>
              <td className="text-sm font-medium">{p.lead_name}</td>
              <td className="text-sm">{p.title}</td>
              <td className="num text-sm">{money(p.total || p.amount)}</td>
              <td className="text-sm">{p.valid_until || "—"}</td>
              <td><StatusBadge status={p.status} /></td>
              <td className="num">
                <div className="flex justify-end gap-1.5">
                  {p.status === "draft" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => send(p.id)}>Mark sent</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(p.id, p.title)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {open && (
        <Modal open title="New proposal" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3">
            <Field label="Lead">
              <select className="input" value={form.lead_id} onChange={set("lead_id")}>
                <option value="">Select a lead…</option>
                {(leads.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. ADU & addition — budget proposal" />
            </Field>
            <Field label="Amount">
              <input className="input" value={form.amount} onChange={set("amount")} placeholder="0.00" inputMode="decimal" />
            </Field>
            <Field label="Valid until">
              <input className="input" type="date" value={form.valid_until} onChange={set("valid_until")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={create}>Create proposal</Button>
            </div>
          </div>
        </Modal>
      )}
      {dialog}
    </>
  );
}
