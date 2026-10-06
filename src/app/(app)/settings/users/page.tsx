"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import { Badge, Card, DataTable, ErrorNote, Field, Loading, Menu, Modal, PageHeader, StatTile, day, titleCase } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { User } from "@/types/api";

/** Grouped the way the two source products divide people: the builder's own
    staff, then the people who work *with* them. External roles never see money. */
const ROLE_GROUPS = [
  { label: "Internal — your staff", roles: ["owner", "admin", "executive", "sales", "purchasing", "accounting", "superintendent", "warranty"] },
  { label: "External — they work with you", roles: ["architect", "trade", "homeowner"] },
];

/** What each role can do, in a line - shown where a role is chosen. */
const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including other owners",
  admin: "Everything except granting or removing owner",
  executive: "Reads everything, changes nothing",
  sales: "Leads, contracts, plot holds, design studio",
  purchasing: "Bids, purchase orders, invoices",
  accounting: "Invoices, payments, ledger export, CIS",
  superintendent: "Schedules, site diary, inspections, punch",
  warranty: "Customer care after handover",
  architect: "Answers RFIs, reviews submittals",
  trade: "Their own POs, schedule and payments — never a budget",
  homeowner: "Their own home and warranty claims",
};

const EXTERNAL = new Set(["architect", "trade", "homeowner"]);
const PAGE = 25;

function ago(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days} days ago`;
  return day(iso);
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState<"true" | "false" | "">("true");
  const [page, setPage] = useState(1);
  const users = useAsync(
    () => api.listUsers(page, PAGE, { search: search.trim() || undefined, role: role || undefined, active: active === "" ? undefined : active === "true" }),
    [page, search, role, active],
  );
  const summary = useAsync(() => api.usersSummary(), []);
  const me = useAsync(() => api.me(), []);
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();
  const s = summary.data;
  const total = users.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const isOwner = me.data?.role === "owner";

  function reload() {
    users.reload();
    summary.reload();
  }

  function toggleActive(u: User) {
    const off = u.is_active;
    ask({
      title: off ? `Disable ${u.full_name}?` : `Re-enable ${u.full_name}?`,
      tone: off ? "danger" : undefined,
      confirmLabel: off ? "Disable" : "Re-enable",
      body: off
        ? "They are signed out and cannot sign back in. Their history stays — records they created still show their name."
        : "They can sign in again with their existing password.",
      onConfirm: async () => {
        try {
          await toast.promise(api.updateUser(u.id, { is_active: !off }), {
            success: off ? `${u.full_name} disabled` : `${u.full_name} re-enabled`,
            error: "Not changed",
          });
        } catch {
          /* the toast carries the rule that refused it */
        }
        reload();
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Staff accounts and portal logins. A trade or homeowner account only ever sees its own work — never a budget or a contract price. Only an owner can grant owner, and nobody can lock themselves out."
        action={
          <Button variant="primary" onClick={() => setEditing("new")}>
            Add user
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active users" value={s?.active ?? "—"} hint={s ? `${s.external} external · ${s.inactive} disabled` : undefined} />
        <StatTile label="Owners" value={s?.owners ?? "—"} tone={s?.owners === 1 ? "warn" : "default"} hint={s?.owners === 1 ? "Only one — add a second so the account is never orphaned" : "Full control"} />
        <StatTile label="Never signed in" value={s?.never_signed_in ?? "—"} tone={s?.never_signed_in ? "warn" : "ok"} hint="Invited, not yet used" />
        <StatTile label="Dormant" value={s?.dormant ?? "—"} tone={s?.dormant ? "danger" : "ok"} hint="Active, no sign-in for 90 days — leavers?" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input"
          style={{ width: "14rem" }}
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input"
          style={{ width: "auto" }}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Every role</option>
          {ROLE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.roles.map((r) => (
                <option key={r} value={r}>
                  {titleCase(r)}
                  {s?.by_role[r] ? ` (${s.by_role[r]})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className="input"
          style={{ width: "auto" }}
          value={active}
          onChange={(e) => {
            setActive(e.target.value as "true" | "false" | "");
            setPage(1);
          }}
        >
          <option value="true">Active</option>
          <option value="false">Disabled</option>
          <option value="">All</option>
        </select>
      </div>

      <Card padded={false}>
        {users.loading ? (
          <Loading />
        ) : users.error ? (
          <div className="p-4">
            <ErrorNote message={users.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Person" },
              { key: "role", label: "Role" },
              { key: "last", label: "Last sign-in" },
              { key: "added", label: "Added", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No users match."
          >
            {(users.data?.items ?? []).map((u) => {
              const self = u.id === me.data?.id;
              const ownerLocked = u.role === "owner" && !isOwner;
              return (
                <tr key={u.id} style={u.is_active ? undefined : { opacity: 0.6 }}>
                  <td>
                    <div className="font-medium">
                      {u.full_name} {self && <Badge tone="brand">you</Badge>}
                    </div>
                    <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
                      {u.email}
                      {u.job_title ? ` · ${u.job_title}` : ""}
                    </div>
                  </td>
                  <td>
                    <Badge tone={EXTERNAL.has(u.role) ? "warn" : u.role === "owner" ? "brand" : "neutral"}>{titleCase(u.role)}</Badge>
                    {!u.is_active && (
                      <span className="ml-1">
                        <Badge tone="neutral">disabled</Badge>
                      </span>
                    )}
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {ROLE_HELP[u.role]}
                    </div>
                  </td>
                  <td className="text-sm" style={{ color: !u.last_login_at ? "var(--warn)" : undefined }}>
                    {ago(u.last_login_at)}
                  </td>
                  <td className="num text-sm">{day(u.created_at)}</td>
                  <td className="num">
                    {!ownerLocked && (
                      <Menu
                        label="⋯"
                        items={[
                          { label: "Edit…", run: () => setEditing(u) },
                          { label: "Set a temporary password…", run: () => setResetting(u) },
                          ...(!self
                            ? [{ label: u.is_active ? "Disable…" : "Re-enable…", tone: u.is_active ? ("danger" as const) : undefined, run: () => toggleActive(u) }]
                            : []),
                        ]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--fg-muted)" }}>
              {total} users · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          self={editing !== "new" && editing.id === me.data?.id}
          canGrantOwner={isOwner}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null);
            toast.success(msg);
            reload();
          }}
        />
      )}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
      {dialog}
    </>
  );
}

function UserDialog({
  user,
  self,
  canGrantOwner,
  onClose,
  onDone,
}: {
  user: User | null;
  self: boolean;
  canGrantOwner: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [f, setF] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "sales",
    job_title: user?.job_title ?? "",
    phone: user?.phone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await api.updateUser(user.id, {
          full_name: f.full_name,
          ...(self ? {} : { role: f.role }),
          job_title: f.job_title || null,
          phone: f.phone || null,
        });
        onDone(`${f.full_name} updated`);
      } else {
        await api.createUser({
          email: f.email,
          full_name: f.full_name,
          password: f.password,
          role: f.role,
          job_title: f.job_title || undefined,
          phone: f.phone || undefined,
        });
        onDone(`${f.full_name} added — share their temporary password with them`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={user ? `Edit ${user.full_name}` : "Add a user"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required minLength={2} maxLength={200} />
          </Field>
          <Field label="Email" hint={user ? "Sign-in email cannot be changed here." : "Trade accounts: the same email as their trade record."}>
            <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required disabled={!!user} />
          </Field>
        </div>
        {!user && (
          <Field label="Temporary password" hint="At least 8 characters. Ask them to change it after signing in.">
            <input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} maxLength={128} />
          </Field>
        )}
        <Field label="Role" hint={self ? "You cannot change your own role." : ROLE_HELP[f.role]}>
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as typeof f.role })} disabled={self}>
            {ROLE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.roles
                  .filter((r) => r !== "owner" || canGrantOwner || f.role === "owner")
                  .map((r) => (
                    <option key={r} value={r}>
                      {titleCase(r)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title">
            <input className="input" value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} maxLength={120} placeholder="Site manager" />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={40} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : user ? "Save" : "Add user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.resetUserPassword(user.id, password);
      toast.success(r.detail, "Give them the temporary password and ask them to change it.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset");
    }
  }

  return (
    <Modal open title={`Temporary password for ${user.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Their current password stops working at once.
        </p>
        <Field label="New temporary password" hint="At least 8 characters.">
          <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} autoFocus />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary">
            Set password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
