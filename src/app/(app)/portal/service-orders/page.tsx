"use client";

import { Card, DataTable, Loading, PageHeader, StatusBadge, day } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function PortalServiceOrders() {
  const orders = useAsync(() => api.portalServiceOrders(), []);

  return (
    <>
      <PageHeader title="Service orders" subtitle="Warranty work assigned to you." />

      <Card padded={false}>
        {orders.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "inst", label: "Work" },
              { key: "status", label: "Status" },
              { key: "sched", label: "Scheduled", align: "right" },
              { key: "done", label: "Completed", align: "right" },
            ]}
            empty="No service orders assigned to you."
          >
            {(orders.data ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.instructions ?? "Warranty work"}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td className="num text-sm">{day(o.scheduled_date)}</td>
                <td className="num text-sm">{day(o.completed_date)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}
