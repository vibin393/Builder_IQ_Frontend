"use client";

import Link from "next/link";

import { Card, ErrorNote, Loading, PageHeader, StatTile } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function PortalHome() {
  const me = useAsync(() => api.portalMe(), []);

  if (me.loading) return <Loading label="Loading your work" />;
  if (me.error) return <ErrorNote message={me.error} />;
  if (!me.data) return null;

  return (
    <>
      <PageHeader title={me.data.vendor_name} subtitle={`Trade code ${me.data.vendor_code}`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Open purchase orders" value={me.data.open_purchase_orders} />
        <StatTile label="Upcoming tasks" value={me.data.upcoming_tasks} />
        <StatTile label="Open service orders" value={me.data.open_service_orders} />
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <Link href="/portal/purchase-orders" className="btn btn-primary">
            My purchase orders
          </Link>
          <Link href="/portal/schedule" className="btn btn-ghost">
            My schedule
          </Link>
          <Link href="/portal/service-orders" className="btn btn-ghost">
            Service orders
          </Link>
        </div>
        <p className="mt-4 text-sm" style={{ color: "var(--fg-muted)" }}>
          You can see the jobs you are assigned to, the dates you are needed, and the purchase
          orders issued to you. Builder financials are not visible from this account.
        </p>
      </Card>
    </>
  );
}
