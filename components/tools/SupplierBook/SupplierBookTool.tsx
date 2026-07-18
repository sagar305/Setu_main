"use client";

import { useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PrimaryButton,
  SecondaryButton,
  TextArea,
  TextInput,
} from "@/components/toolkit/ui";
import { useEntityList } from "@/lib/hooks/useEntityList";
import type { Supplier } from "@/lib/toolkit/types";
import { generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

const BLANK = { name: "", phone: "", email: "", gstin: "", address: "", notes: "" };

export function SupplierBookTool() {
  const { items: suppliers, loading, error, save, remove } = useEntityList<Supplier>("suppliers");
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");

  const set = (key: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({ name: s.name, phone: s.phone, email: s.email, gstin: s.gstin, address: s.address, notes: s.notes });
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    const existing = suppliers.find((s) => s.id === editingId);
    const record: Supplier = {
      id: editingId ?? generateId(),
      ...form,
      name: form.name.trim(),
      createdByTool: existing?.createdByTool ?? "supplier-book",
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await save(record);
    setForm(BLANK);
    setEditingId(null);
  };

  const exportCsv = () =>
    downloadCsv(
      "suppliers.csv",
      toCsv(
        ["Name", "Phone", "Email", "GSTIN", "Address", "Notes"],
        suppliers.map((s) => [s.name, s.phone, s.email, s.gstin, s.address, s.notes])
      )
    );

  const filtered = suppliers
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Suppliers ({suppliers.length})</h2>
          <div className="flex gap-2">
            <TextInput
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44"
            />
            <SecondaryButton onClick={exportCsv} disabled={suppliers.length === 0}>
              Export CSV
            </SecondaryButton>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={suppliers.length === 0 ? "No suppliers yet" : "No matches"}
            subtitle={
              suppliers.length === 0
                ? "Save your suppliers once — the Purchase Register and other Setu tools reuse them automatically."
                : "Try a different search."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-muted-line/30 p-4"
              >
                <div>
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {[s.phone, s.email, s.gstin && `GSTIN: ${s.gstin}`].filter(Boolean).join(" · ") ||
                      "No contact details"}
                  </p>
                  {s.address ? <p className="mt-0.5 text-sm text-muted">{s.address}</p> : null}
                </div>
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => startEdit(s)}>Edit</SecondaryButton>
                  <SecondaryButton
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleting(s)}
                  >
                    Delete
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">
          {editingId ? "Edit supplier" : "Add supplier"}
        </h2>
        <div className="space-y-4">
          <Field label="Name *">
            <TextInput value={form.name} onChange={set("name")} placeholder="Supplier name" />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={set("phone")} placeholder="98765 43210" />
          </Field>
          <Field label="Email">
            <TextInput value={form.email} onChange={set("email")} placeholder="supplier@email.com" />
          </Field>
          <Field label="GSTIN">
            <TextInput value={form.gstin} onChange={set("gstin")} placeholder="22AAAAA0000A1Z5" />
          </Field>
          <Field label="Address">
            <TextArea value={form.address} onChange={set("address")} />
          </Field>
          <Field label="Notes">
            <TextArea value={form.notes} onChange={set("notes")} />
          </Field>
          <div className="flex gap-2">
            <PrimaryButton className="flex-1" onClick={submit} disabled={!form.name.trim()}>
              {editingId ? "Save changes" : "Add supplier"}
            </PrimaryButton>
            {editingId ? (
              <SecondaryButton
                onClick={() => {
                  setEditingId(null);
                  setForm(BLANK);
                }}
              >
                Cancel
              </SecondaryButton>
            ) : null}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete supplier?"
        message={
          deleting
            ? `Delete "${deleting.name}" from your workspace? Purchases already recorded against them keep the name, but the supplier will no longer appear in any Setu tool.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
