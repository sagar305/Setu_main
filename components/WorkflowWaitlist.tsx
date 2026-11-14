"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { WAITLIST_TOOLS } from "@/lib/workflowWaitlist";

type Status = "idle" | "open" | "submitting" | "done" | "error";

/**
 * "Join waiting list": a button that opens an email field. On submit the visitor
 * is emailed a confirmation (see /api/workflow/waitlist) and shown links to the
 * free financial tools they can use meanwhile.
 */
export function WorkflowWaitlist({ align = "center" }: { align?: "center" | "start" }) {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();
  const justify = align === "center" ? "justify-center text-center" : "justify-start text-left";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("submitting");
    trackEvent("form_submitted", { form: "workflow-waitlist" });
    try {
      const response = await fetch("/api/workflow/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus("done");
      trackEvent("form_succeeded", { form: "workflow-waitlist" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      setStatus("error");
      trackEvent("form_failed", { form: "workflow-waitlist" });
    }
  }

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStatus("open")}
        className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Join waiting list
      </button>
    );
  }

  if (status === "done") {
    return (
      <div role="status" className={`w-full max-w-xl rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm ${align === "center" ? "mx-auto text-center" : "text-left"}`}>
        <p className={`flex items-center gap-2 font-semibold text-ink ${align === "center" ? "justify-center" : ""}`}>
          <CheckCircle2 className="h-5 w-5 text-indigo" aria-hidden="true" />
          Thanks for joining the waiting list!
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We&apos;ve sent a confirmation to <strong className="text-ink">{email}</strong> and will let you know as soon as Setu
          Workflow opens. Till then, explore our free financial tools:
        </p>
        <div className={`mt-4 flex flex-wrap gap-3 ${align === "center" ? "justify-center" : ""}`}>
          {WAITLIST_TOOLS.map((tool) => (
            <Link
              key={tool.path}
              prefetch={false}
              href={tool.path}
              className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
            >
              {tool.name} →
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex w-full max-w-xl flex-col gap-2 ${align === "center" ? "mx-auto" : ""}`}>
      <label htmlFor={inputId} className={`text-sm font-medium text-ink ${align === "center" ? "text-center" : ""}`}>
        Your work email — we&apos;ll tell you when Setu Workflow opens
      </label>
      <div className={`flex flex-col gap-2 sm:flex-row ${justify}`}>
        <input
          id={inputId}
          type="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="you@yourfirm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={status === "error" || undefined}
          aria-describedby={status === "error" ? `${inputId}-error` : undefined}
          className="min-w-0 flex-1 rounded-lg border border-muted-line/40 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
        />
        {/* Honeypot: hidden from people and screen readers, filled only by bots. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:opacity-60"
        >
          {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Join waiting list
        </button>
      </div>
      {status === "error" && (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
