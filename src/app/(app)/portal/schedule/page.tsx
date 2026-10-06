"use client";

import { useState } from "react";

import { Card, DataTable, Loading, PageHeader, StatusBadge, day } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function PortalSchedule() {
  const [days, setDays] = useState(14);
  const tasks = useAsync(() => api.portalSchedule(days), [days]);

  return (
    <>
      <PageHeader
        title="My schedule"
        subtitle="Which lots you are on, and when."
        action={
          <select className="input max-w-[10rem]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        }
      />

      <Card padded={false}>
        {tasks.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "task", label: "Task" },
              { key: "status", label: "Status" },
              { key: "start", label: "Start", align: "right" },
              { key: "finish", label: "Finish", align: "right" },
            ]}
            empty="Nothing scheduled for you in this window."
          >
            {(tasks.data ?? []).map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td className="num text-sm">{day(t.scheduled_start)}</td>
                <td className="num text-sm">{day(t.scheduled_finish)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}
