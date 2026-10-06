export function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-6 shadow-sm"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {title && <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted)" }}>{title}</h2>}
      {children}
    </section>
  );
}
