"use client";

// Business Profile — the workspace surface that owns the shared `business`
// record. If no workspace exists on this device yet, saving here CREATES it —
// so any tool (not just the POS) can be a user's first Setu tool.

import { useEffect, useState } from "react";
import {
  Card,
  Field,
  PrimaryButton,
  Select,
  TextArea,
  TextInput,
} from "@/components/toolkit/ui";
import { getBusiness } from "@/lib/toolkit/workspace";
import { dbPut } from "@/lib/pos/db";
import { CURRENCIES, nowIso, type Business } from "@/lib/pos/types";

const BLANK = {
  name: "",
  phone: "",
  email: "",
  address: "",
  currency: "INR",
  taxNumber: "",
  logoDataUrl: "",
};

/** Downscale an uploaded logo to keep the workspace (and backups) small. */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("not an image"));
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function BusinessProfileTool() {
  const [form, setForm] = useState(BLANK);
  const [existing, setExisting] = useState<Business | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBusiness()
      .then((b) => {
        if (b) {
          setExisting(b);
          setForm({
            name: b.name,
            phone: b.phone,
            email: b.email,
            address: b.address,
            currency: b.currency,
            taxNumber: b.taxNumber,
            logoDataUrl: b.logoDataUrl,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const set = (key: keyof typeof BLANK) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setSaved(false);
    };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readLogo(file);
      setForm((f) => ({ ...f, logoDataUrl: dataUrl }));
      setSaved(false);
    } catch {
      // Not an image — ignore.
    }
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const record: Business = {
      id: "main",
      ...form,
      name: form.name.trim(),
      createdAt: existing?.createdAt ?? nowIso(),
    };
    await dbPut<Business>("business", record);
    setExisting(record);
    setSaved(true);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <h2 className="mb-1 text-lg font-bold text-ink">
          {existing ? "Your business" : "Set up your business"}
        </h2>
        <p className="mb-5 text-sm text-muted">
          {existing
            ? "Saved on this device. Every Setu tool — POS, invoices, labels, receipts — uses these details automatically."
            : "Fill this once. Every Setu tool on this device will reuse it — no tool ever asks again."}
        </p>
        {!loaded ? (
          <p className="py-6 text-center text-sm text-muted">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name *">
              <TextInput value={form.name} onChange={set("name")} placeholder="Sharma Stores" />
            </Field>
            <Field label="Phone">
              <TextInput value={form.phone} onChange={set("phone")} placeholder="98765 43210" />
            </Field>
            <Field label="Email">
              <TextInput value={form.email} onChange={set("email")} placeholder="shop@email.com" />
            </Field>
            <Field label="GSTIN / Tax number">
              <TextInput value={form.taxNumber} onChange={set("taxNumber")} placeholder="22AAAAA0000A1Z5" />
            </Field>
            <Field label="Currency">
              <Select value={form.currency} onChange={set("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <TextArea value={form.address} onChange={set("address")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Logo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLogo}
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-indigo/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo hover:file:bg-indigo/20"
                />
              </Field>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <PrimaryButton onClick={save} disabled={!form.name.trim()}>
                {existing ? "Save changes" : "Create workspace"}
              </PrimaryButton>
              {saved ? <p className="text-sm font-medium text-emerald-600">Saved ✓</p> : null}
            </div>
          </div>
        )}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">Preview</h2>
        <div className="rounded-xl border border-muted-line/30 p-5 text-center">
          {form.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoDataUrl}
              alt="Business logo"
              className="mx-auto mb-3 h-16 w-16 rounded-lg object-contain"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-cream text-2xl font-bold text-indigo">
              {form.name.trim().charAt(0).toUpperCase() || "S"}
            </div>
          )}
          <p className="font-bold text-ink">{form.name || "Your business name"}</p>
          {form.address ? <p className="mt-1 text-xs text-muted">{form.address}</p> : null}
          <p className="mt-1 text-xs text-muted">
            {[form.phone, form.email].filter(Boolean).join(" · ")}
          </p>
          {form.taxNumber ? (
            <p className="mt-1 text-xs text-muted">GSTIN: {form.taxNumber}</p>
          ) : null}
        </div>
        <p className="mt-4 text-xs text-muted">
          This is how your details appear on receipts, invoices and labels across Setu tools.
        </p>
      </Card>
    </div>
  );
}
