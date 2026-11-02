"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Lock, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useLocalizedHref } from "@/lib/i18n/use-localized-href";
import {
  getQrMenuBranding,
  linkedMenuPayload,
  setQrMenuBranding,
  subscribePosMenuLink,
  withBranding,
  type PosMenuLink,
  type QrMenuBranding,
} from "@/lib/qrmenu-pos-link";
import { shortMenuUrl, updateShortLink } from "@/lib/toolkit/shortLink";
import { MenuDisplay } from "./MenuDisplay";

const PUBLISH_DELAY_MS = 1200;

/**
 * The QR Menu Generator while Free Dine owns the menu.
 *
 * Dishes, prices, name, phone and address are shown but locked — they come
 * from the POS, and an edit here would be overwritten on its next push. The
 * tagline and brand colour are this tool's to set, and it publishes them
 * itself with the shared edit token, so the change reaches diners even when
 * Free Dine is not open.
 */
export function LinkedPosMenu({
  link,
  accentPresets,
  inputClass,
}: {
  link: PosMenuLink;
  accentPresets: string[];
  inputClass: string;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const [branding, setBranding] = useState<QrMenuBranding>(() => getQrMenuBranding());
  const [origin, setOrigin] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const dirty = useRef(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    // Another tab (or Free Dine) may change the look too; follow it.
    return subscribePosMenuLink(() => {
      const next = getQrMenuBranding();
      setBranding((current) =>
        current.tagline === next.tagline && current.accent === next.accent ? current : next
      );
    });
  }, []);

  // Publish a few moments after the owner stops typing or picking colours.
  useEffect(() => {
    if (!dirty.current) return;
    setStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await updateShortLink(link.code, linkedMenuPayload(link.menu, branding), link.editToken);
        dirty.current = false;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, PUBLISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [branding, link, attempt]);

  const update = (changes: Partial<QrMenuBranding>) => {
    const next = { ...branding, ...changes };
    dirty.current = true;
    setBranding(next);
    setQrMenuBranding(next);
  };

  const menu = withBranding(link.menu, branding);
  const url = origin ? shortMenuUrl(link.code, origin) : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
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
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "menu-qr.svg";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const lockedField = (label: string, value: string) => (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      <p className="flex min-h-[38px] items-center gap-2 rounded-lg border border-muted-line/30 bg-cream/60 px-3 py-2 text-sm text-ink">
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 break-words">{value || "—"}</span>
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* The printed QR and where it points, above everything else. */}
      <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div ref={qrRef} className="w-fit shrink-0 rounded-xl border border-muted-line/30 bg-white p-2">
            {url && <QRCodeSVG value={url} size={176} level="M" marginSize={2} />}
          </div>
          <div className="min-w-0 space-y-3">
            <h2 className="text-lg font-semibold text-ink">{t("qmLinkedTitle")}</h2>
            <p className="text-sm text-muted">{t("qmLinkedBody")}</p>
            <p className="break-all font-mono text-xs text-ink">{url}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 px-3 py-2 text-sm font-semibold text-indigo hover:bg-indigo/5"
              >
                <ExternalLink className="h-4 w-4" />
                {t("qmOpenMenu")}
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 px-3 py-2 text-sm font-semibold text-indigo hover:bg-indigo/5"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {t("qmCopyLink")}
              </button>
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 px-3 py-2 text-sm font-semibold text-indigo hover:bg-indigo/5"
              >
                <Download className="h-4 w-4" />
                {t("qmDownloadQr")}
              </button>
              <a
                href={href("/products/free-restaurant-pos")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo px-3 py-2 text-sm font-semibold text-white hover:bg-indigo/90"
              >
                {t("qmLinkedOpenPos")}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-ink">{t("qmLinkedLookTitle")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-ink" htmlFor="linked-tagline">
                  {t("qmTagline")}
                </label>
                <input
                  id="linked-tagline"
                  type="text"
                  value={branding.tagline}
                  onChange={(event) => update({ tagline: event.target.value })}
                  placeholder={t("qmTaglinePlaceholder")}
                  maxLength={100}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-semibold text-ink">{t("qmThemeColour")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {accentPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => update({ accent: color })}
                      aria-label={fill(t("qmUseThemeColour"), { color })}
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        branding.accent === color ? "scale-110 border-ink" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={branding.accent}
                    onChange={(event) => update({ accent: event.target.value })}
                    aria-label={t("qmPickCustomColour")}
                    className="h-8 w-8 cursor-pointer rounded-full border border-muted-line/40 bg-white p-0.5"
                  />
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm" aria-live="polite">
              {status === "saving" && <span className="text-muted">{t("qmLinkedSaving")}</span>}
              {status === "saved" && <span className="text-green-700">{t("qmLinkedSaved")}</span>}
              {status === "error" && (
                <span className="inline-flex flex-wrap items-center gap-2 text-red-700">
                  {t("qmLinkedFailed")}
                  <button
                    type="button"
                    onClick={() => {
                      dirty.current = true;
                      setAttempt((n) => n + 1);
                    }}
                    className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("qmLinkedRetry")}
                  </button>
                </span>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-ink">{t("qmRestaurantDetails")}</h2>
            <p className="mb-4 text-xs text-muted">{t("qmLinkedFromPos")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{lockedField(t("qmRestaurantName"), link.menu.restaurantName)}</div>
              {lockedField(t("phone"), link.menu.phone)}
              {lockedField(t("address"), link.menu.address)}
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold text-muted">{t("qmLivePreview")}</p>
          <MenuDisplay menu={menu} />
        </div>
      </div>
    </div>
  );
}
