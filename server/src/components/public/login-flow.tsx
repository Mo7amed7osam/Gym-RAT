"use client";

import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { api, describeError } from "@/lib/client/api";

type Step = "password" | "mfa" | "enrol" | "recovery";

interface Who {
  authenticated: boolean;
  mfaEnrolled?: boolean;
  mfaVerified?: boolean;
}

/**
 * Admin sign-in: password → TOTP (or first-time enrolment with QR + recovery
 * codes). Resumes at the right step when a half-finished session cookie exists.
 */
export function LoginFlow() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") && search.get("next")!.startsWith("/") ? search.get("next")! : "/";
  const [step, setStep] = useState<Step | "checking">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrol, setEnrol] = useState<{ qrDataUrl: string; secretBase32: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Who>("/api/admin/session")
      .then((who) => {
        if (cancelled) return;
        if (who.mfaVerified) router.replace(next);
        else if (who.mfaEnrolled) setStep("mfa");
        else setStep("enrol");
      })
      .catch(() => {
        if (!cancelled) setStep("password");
      });
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  useEffect(() => {
    if (step !== "enrol" || enrol) return;
    api<{ qrDataUrl: string; secretBase32: string }>("/api/admin/mfa/enrol", { method: "POST" })
      .then(setEnrol)
      .catch((cause) => setError(describeError(cause)));
  }, [enrol, step]);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ mfaEnrolled: boolean }>("/api/admin/session", { body: { email, password } });
      setPassword("");
      setStep(result.mfaEnrolled ? "mfa" : "enrol");
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "enrol") {
        const result = await api<{ recoveryCodes: string[] }>("/api/admin/mfa/enrol", { method: "PUT", body: { code } });
        setRecoveryCodes(result.recoveryCodes);
        setStep("recovery");
      } else {
        await api("/api/admin/session/mfa", { body: { code } });
        router.replace(next);
      }
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
      setCode("");
    }
  };

  if (step === "checking") {
    return (
      <div className="card w-full p-6" aria-busy="true">
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton mt-4 h-12" />
        <div className="skeleton mt-3 h-12" />
      </div>
    );
  }

  if (step === "recovery" && recoveryCodes) {
    return (
      <section className="card w-full p-6" aria-labelledby="recovery-title">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-muted text-success">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h1 id="recovery-title" className="display text-[26px]">
            Authenticator enrolled
          </h1>
        </div>
        <p className="mt-3 text-[14px] text-fg-muted">Save these recovery codes somewhere safe. Each works once if you lose the authenticator. They are shown only now.</p>
        <ul className="tnum mt-4 grid grid-cols-2 gap-2 font-mono text-[14px]">
          {recoveryCodes.map((item) => (
            <li key={item} className="rounded-row bg-surface-raised px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between gap-3">
          <CopyButton value={recoveryCodes.join("\n")} label="Copy all" />
          <Button onClick={() => router.replace(next)}>Continue to dashboard</Button>
        </div>
      </section>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={submitPassword} className="card w-full p-6" aria-labelledby="login-title" noValidate>
        <h1 id="login-title" className="display text-[28px]">
          Admin sign in
        </h1>
        <p className="mt-1 text-[14px] text-fg-muted">Two steps: password, then your authenticator.</p>
        <div className="mt-6 flex flex-col gap-4">
          <Input label="Email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
          <Input
            label="Password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            trailing={
              <Button type="button" variant="ghost" size="icon" aria-label={reveal ? "Hide password" : "Show password"} aria-pressed={reveal} onClick={() => setReveal((value) => !value)}>
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            }
          />
        </div>
        {error ? (
          <p role="alert" className="mt-4 rounded-row bg-danger-muted px-3 py-2 text-[13px] font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
          Continue
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="card w-full p-6" aria-labelledby="mfa-title" noValidate>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-muted text-accent">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <h1 id="mfa-title" className="display text-[26px]">
          {step === "enrol" ? "Set up your authenticator" : "Two-step verification"}
        </h1>
      </div>
      {step === "enrol" ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-[14px] text-fg-muted">Scan with 1Password, Google Authenticator, Authy or any TOTP app, then enter the 6-digit code it shows.</p>
          {enrol ? (
            <>
              <div className="rounded-tile bg-white p-3">
                <Image src={enrol.qrDataUrl} alt="QR code for the authenticator app" width={200} height={200} unoptimized />
              </div>
              <details className="w-full text-[13px] text-fg-muted">
                <summary className="cursor-pointer">Can&apos;t scan? Enter the key manually</summary>
                <code className="mt-2 block break-all rounded-row bg-surface-raised px-3 py-2 font-mono text-fg">{enrol.secretBase32}</code>
              </details>
            </>
          ) : (
            <div className="skeleton size-[224px]" />
          )}
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-fg-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
      )}
      <div className="mt-5">
        <Input label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="tnum text-center text-[22px] tracking-[0.3em]" required autoFocus />
      </div>
      {error ? (
        <p role="alert" className="mt-4 rounded-row bg-danger-muted px-3 py-2 text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
        {step === "enrol" ? "Confirm and finish" : "Verify"}
      </Button>
      <button
        type="button"
        className="mt-4 w-full text-center text-[13px] text-fg-muted underline-offset-4 hover:underline"
        onClick={async () => {
          await api("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
          setStep("password");
          setEnrol(null);
          setError(null);
        }}
      >
        Use a different account
      </button>
    </form>
  );
}
