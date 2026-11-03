"use client";

import { CheckCircle2, Eye, EyeOff, Link2Off } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, describeError } from "@/lib/client/api";

interface Preview {
  kind: "invite" | "reset" | "admin_setup";
  email: string;
  displayName: string;
  expiresAt: string;
}

const COPY = {
  invite: { title: "Welcome to Gym RAT", lead: "Choose the password you will use in the app.", done: "Your account is ready. Open Gym RAT on your iPhone and sign in." },
  reset: { title: "Choose a new password", lead: "Every signed-in device will be signed out.", done: "Password changed. Sign in again on your iPhone." },
  admin_setup: { title: "Set up the admin account", lead: "Choose the dashboard password. You will enrol an authenticator app on first sign-in.", done: "Done. Sign in to the dashboard to enrol your authenticator." },
} as const;

/**
 * Shared page body for /invite, /reset and /setup links (ADR-015 §5). The
 * admin dashboard is a separate app (ADR-018); /setup passes its sign-in URL.
 */
export function SetPassword({ token, dashboardLoginUrl }: { token: string; dashboardLoginUrl?: string }) {
  const [preview, setPreview] = useState<Preview | null | "invalid">(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<Preview>(`/api/auth/links/${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch(() => setPreview("invalid"));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/links/${encodeURIComponent(token)}`, { body: { password } });
      setDone(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "weak_password") {
        const problems = Array.isArray(cause.details) ? (cause.details as string[]) : [];
        setError(problems.includes("too_short") ? "Use at least 12 characters." : problems.includes("matches_email") ? "The password cannot be your email." : problems.includes("too_common") ? "That password is too predictable." : "Mix letters, numbers or symbols, or make it longer.");
      } else setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  if (preview === null) {
    return (
      <div className="card w-full p-6" aria-busy="true">
        <div className="skeleton h-7 w-2/3" />
        <div className="skeleton mt-3 h-4 w-1/2" />
        <div className="skeleton mt-6 h-12" />
        <div className="skeleton mt-3 h-12" />
      </div>
    );
  }

  if (preview === "invalid") {
    return (
      <section className="card w-full p-6 text-center" aria-labelledby="invalid-title">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-muted text-danger">
          <Link2Off className="size-5" aria-hidden />
        </span>
        <h1 id="invalid-title" className="display mt-4 text-[26px]">
          This link is no longer valid
        </h1>
        <p className="mt-2 text-[14px] text-fg-muted">Links work once and expire. Ask your administrator for a new one.</p>
      </section>
    );
  }

  const copy = COPY[preview.kind];

  if (done) {
    return (
      <section className="card w-full p-6 text-center" aria-labelledby="done-title" aria-live="polite">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-muted text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h1 id="done-title" className="display mt-4 text-[26px]">
          All set
        </h1>
        <p className="mt-2 text-[14px] text-fg-muted">{copy.done}</p>
        {preview.kind === "admin_setup" && dashboardLoginUrl ? (
          <Button className="mt-6" onClick={() => window.location.assign(dashboardLoginUrl)}>
            Go to sign in
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full p-6" aria-labelledby="set-title" noValidate>
      <h1 id="set-title" className="display text-[28px]">
        {copy.title}
      </h1>
      <p className="mt-1 text-[14px] text-fg-muted">
        Hi {preview.displayName}. {copy.lead}
      </p>
      <p className="mt-3 inline-flex rounded-full bg-surface-raised px-3 py-1 text-[13px] text-fg-muted">{preview.email}</p>
      <div className="mt-6 flex flex-col gap-4">
        <Input
          label="New password"
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="At least 12 characters. A short sentence works well."
          required
          autoFocus
          trailing={
            <Button type="button" variant="ghost" size="icon" aria-label={reveal ? "Hide password" : "Show password"} aria-pressed={reveal} onClick={() => setReveal((value) => !value)}>
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          }
        />
        <Input label="Repeat password" type={reveal ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
      </div>
      <PasswordMeter password={password} />
      {error ? (
        <p role="alert" className="mt-4 rounded-row bg-danger-muted px-3 py-2 text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} disabled={password.length === 0 || confirm.length === 0}>
        Save password
      </Button>
    </form>
  );
}

function PasswordMeter({ password }: { password: string }) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((re) => re.test(password)).length;
  const score = password.length === 0 ? 0 : password.length < 12 ? 1 : password.length >= 20 || classes >= 3 ? 3 : 2;
  const label = ["", "Too short", "Good", "Strong"][score];
  const tone = ["bg-surface-high", "bg-danger", "bg-warning", "bg-success"][score];
  return (
    <div className="mt-4" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span key={step} className={`h-1 flex-1 rounded-full ${step <= score ? tone : "bg-surface-high"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-fg-muted">{label || "Password strength"}</p>
    </div>
  );
}
