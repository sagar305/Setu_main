"use client";

// Shared UI primitives for Business Toolkit tools. Every toolkit tool builds
// its forms/tables from these so the ecosystem looks and behaves like one
// product (UI Standards, Chapter 8).

import { type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      {...props}
      className={`${inputClass} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function DangerButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-muted-line/50 bg-cream-paper/50 p-10 text-center">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{subtitle}</p>
      {action ? <div className="mt-4 flex justify-center gap-3">{action}</div> : null}
    </div>
  );
}

/**
 * Confirmation dialog for dangerous operations (delete, stock changes, …).
 * The workspace layer decides WHAT is dangerous (lib/toolkit/entities.ts);
 * this is the single UI through which every tool asks.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <SecondaryButton onClick={onCancel}>{cancelLabel}</SecondaryButton>
          {danger ? (
            <DangerButton onClick={onConfirm}>{confirmLabel}</DangerButton>
          ) : (
            <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
