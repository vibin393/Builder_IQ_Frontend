"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { Icons } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { ErrorNote, Field, Modal, titleCase } from "@/components/ui";
import { api } from "@/lib/api";
import type { User } from "@/types/api";

/* ---------------------------------------------------------------- avatar */

export function Avatar({ user, size = 30 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false);
  const src = user.avatar_url ? apiOrigin() + user.avatar_url : null;

  // A replaced picture keeps the same element, so reset the error on change.
  useEffect(() => setBroken(false), [user.avatar_url]);

  if (src && !broken) {
    return (
      <span className="avatar" style={{ width: size, height: size }}>
        {/* Plain <img>: the file is served by the API on another origin, and the
            Next image optimiser would need that host allow-listed for no gain
            on a 256px square. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }}
        />
      </span>
    );
  }

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(user.full_name)}
    </span>
  );
}

function apiOrigin(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8400";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* ----------------------------------------------------- sidebar foot menu */

export function ProfileButton({
  user,
  collapsed,
  onUpdated,
  onSignOut,
}: {
  user: User;
  collapsed: boolean;
  onUpdated: (u: User) => void;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="profile-wrap" ref={ref}>
      <button
        className="profile-btn"
        onClick={() => setMenuOpen((o) => !o)}
        title={collapsed ? user.full_name : "Account"}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <Avatar user={user} size={29} />
        <span className="foot-text">
          <span className="foot-name">{user.full_name}</span>
          <span className="foot-role">{user.job_title || user.role.replaceAll("_", " ")}</span>
        </span>
        <span className="profile-caret">
          <Icons.chevron size={13} />
        </span>
      </button>

      {menuOpen && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-head">
            <Avatar user={user} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="truncate text-xs" style={{ color: "var(--fg-subtle)" }}>
                {user.email}
              </p>
              <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-wider" style={{ color: "var(--brand)" }}>
                {titleCase(user.role)}
              </p>
            </div>
          </div>

          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
            }}
          >
            <Icons.users size={15} />
            Edit profile
          </button>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPasswordOpen(true);
            }}
          >
            <Icons.warranty size={15} />
            Change password
          </button>

          <div className="profile-menu-sep" />

          <button className="menu-item menu-item-danger" role="menuitem" onClick={onSignOut}>
            <Icons.signOut size={15} />
            Sign out
          </button>
        </div>
      )}

      <EditProfile
        open={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onUpdated={onUpdated}
      />
      <ChangePassword open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------ edit modal */

function EditProfile({
  open,
  user,
  onClose,
  onUpdated,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onUpdated: (u: User) => void;
}) {
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: user.full_name,
    job_title: user.job_title ?? "",
    phone: user.phone ?? "",
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever it is reopened, so a cancel does not linger.
  useEffect(() => {
    if (open) {
      setForm({
        full_name: user.full_name,
        job_title: user.job_title ?? "",
        phone: user.phone ?? "",
      });
      setPreview(null);
      setError(null);
    }
  }, [open, user]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function pickFile(file: File) {
    setError(null);
    // Show it immediately; the round trip can take a moment on a big photo.
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const updated = await api.uploadAvatar(file);
      onUpdated(updated);
      toast.success("Photo updated");
      setPreview(null);
    } catch (err) {
      setPreview(null);
      const message = err instanceof Error ? err.message : "Could not upload that image";
      setError(message);
      toast.error("Photo not updated", message);
    } finally {
      setUploading(false);
    }
  }

  function askRemove() {
    ask({
      title: "Remove your photo?",
      tone: "danger",
      confirmLabel: "Remove",
      body: "Your initials will be shown instead. You can upload a new one at any time.",
      onConfirm: async () => {
        const updated = await api.removeAvatar();
        onUpdated(updated);
        toast.success("Photo removed");
      },
    });
  }

  async function save() {
    setError(null);
    try {
      const updated = await api.updateProfile({
        full_name: form.full_name,
        job_title: form.job_title || undefined,
        phone: form.phone || undefined,
      });
      onUpdated(updated);
      toast.success("Profile saved");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      setError(message);
      throw err;
    }
  }

  return (
    <>
      <Modal open={open} title="Edit profile" onClose={onClose}>
        <div className="space-y-5">
          {/* --- picture --- */}
          <div className="avatar-editor">
            <button
              className="avatar-drop"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile photo"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="avatar-preview" />
              ) : (
                <Avatar user={user} size={76} />
              )}
              <span className="avatar-overlay">
                {uploading ? <span className="spin-dot" /> : <Icons.design size={18} />}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Profile photo</p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                PNG, JPEG, WEBP or GIF, under 4 MB. It is centre-cropped to a square and
                resized to 256px.
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" icon="design" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {user.avatar_url ? "Replace" : "Upload"}
                </Button>
                {user.avatar_url && (
                  <Button size="sm" variant="danger" onClick={askRemove} disabled={uploading}>
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border)" }} />

          {/* --- details --- */}
          <Field label="Full name">
            <input className="input" value={form.full_name} onChange={set("full_name")} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <input className="input" value={form.job_title} onChange={set("job_title")} placeholder="Site superintendent" />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={set("phone")} />
            </Field>
          </div>

          <Field label="Email" hint="Ask an administrator to change your email or role.">
            <input className="input" value={user.email} disabled readOnly />
          </Field>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" loadingText="Saving…" onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>
      {dialog}
    </>
  );
}

/* -------------------------------------------------------- password modal */

function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  const strength = scorePassword(next);

  async function save() {
    setError(null);
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      throw new Error("mismatch");
    }
    try {
      await api.changePassword(current, next);
      toast.success("Password changed");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not change the password";
      setError(message);
      throw err;
    }
  }

  return (
    <Modal open={open} title="Change password" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Current password">
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <Field label="New password" hint="At least 8 characters.">
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {next && (
          <div className="strength">
            <div className="strength-track">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="strength-seg"
                  style={{
                    background: i < strength.score ? strength.color : "var(--surface-3)",
                  }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}

        <Field label="Confirm new password">
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loadingText="Changing…"
            onClick={save}
            disabled={!current || next.length < 8 || !confirm}
          >
            Change password
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Rough strength meter. Guidance for the user, not a gate — the server validates. */
function scorePassword(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "var(--fg-subtle)" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "var(--danger)" };
  if (score === 2) return { score: 2, label: "Fair", color: "var(--warn)" };
  if (score === 3) return { score: 3, label: "Good", color: "var(--series-1)" };
  return { score: 4, label: "Strong", color: "var(--ok)" };
}
