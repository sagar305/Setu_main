"use client";

// Receipt Designer — owns the shared receipt_templates entity. Templates
// designed here are stored in the workspace so the POS (and future tools)
// can print with them: design once, reuse everywhere.

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useEntityList } from "@/lib/hooks/useEntityList";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso, type Business } from "@/lib/pos/types";
import { dbPut } from "@/lib/pos/db";
import { readLogoDataUrl } from "@/lib/toolkit/logo";
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";

type SaleItem = { id: string; name: string; qty: number; price: number };

const blankSaleItem = (): SaleItem => ({ id: generateId(), name: "", qty: 1, price: 0 });

const SAMPLE_SALE: SaleItem[] = [
  { id: "s1", name: "Tea", qty: 2, price: 15 },
  { id: "s2", name: "Samosa", qty: 3, price: 12 },
  { id: "s3", name: "Biscuit", qty: 1, price: 10 },
];

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

/**
 * Dictionary key per payment mode.
 *
 * The mode is held and printed as its English string, so switching language
 * mid-sale cannot leave the select with a value it no longer recognises; the
 * translation is applied only where it is shown.
 */
const PAY_MODE_KEYS: Record<string, TKey> = {
  Cash: "payCash",
  UPI: "payUpi",
  Card: "payCard",
  "Credit (Udhaar)": "payCredit",
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
  // The template's name and footer are the shopkeeper's own copy once they edit
  // them, but the values they start from should be in their language rather
  // than English for them to translate by hand.
  const payLabel = (mode: string) => (PAY_MODE_KEYS[mode] ? t(PAY_MODE_KEYS[mode]) : mode);

  const defaults = (): Draft => ({
    ...DEFAULTS,
    name: t("rdDefaultName"),
    footerText: t("rdDefaultFooter"),
  });
  const { items: templates, save, remove } = useEntityList<ReceiptTemplate>("receipt_templates");
  const [draft, setDraft] = useState<Draft>(defaults);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReceiptTemplate | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // Real sale details for generating (not just designing) a receipt.
  const [saleItems, setSaleItems] = useState<SaleItem[]>(SAMPLE_SALE);
  const [billNo, setBillNo] = useState(`00${String(Date.now()).slice(-3)}`);
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");

  const currency = workspace.business?.currency ?? "INR";
  const receiptTotal = useMemo(
    () => saleItems.reduce((sum, i) => sum + (i.qty || 0) * (i.price || 0), 0),
    [saleItems]
  );

  const updateSaleItem = (id: string, patch: Partial<SaleItem>) =>
    setSaleItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const validSaleItems = saleItems.filter((i) => i.name.trim() && i.qty > 0);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedMsg(false);
  };

  const startEdit = (template: ReceiptTemplate) => {
    setEditingId(template.id);
    setDraft({
      name: template.name,
      paperSize: template.paperSize as Draft["paperSize"],
      accentColor: template.accentColor,
      headerText: template.headerText,
      footerText: template.footerText,
      showLogo: template.showLogo,
      showBusinessInfo: template.showBusinessInfo,
      showGstin: template.showGstin,
      boldTotals: template.boldTotals,
      separator: template.separator as Draft["separator"],
    });
  };

  const submit = async () => {
    const existing = templates.find((template) => template.id === editingId);
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
    setDraft(defaults());
    setSavedMsg(false);
  };

  const biz = workspace.business;

  // Upload / change the business logo from here. It saves to the shared
  // business record, so the logo then appears on the receipt (and on invoices,
  // shared links, and every other Setu tool).
  const [logoError, setLogoError] = useState("");
  const onLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !biz) return;
    try {
      const dataUrl = await readLogoDataUrl(file);
      await dbPut<Business>("business", { ...biz, logoDataUrl: dataUrl });
      await workspace.reload();
      setLogoError("");
    } catch {
      setLogoError("That file could not be used as a logo.");
    }
  };
  const clearLogo = async () => {
    if (!biz) return;
    await dbPut<Business>("business", { ...biz, logoDataUrl: "", updatedAt: nowIso() } as Business);
    await workspace.reload();
  };

  const pickSaleProduct = (itemId: string, productId: string) => {
    const p = workspace.products.find((x) => x.id === productId);
    if (!p) return;
    updateSaleItem(itemId, { name: p.name, price: p.sellingPrice });
  };

  // Print a real receipt using the current design + the sale details entered.
  const printReceipt = () => {
    const money = (v: number) => formatMoney(v, currency);
    const widthPx = draft.paperSize === "58mm" ? 220 : draft.paperSize === "a4" ? 480 : 300;
    const sepCss =
      draft.separator === "none"
        ? "border: 0; height: 8px;"
        : `border-top: 1px ${draft.separator} #666; margin: 6px 0;`;

    const itemRows = validSaleItems
      .map(
        (i) => `<div class="row"><span>${esc(i.name)} <span class="q">${i.qty} × ${money(i.price)}</span></span><span>${money(i.qty * i.price)}</span></div>`
      )
      .join("");

    const html = `<!doctype html><html><head><title>${esc(fill(t("rdReceiptTitle"), { number: billNo }))}</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { display: flex; justify-content: center; background: #fff; }
      .r { width: ${widthPx}px; padding: 14px; font-family: "Courier New", "Noto Sans Mono", monospace, sans-serif; font-size: 12px; color: #1a1a1a; }
      .center { text-align: center; }
      .bn { font-size: 15px; font-weight: bold; color: ${draft.accentColor}; }
      .hdr { font-weight: bold; color: ${draft.accentColor}; }
      .sep { ${sepCss} }
      .row { display: flex; justify-content: space-between; padding: 1px 0; }
      .q { color: #777; }
      .tot { display: flex; justify-content: space-between; ${draft.boldTotals ? "font-weight: bold;" : ""} font-size: 13px; }
      img.logo { display: block; margin: 4px auto; height: 44px; object-fit: contain; }
      @page { margin: 6mm; }
    </style></head><body><div class="r">
      ${draft.headerText ? `<p class="center hdr">${esc(draft.headerText)}</p>` : ""}
      ${draft.showLogo && biz?.logoDataUrl ? `<img class="logo" src="${biz.logoDataUrl}" alt="" />` : ""}
      ${
        draft.showBusinessInfo
          ? `<div class="center">
              <p class="bn">${esc(biz?.name ?? t("rdYourBusiness"))}</p>
              ${biz?.address ? `<p>${esc(biz.address)}</p>` : ""}
              ${biz?.phone ? `<p>${esc(biz.phone)}</p>` : ""}
              ${draft.showGstin && biz?.taxNumber ? `<p>GSTIN: ${esc(biz.taxNumber)}</p>` : ""}
            </div>`
          : ""
      }
      <div class="sep"></div>
      <div class="row"><span>${esc(fill(t("rdBillLabel"), { number: billNo }))}</span><span>${esc(saleDate)}</span></div>
      ${customerName ? `<div class="row"><span>${esc(t("customer"))}</span><span>${esc(customerName)}</span></div>` : ""}
      <div class="sep"></div>
      ${itemRows}
      <div class="sep"></div>
      <div class="tot"><span>${esc(t("rdTotalCaps"))}</span><span>${money(receiptTotal)}</span></div>
      <div class="row"><span>${esc(t("rdPaidVia"))}</span><span>${esc(payLabel(paymentMode))}</span></div>
      <div class="sep"></div>
      ${draft.footerText ? `<p class="center">${esc(draft.footerText)}</p>` : ""}
    </div><script>window.onload = () => window.print();</script></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

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
        message={t("rdConnectHint")}
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
              <Field label={t("rdPaperSize")}>
                <Select
                  value={draft.paperSize}
                  onChange={(e) => set("paperSize", e.target.value as Draft["paperSize"])}
                >
                  <option value="80mm">{t("rdThermal80")}</option>
                  <option value="58mm">{t("rdThermal58")}</option>
                  <option value="a4">A4</option>
                </Select>
              </Field>
              <Field label={t("rdSeparator")}>
                <Select
                  value={draft.separator}
                  onChange={(e) => set("separator", e.target.value as Draft["separator"])}
                >
                  <option value="dashed">{t("rdDashed")}</option>
                  <option value="solid">{t("rdSolid")}</option>
                  <option value="none">{t("rdNoneOption")}</option>
                </Select>
              </Field>
            </div>
            <Field label={t("rdAccentColor")}>
              <input
                type="color"
                value={draft.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-muted-line/40"
              />
            </Field>
            <Field label={t("rdHeaderLine")}>
              <TextInput
                value={draft.headerText}
                onChange={(e) => set("headerText", e.target.value)}
                placeholder={t("rdHeaderPlaceholder")}
              />
            </Field>
            <Field label={t("rdFooterMessage")}>
              <TextInput value={draft.footerText} onChange={(e) => set("footerText", e.target.value)} />
            </Field>
            <div className="space-y-2 text-sm text-ink">
              {(
                [
                  ["rdShowLogo", "showLogo"],
                  ["rdShowBusinessInfo", "showBusinessInfo"],
                  ["rdShowGstin", "showGstin"],
                  ["rdBoldTotals", "boldTotals"],
                ] as const
              ).map(([labelKey, key]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="h-4 w-4 accent-indigo"
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>

            {/* Logo — shown when "Show logo" is on. Saves to the shared
                business, so the same logo appears everywhere. */}
            {draft.showLogo ? (
              <div className="rounded-lg border border-muted-line/30 bg-cream-paper/40 p-3">
                {!biz ? (
                  <p className="text-xs text-muted">
                    {t("rdLogoHint")}
                  </p>
                ) : (
                  <div className="flex items-center gap-3">
                    {biz.logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={biz.logoDataUrl}
                        alt="Business logo"
                        className="h-12 w-12 rounded-md border border-muted-line/40 object-contain bg-white"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-muted-line/50 text-lg font-bold text-indigo">
                        {(biz.name || "S").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="cursor-pointer text-sm font-semibold text-indigo hover:underline">
                        {biz.logoDataUrl ? "Change logo" : "Upload logo"}
                        <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
                      </label>
                      {biz.logoDataUrl ? (
                        <button
                          type="button"
                          onClick={clearLogo}
                          className="text-left text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          {t("ugRemoveLogo")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                {logoError ? <p className="mt-2 text-xs text-red-600">{logoError}</p> : null}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <PrimaryButton onClick={submit}>
                {editingId ? t("saveChanges") : t("save")}
              </PrimaryButton>
              {savedMsg ? (
                <p className="text-sm font-medium text-emerald-600">
                  {t("rdSavedToPos")} ✓
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Live preview */}
        <div className="justify-self-center">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {t("rdLivePreview")}
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
                  {biz?.name ?? t("rdYourBusiness")}
                </p>
                <p>{biz?.address || "Shop address"}</p>
                <p>{biz?.phone || "98765 43210"}</p>
                {draft.showGstin ? <p>GSTIN: {biz?.taxNumber || "22AAAAA0000A1Z5"}</p> : null}
              </div>
            ) : null}
            <div className={`my-2 ${sep}`} />
            <div className="flex justify-between">
              <span>{fill(t("rdBillLabel"), { number: billNo })}</span>
              <span>{saleDate}</span>
            </div>
            {customerName ? (
              <div className="flex justify-between">
                <span>{t("customer")}</span>
                <span>{customerName}</span>
              </div>
            ) : null}
            <div className={`my-2 ${sep}`} />
            {(validSaleItems.length > 0 ? validSaleItems : SAMPLE_SALE).map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.name}{" "}
                  <span className="text-gray-500">
                    {i.qty} × {currencySymbol(currency)}
                    {i.price}
                  </span>
                </span>
                <span>{formatMoney(i.qty * i.price, currency)}</span>
              </div>
            ))}
            <div className={`my-2 ${sep}`} />
            <div className={`flex justify-between ${draft.boldTotals ? "font-bold" : ""}`}>
              <span>{t("rdTotalCaps")}</span>
              <span>{formatMoney(receiptTotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("rdPaidVia")}</span>
              <span>{payLabel(paymentMode)}</span>
            </div>
            <div className={`my-2 ${sep}`} />
            <p className="text-center">{draft.footerText}</p>
          </div>
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">{t("rdSavedTemplates")}</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-muted">
              {t("rdNoTemplates")}
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

      {/* Generate a real receipt from the current design. */}
      <Card className="mt-6">
        <h2 className="mb-1 text-lg font-bold text-ink">{t("rdFillSale")}</h2>
        <p className="mb-4 text-sm text-muted">
          {t("rdFillSaleHint")}
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("billNumber")}>
            <TextInput value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </Field>
          <Field label={t("date")}>
            <TextInput type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </Field>
          <Field label={t("rdCustomerOptional")}>
            {workspace.connected && workspace.customers.length > 0 ? (
              <Select
                value=""
                onChange={(e) => {
                  const c = workspace.customers.find((x) => x.id === e.target.value);
                  if (c) setCustomerName(c.name);
                }}
              >
                <option value="">{customerName || "Walk-in / type below"}</option>
                {workspace.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t("rdWalkIn")}
              />
            )}
          </Field>
          <Field label={t("paymentMode")}>
            <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              {Object.keys(PAY_MODE_KEYS).map((mode) => (
                <option key={mode} value={mode}>
                  {payLabel(mode)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">{t("items")}</h3>
        <div className="space-y-2">
          {saleItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_1fr_80px_110px_auto]"
            >
              {workspace.connected && workspace.products.length > 0 ? (
                <Field label={t("product")}>
                  <Select
                    value=""
                    onChange={(e) => e.target.value && pickSaleProduct(item.id, e.target.value)}
                  >
                    <option value="">{t("chooseEllipsis")}</option>
                    {workspace.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label={t("itemPlaceholder")}>
                <TextInput
                  value={item.name}
                  onChange={(e) => updateSaleItem(item.id, { name: e.target.value })}
                />
              </Field>
              <Field label={t("quantity")}>
                <NumberInput
                  min={0}
                  value={item.qty || ""}
                  onChange={(e) => updateSaleItem(item.id, { qty: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label={`Price (${currencySymbol(currency)})`}>
                <NumberInput
                  min={0}
                  step="0.01"
                  value={item.price || ""}
                  onChange={(e) => updateSaleItem(item.id, { price: Number(e.target.value) || 0 })}
                />
              </Field>
              <button
                type="button"
                onClick={() => setSaleItems((prev) => prev.filter((i) => i.id !== item.id))}
                disabled={saleItems.length === 1}
                className="mb-1 justify-self-end text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <SecondaryButton onClick={() => setSaleItems((p) => [...p, blankSaleItem()])}>
            {t("addItem")}
          </SecondaryButton>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">
              {t("total")}{" "}
              <span className="text-lg font-bold text-ink">{formatMoney(receiptTotal, currency)}</span>
            </span>
            <PrimaryButton onClick={printReceipt} disabled={validSaleItems.length === 0}>
              {t("rdPrintReceipt")}
            </PrimaryButton>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title={t("rdDeleteTitle")}
        message={
          deleting
            ? fill(t("rdDeleteMessage"), { name: deleting.name })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (deleting) {
            await remove(deleting.id);
            if (editingId === deleting.id) {
              setEditingId(null);
              setDraft(defaults());
            }
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
