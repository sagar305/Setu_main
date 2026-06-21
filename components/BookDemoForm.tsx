"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "submitting" | "success" | "error";

export function BookDemoForm() {
  const searchParams = useSearchParams();
  const product = searchParams.get("product") || "Setu";
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, product }),
      });
      const result = await res.json().catch(() => null);

      if (res.ok && result?.ok) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
        setErrorMessage(result?.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-ink shadow-sm">
        Thanks — your demo request for {product} is in. We&apos;ll confirm the slot shortly.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl bg-white p-8 shadow-sm">
      <p className="text-sm font-medium text-indigo">Requesting a demo for: {product}</p>

      <label className="flex flex-col gap-2 text-sm font-medium text-ink">
        Name
        <input
          type="text"
          name="name"
          required
          className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-ink">
        Email
        <input
          type="email"
          name="email"
          required
          className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-ink">
          Preferred date
          <input
            type="date"
            name="date"
            required
            className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-ink">
          Preferred time
          <input
            type="time"
            name="time"
            required
            className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-ink">
        Anything else we should know? (optional)
        <textarea
          name="details"
          rows={4}
          className="rounded-lg border border-muted-line/40 px-4 py-3 text-sm text-ink outline-none focus:border-indigo"
        />
      </label>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-2 rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink disabled:opacity-60"
      >
        {status === "submitting" ? "Sending..." : "Request demo"}
      </button>

      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
