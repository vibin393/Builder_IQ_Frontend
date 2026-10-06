"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Icons } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { HouseBuilder } from "@/components/Preloader";
import { ErrorNote, Field } from "@/components/ui";
import { api, tokenStore } from "@/lib/api";

type Mode = "login" | "register";

/** Rotating proof points on the brand panel. */
const HIGHLIGHTS = [
  {
    icon: "homes" as const,
    title: "One record per home",
    body: "Lead, contract, selections, budget, schedule and warranty all hang off the same lot.",
  },
  {
    icon: "accounting" as const,
    title: "Budget, committed, actual",
    body: "Per cost code, always derived. A report can never disagree with the records beneath it.",
  },
  {
    icon: "vendors" as const,
    title: "Trades see only their work",
    body: "Their purchase orders and dates, never your budget or the buyer's price.",
  },
  {
    icon: "warranty" as const,
    title: "Callbacks traced to the trade",
    body: "The report that changes who you buy from next season.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({
    company_name: "",
    full_name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  // The panel cycles slowly — fast enough to feel alive, slow enough to read.
  useEffect(() => {
    const id = window.setInterval(() => setSlide((s) => (s + 1) % HIGHLIGHTS.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setError(null);
    try {
      const tokens =
        mode === "login"
          ? await api.login(form.email, form.password)
          : await api.register(form);
      tokenStore.set(tokens);
      const me = await api.me();
      router.push(
        me.role === "trade" ? "/portal" : me.role === "homeowner" ? "/my-home" : "/dashboard",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      throw err; // keeps the button spinner honest
    }
  }

  return (
    <main className="auth">
      {/* ------------------------------------------------------------ form */}
      <section className="auth-form-side">
        <div className="auth-form">
          <div className="auth-logo">
            <Logo size={40} subtitle="Builder platform" />
          </div>

          <div key={mode} className="auth-heading">
            <h1>{mode === "login" ? "Welcome back" : "Create your organisation"}</h1>
            <p>
              {mode === "login"
                ? "Sign in to pick up where the build left off."
                : "You will be the owner account for this builder."}
            </p>
          </div>

          <form
            className="auth-fields"
            onSubmit={(e) => {
              e.preventDefault();
              submit().catch(() => {});
            }}
          >
            {mode === "register" && (
              <>
                <div className="auth-field" style={{ animationDelay: "40ms" }}>
                  <Field label="Company name">
                    <input
                      className="input"
                      value={form.company_name}
                      onChange={set("company_name")}
                      required
                      placeholder="Corman Leigh Homes"
                    />
                  </Field>
                </div>
                <div className="auth-field" style={{ animationDelay: "80ms" }}>
                  <Field label="Your name">
                    <input
                      className="input"
                      value={form.full_name}
                      onChange={set("full_name")}
                      required
                    />
                  </Field>
                </div>
              </>
            )}

            <div className="auth-field" style={{ animationDelay: "120ms" }}>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  required
                  autoComplete="email"
                  placeholder="you@builder.com"
                />
              </Field>
            </div>

            <div className="auth-field" style={{ animationDelay: "160ms" }}>
              <Field label="Password">
                <div className="input-affix">
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    required
                    minLength={8}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="input-affix-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Icons.moon size={15} /> : <Icons.sun size={15} />}
                  </button>
                </div>
              </Field>
            </div>

            {error && (
              <div className="auth-field">
                <ErrorNote message={error} />
              </div>
            )}

            <div className="auth-field" style={{ animationDelay: "200ms" }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loadingText={mode === "login" ? "Signing in…" : "Creating…"}
                onClick={submit}
                iconRight="chevron"
              >
                {mode === "login" ? "Sign in" : "Create organisation"}
              </Button>
            </div>
          </form>

          <button
            className="auth-switch"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? (
              <>
                New builder? <strong>Create an organisation</strong>
              </>
            ) : (
              <>
                Already have an account? <strong>Sign in</strong>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ----------------------------------------------------- brand panel */}
      <aside className="auth-brand-side" aria-hidden>
        {/* Slow drifting orbs behind everything. */}
        <span className="auth-orb auth-orb-1" />
        <span className="auth-orb auth-orb-2" />
        <span className="auth-blueprint" />

        <div className="auth-brand-inner">
          <div className="auth-house">
            <HouseBuilder size={150} />
          </div>

          <h2 className="auth-tagline">
            One record per home, from first enquiry to the end of warranty.
          </h2>

          <div className="auth-slides">
            {HIGHLIGHTS.map((h, i) => {
              const Icon = Icons[h.icon];
              return (
                <div key={h.title} className={`auth-slide ${i === slide ? "is-active" : ""}`}>
                  <span className="auth-slide-icon">
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="auth-slide-title">{h.title}</p>
                    <p className="auth-slide-body">{h.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="auth-dots">
            {HIGHLIGHTS.map((h, i) => (
              <span key={h.title} className={`auth-dot ${i === slide ? "is-active" : ""}`} />
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
