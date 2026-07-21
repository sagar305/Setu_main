"use client";

// Receipt Designer — owns the shared receipt_templates entity. Templates
// designed here are stored in the workspace so the POS (and future tools)
// can print with them: design once, reuse everywhere.

import { useState } from "react";
import {
  Card,
  ConfirmDialog,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useEntityList } from "@/lib/hooks/useEntityList";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
import { generateId, nowIso } from "@/lib/pos/types";
import { useI18n } from "@/lib/i18n";

type Draft = {
  name: string;
  paperSize: ReceiptTemplate["paperSize"];
  accentColor: string;
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showBusinessInfo: boolean;
  showGstin: boolean;
  boldTotals: boolean;
  separator: ReceiptTemplate["separator"];
};

const DEFAULTS: Draft = {
  name: "My Receipt",
  paperSize: "80mm",
  accentColor: "#26306B",
  headerText: "",
  footerText: "Thank you for your business!",
  showLogo: true,
  showBusinessInfo: true,
  showGstin: true,
  boldTotals: true,
  separator: "dashed",
};

export function ReceiptDesignerTool() {
  const workspace = useWorkspaceConnection("receipt-designer");
  const { t } = useI18n();
  const { items: templates, save, remove } = useEntityList<ReceiptTemplate>("receipt_templates");
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReceiptTemplate | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedMsg(false);
  };

  const startEdit = (t: ReceiptTemplate) => {
    setEditingId(t.id);
    setDraft({
      name: t.name,
      paperSize: t.paperSize as Draft["paperSize"],
      accentColor: t.accentColor,
      headerText: t.headerText,
      footerText: t.footerText,
      showLogo: t.showLogo,
      showBusinessInfo: t.showBusinessInfo,
      showGstin: t.showGstin,
      boldTotals: t.boldTotals,
      separator: t.separator as Draft["separator"],
    });
  };

  const submit = async () => {
    const existing = templates.find((t) => t.id === editingId);
    await save({
      id: editingId ?? generateId(),
      ...draft,
      name: draft.name.trim() || "My Receipt",
      createdByTool: existing?.createdByTool ?? "receipt-designer",
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
    setSavedMsg(true);
  };

  const startNew = () => {
    setEditingId(null);
    setDraft(DEFAULTS);
    setSavedMsg(false);
  };

  const biz = workspace.business;
  const sep =
    draft.separator === "dashed"
      ? "border-t border-dashed border-gray-400"
      : draft.separator === "solid"
        ? "border-t border-gray-400"
        : "";

  const paperWidth = draft.paperSize === "58mm" ? "w-[200px]" : draft.paperSize === "a4" ? "w-[300px]" : "w-[260px]";

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Preview the receipt with your real business name, logo and GSTIN."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_300px]">
        <Card className="h-fit">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">
              {editingId ? "Edit template" : "Design a receipt"}
            </h2>
            {editingId ? <SecondaryButton onClick={startNew}>+ New</SecondaryButton> : null}
          </div>
          <div className="space-y-4">
            <Field label={t("name")}>
              <TextInput value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paper size">
                <Select
                  value={draft.paperSize}
                  onChange={(e) => set("paperSize", e.target.value as Draft["paperSize"])}
                >
                  <option value="80mm">Thermal 80mm</option>
                  <option value="58mm">Thermal 58mm</option>
                  <option value="a4">A4</option>
                </Select>
              </Field>
              <Field label="Separator style">
                <Select
                  value={draft.separator}
                  onChange={(e) => set("separator", e.target.value as Draft["separator"])}
                >
                  <option value="dashed">Dashed</option>
                  <option value="solid">Solid</option>
                  <option value="none">None</option>
                </Select>
              </Field>
            </div>
            <Field label="Accent color">
              <input
                type="color"
                value={draft.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-muted-line/40"
              />
            </Field>
            <Field label="Header line (optional)">
              <TextInput
                value={draft.headerText}
                onChange={(e) => set("headerText", e.target.value)}
                placeholder="e.g. TAX INVOICE"
              />
            </Field>
            <Field label="Footer message">
              <TextInput value={draft.footerText} onChange={(e) => set("footerText", e.target.value)} />
            </Field>
            <div className="space-y-2 text-sm text-ink">
              {(
                [
                  ["Show logo", "showLogo"],
                  ["Show business info", "showBusinessInfo"],
                  ["Show GSTIN", "showGstin"],
                  ["Bold totals", "boldTotals"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="h-4 w-4 accent-indigo"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={submit}>
                {editingId ? t("saveChanges") : t("save")}
              </PrimaryButton>
              {savedMsg ? (
                <p className="text-sm font-medium text-emerald-600">
                  Saved — available to the POS ✓
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Live preview */}
        <div className="justify-self-center">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            Live preview
          </p>
          <div
            className={`${paperWidth} rounded-lg border border-muted-line/40 bg-white p-4 font-mono text-[11px] leading-snug text-gray-800 shadow-md`}
          >
            {draft.headerText ? (
              <p className="text-center font-bold" style={{ color: draft.accentColor }}>
                {draft.headerText}
              </p>
            ) : null}
            {draft.showLogo ? (
              biz?.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={biz.logoDataUrl} alt="" className="mx-auto my-1 h-10 w-10 object-contain" />
              ) : (
                <div
                  className="mx-auto my-1 flex h-10 w-10 items-center justify-center rounded font-bold text-white"
                  style={{ backgroundColor: draft.accentColor }}
                >
                  {(biz?.name ?? "S").charAt(0)}
                </div>
              )
            ) : null}
            {draft.showBusinessInfo ? (
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: draft.accentColor }}>
                  {biz?.name ?? "Your Business"}
                </p>
                <p>{biz?.address || "Shop address"}</p>
                <p>{biz?.phone || "98765 43210"}</p>
                {draft.showGstin ? <p>GSTIN: {biz?.taxNumber || "22AAAAA0000A1Z5"}</p> : null}
              </div>
            ) : null}
            <div className={`my-2 ${sep}`} />
            <div className="flex justify-between">
              <span>Bill No: 00042</span>
              <span>18 Jul 2026</span>
            </div>
            <div className={`my-2 ${sep}`} />
            {[
              ["Tea", "2 × 15", "30.00"],
              ["Samosa", "3 × 12", "36.00"],
              ["Biscuit", "1 × 10", "10.00"],
            ].map(([name, qty, amt]) => (
              <div key={name} className="flex justify-between">
                <span>
                  {name} <span className="text-gray-500">{qty}</span>
                </span>
                <span>{amt}</span>
              </div>
            ))}
            <div className={`my-2 ${sep}`} />
            <div className={`flex justify-between ${draft.boldTotals ? "font-bold" : ""}`}>
              <span>TOTAL</span>
              <span>₹76.00</span>
            </div>
            <div className={`my-2 ${sep}`} />
            <p className="text-center">{draft.footerText}</p>
          </div>
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">Saved templates</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-muted">
              None yet. Saved templates appear in the Browser POS as printing options — design once,
              print everywhere.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                    editingId === tpl.id ? "border-indigo/50 bg-indigo/5" : "border-muted-line/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tpl.accentColor }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-ink">{tpl.name}</p>
                      <p className="text-xs text-muted">{tpl.paperSize}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <button type="button" className="text-indigo" onClick={() => startEdit(tpl)}>
                      {t("edit")}
                    </button>
                    <button type="button" className="text-red-500" onClick={() => setDeleting(tpl)}>
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete template?"
        message={
          deleting
            ? `Delete "${deleting.name}"? Tools that print with it will fall back to their default receipt.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) {
            await remove(deleting.id);
            if (editingId === deleting.id) {
              setEditingId(null);
              setDraft(DEFAULTS);
            }
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
