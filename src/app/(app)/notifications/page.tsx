"use client";

import Link from "next/link";

import { Card, EmptyState, ErrorNote, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

type Item = { when: string | null; icon: string; text: string; status?: string; href: string };

export default function NotificationsPage() {
  const leads = useAsync(() => api.listLeads({ size: 200 } as never).then((p) => p.items), []);
  const jobs = useAsync(() => api.listJobs({ size: 200 } as never).then((p) => p.items), []);
  const pos = useAsync(() => api.listPurchaseOrders({}), []);

  const loading = leads.loading || jobs.loading || pos.loading;
  const items: Item[] = [];
  (pos.data ?? []).forEach((p) =>
    items.push({ when: p.issued_date || p.required_by || null, icon: "🧾", text: `Purchase order ${p.po_number}`, status: p.status, href: "/purchase-orders" }),
  );
  (leads.data ?? []).forEach((l) =>
    items.push({ when: l.next_follow_up || l.projected_sales_date || l.last_contacted_on || null, icon: "👤", text: `Lead · ${l.full_name}`, status: l.status, href: `/leads/${l.id}` }),
  );
  (jobs.data ?? []).forEach((j) =>
    items.push({ when: j.start_date || null, icon: "🏠", text: `Home · ${j.elevation || j.job_number}`, status: j.status, href: `/jobs/${j.id}` }),
  );
  items.sort((a, b) => (b.when || "").localeCompare(a.when || ""));

  return (
    <>
      <PageHeader title="Notifications" subtitle="A chronological record of activity across sales, homes and purchasing." />
      {(leads.error || jobs.error || pos.error) && <ErrorNote message={leads.error || jobs.error || pos.error || ""} />}
      {loading ? (
        <Loading label="Loading activity" />
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card>
          <ul style={{ display: "flex", flexDirection: "column" }}>
            {items.map((it, i) => (
              <li
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <span style={{ fontSize: 18 }}>{it.icon}</span>
                <Link href={it.href} className="flex-1 text-sm font-medium hover:underline">{it.text}</Link>
                {it.status && <StatusBadge status={it.status} />}
                <span className="text-xs" style={{ color: "var(--fg-subtle)", minWidth: 90, textAlign: "right" }}>{it.when || "—"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
