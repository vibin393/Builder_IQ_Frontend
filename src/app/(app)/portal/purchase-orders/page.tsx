"use client";

import { useState } from "react";

import {
  Card,
  DataTable,
  ErrorNote,
  Loading,
  PageHeader,
  StatusBadge,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function PortalPurchaseOrders() {
  const pos = useAsync(() => api.portalPurchaseOrders(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.portalAcknowledge(id);
      pos.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My purchase orders"
        subtitle="Work the builder has committed to you. Acknowledge to confirm you have it."
      />

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      <Card padded={false}>
        {pos.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "po", label: "PO" },
              { key: "status", label: "Status" },
              { key: "issued", label: "Issued", align: "right" },
              { key: "total", label: "Amount", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No purchase orders issued to you yet."
          >
            {(pos.data ?? []).map((po) => (
              <tr key={po.id}>
                <td className="font-medium">{po.po_number}</td>
                <td>
                  <StatusBadge status={po.status} />
                </td>
                <td className="num text-sm">{day(po.issued_date)}</td>
                <td className="num">{money(po.total)}</td>
                <td className="num">
                  {po.status === "issued" && (
                    <button className="btn btn-primary btn-sm" onClick={() => acknowledge(po.id)} disabled={busy}>
                      Acknowledge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}
