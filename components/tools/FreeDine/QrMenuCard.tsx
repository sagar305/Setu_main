"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink, QrCode, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { useDine } from "@/lib/dine/store";
import { QrSyncError } from "@/lib/dine/qrMenuSync";
import { QR_MENU_APP_URL } from "@/lib/premiumLinks";
import { shortLinksConfigured } from "@/lib/toolkit/shortLink";
import { useQrMenuSync } from "./QrMenuSync";
import { NewPill } from "@/components/whatsNew/NewPill";
import { useWhatsNewContext } from "@/components/whatsNew/WhatsNewContext";
import { inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

type Choice = "free" | "premium";

/**
 * Settings → QR menu for diners.
 *
 * Connecting is explicit (it creates the free code, or checks the premium
 * key); after that QrMenuSyncProvider keeps the QR menu updated on its own and
 * this card only reports how that is going.
 */
export function QrMenuCard() {
  const { t, lang } = useI18n();
  const { business, settings, menuItems, updateSettings } = useDine();
  const sync = useQrMenuSync();
  const whatsNew = useWhatsNewContext();
  const mode = settings.qrMenuMode;

  const [choice, setChoice] = useState<Choice>(
    settings.qrMenuPremiumKey && !settings.qrMenuFreeCode ? "premium" : "free"
  );
  const [switching, setSwitching] = useState(false);
  const [key, setKey] = useState("");
  const [adopt, setAdopt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const hasMenu = Boolean(business?.name.trim()) && menuItems.some((item) => item.name.trim());

  const errorText = (error: unknown): string => {
    if (error instanceof QrSyncError) {
      if (error.reason === "offline") return t("dnQrOfflineError");
      if (error.reason === "auth") return t("dnQrAuthError");
      if (error.reason === "plan") return t("dnQrPlanError");
      return error.message;
    }
    return error instanceof Error ? error.message : String(error);
  };

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setConnectError("");
    try {
      await job();
      setSwitching(false);
      setKey("");
    } catch (caught) {
      setConnectError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(sync.menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link is on screen to copy by hand.
    }
  };

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "menu-qr.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  const connectForm = (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {(["free", "premium"] as const).map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              choice === option ? "border-indigo bg-indigo/5" : "border-muted-line/40 bg-cream/40"
            }`}
          >
            <input
              type="radio"
              name="qr-menu-mode"
              checked={choice === option}
              onChange={() => setChoice(option)}
              className="mt-0.5 h-4 w-4 accent-[#26306B]"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                {t(option === "free" ? "dnQrModeFree" : "dnQrModePremium")}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {t(option === "free" ? "dnQrFreeHint" : "dnQrPremiumHint")}
              </span>
            </span>
          </label>
        ))}
      </div>

      {choice === "free" ? (
        <div className="space-y-3">
          {!settings.qrMenuFreeCode && sync.existingFreeCode && (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={adopt}
                onChange={(event) => setAdopt(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#26306B]"
              />
              <span>{fill(t("dnQrAdoptExisting"), { code: sync.existingFreeCode })}</span>
            </label>
          )}
          {!shortLinksConfigured() && <p className="text-xs text-red-700">{t("dnQrUnavailableFree")}</p>}
          {!hasMenu && <p className="text-xs text-muted">{t("dnQrNeedsMenu")}</p>}
          <button
            type="button"
            disabled={busy || !hasMenu || !shortLinksConfigured()}
            onClick={() => void run(() => sync.enableFree({ adoptExisting: adopt }))}
            className={primaryBtnClass}
          >
            <QrCode className="h-4 w-4" />
            {settings.qrMenuFreeCode ? t("dnQrResume") : t("dnQrTurnOnFree")}
          </button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => sync.enablePremium(key));
          }}
        >
          <label className="block text-xs font-semibold text-ink" htmlFor="qr-menu-key">
            {t("dnQrKeyLabel")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="qr-menu-key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="sqm_pos_…"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
            <button type="submit" disabled={busy || !key.trim()} className={primaryBtnClass}>
              {t("dnQrConnect")}
            </button>
          </div>
          <a
            href={QR_MENU_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo underline underline-offset-2"
          >
            {t("dnQrOpenPremium")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </form>
      )}

      {connectError && <p className="text-sm text-red-700">{connectError}</p>}
      {switching && (
        <button type="button" onClick={() => setSwitching(false)} className={secondaryBtnClass}>
          {t("cancel")}
        </button>
      )}
    </div>
  );

  return (
    <section
      id="qr-menu"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm transition-shadow sm:p-5"
    >
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
        <QrCode className="h-4 w-4 text-indigo" />
        {t("dnQrTitle")}
        {whatsNew?.pendingOn("settings").some((update) => update.id === "dine-qr-sync") && (
          <NewPill label={t("wnNew")} />
        )}
      </h3>
      <p className="text-sm text-muted">{t("dnQrBlurb")}</p>

      {mode === "off" || switching ? (
        connectForm
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">
            {t(mode === "free" ? "dnQrModeFree" : "dnQrModePremium")} ·{" "}
            <span
              className={
                sync.state === "error"
                  ? "text-red-700"
                  : sync.state === "synced"
                    ? "text-green-700"
                    : "text-muted"
              }
            >
              {t(
                sync.state === "error"
                  ? "dnQrStateError"
                  : sync.state === "syncing"
                    ? "dnQrStateSyncing"
                    : sync.state === "pending"
                      ? "dnQrStatePending"
                      : "dnQrStateSynced"
              )}
            </span>
          </p>
          {sync.error && <p className="text-sm text-red-700">{errorText(sync.error)}</p>}
          {sync.lastSyncAt && (
            <p className="text-xs text-muted">
              {fill(t("dnQrLastSync"), {
                when: new Date(sync.lastSyncAt).toLocaleString(intlLocaleFor(lang)),
              })}
            </p>
          )}

          {sync.menuUrl && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div ref={qrRef} className="w-fit rounded-xl border border-muted-line/30 bg-white p-2">
                <QRCodeSVG value={sync.menuUrl} size={160} level="M" marginSize={2} />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="break-all font-mono text-xs text-ink">{sync.menuUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={sync.menuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={secondaryBtnClass}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("dnQrOpenMenu")}
                  </a>
                  <button type="button" onClick={() => void copyLink()} className={secondaryBtnClass}>
                    <Copy className="h-4 w-4" />
                    {copied ? t("dnQrCopied") : t("dnQrCopyLink")}
                  </button>
                  <button type="button" onClick={downloadQr} className={secondaryBtnClass}>
                    <Download className="h-4 w-4" />
                    {t("dnQrDownloadQr")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "free" && (
            <a
              href="/tools/qr-menu-generator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-indigo underline underline-offset-2"
            >
              {t("dnQrEditLook")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {mode === "free" && (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={settings.qrMenuHideUnavailable}
                onChange={(event) =>
                  void updateSettings({ qrMenuHideUnavailable: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 accent-[#26306B]"
              />
              <span>{t("dnQrHideUnavailable")}</span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sync.syncNow}
              disabled={sync.state === "syncing"}
              className={primaryBtnClass}
            >
              <RefreshCw className="h-4 w-4" />
              {t("dnQrUpdateNow")}
            </button>
            {mode === "free" && (
              <button
                type="button"
                onClick={() => {
                  setChoice("premium");
                  setSwitching(true);
                }}
                className={secondaryBtnClass}
              >
                {t("dnQrSwitchPremium")}
              </button>
            )}
            <button type="button" onClick={() => void sync.disable()} className={secondaryBtnClass}>
              {t("dnQrTurnOff")}
            </button>
          </div>
          <p className="text-xs text-muted">{t("dnQrTurnOffHint")}</p>
        </div>
      )}
    </section>
  );
}
