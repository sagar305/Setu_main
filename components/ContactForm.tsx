"use client";

import { useState } from "react";
import type { ContactContent } from "@/lib/content";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm({ form }: { form: ContactContent["form"] }) {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-ink shadow-sm">
        Thanks — we&apos;ve got your message and will get back to you shortly.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl bg-white p-8 shadow-sm">
      {form.fields.map((field) =>
        field.type === "textarea" ? (
          <label key={field.name} className="flex flex-col gap-2 text-sm font-medium text-ink">
            {field.label}
            <textarea
              name={field.name}
              required={field.required}
              rows={5}
              className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
            />
          </label>
        ) : (
          <label key={field.name} className="flex flex-col gap-2 text-sm font-medium text-ink">
            {field.label}
            <input
              type={field.type}
              name={field.name}
              required={field.required}
              className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
            />
          </label>
        )
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-2 rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink disabled:opacity-60"
      >
        {status === "submitting" ? "Sending..." : form.submitLabel}
      </button>

      {status === "error" && (
        <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
