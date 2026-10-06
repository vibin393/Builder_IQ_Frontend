"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { Card, DataTable, ErrorNote, Field, Loading, Modal, PageHeader } from "@/components/ui";

export interface CrudField {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: "text" | "number" | "date";
  options?: { value: string; label: string }[];
  hint?: string;
}

/**
 * The setup screens (cost codes, trades, communities, plans) are all the same shape:
 * a table plus a create form. This renders that shape so each page stays a few lines.
 */
export function SimpleCrud<T>({
  title,
  subtitle,
  createLabel,
  columns,
  rows,
  loading,
  error,
  fields,
  onCreate,
  renderRow,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  createLabel: string;
  columns: { key: string; label: string; align?: "right" }[];
  rows: T[];
  loading: boolean;
  error: string | null;
  fields: CrudField[];
  onCreate: (values: Record<string, string>) => Promise<void>;
  renderRow: (row: T) => ReactNode;
  empty?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await onCreate(values);
      setValues({});
      setOpen(false);
      toast.success("Saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      setFormError(message);
      throw err; // keeps the Button spinner honest about the failure
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            {createLabel}
          </Button>
        }
      />

      {children}

      <Card padded={false}>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorNote message={error} />
          </div>
        ) : (
          <DataTable columns={columns} empty={empty}>
            {rows.map((row) => renderRow(row))}
          </DataTable>
        )}
      </Card>

      <Modal open={open} title={createLabel} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((f) => (
            <Field key={f.name} label={f.label} hint={f.hint}>
              {f.options ? (
                <select
                  className="input"
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  required={f.required}
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type={f.type ?? "text"}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  required={f.required}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              )}
            </Field>
          ))}
          {formError && <ErrorNote message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loadingText="Saving…" onClick={submit}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
