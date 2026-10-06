"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Download,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  RotateCcw,
  FileUp,
  FileDown,
  Loader2,
  Link2,
  RefreshCw,
} from "lucide-react";
import {
  buildMenuUrl,
  countMenuItems,
  encodeMenu,
  createEmptyCategory,
  createEmptyItem,
  createEmptyMenu,
  createEmptyVariant,
  createSampleMenu,
  QR_CAPACITY_M,
  QR_CAPACITY_MAX,
  type DietTag,
  type QrMenuData,
  type QrVariant,
} from "@/lib/qrmenu";
import { QR_MENU_PRODUCT_PATH } from "@/lib/premiumLinks";
import {
  clearPublishedMenu,
  getPublishedMenu,
  setPublishedMenu,
  type PublishedMenu,
} from "@/lib/qrmenu-publish";
import {
  ShortenError,
  shortLinksConfigured,
  shortenPayload,
  shortMenuUrl,
  updateShortLink,
} from "@/lib/toolkit/shortLink";
import { exportMenuFile, importMenuFile } from "@/lib/qrmenu-io";
import { useI18n } from "@/lib/i18n";
import { fill, splitAround } from "@/lib/i18n/translate";
import { MenuDisplay } from "./MenuDisplay";
import { ShareButton } from "@/components/tools/ShareButton";
import { useReviewPrompt } from "@/lib/hooks/useReviewPrompt";
import { ReviewPromptDialog } from "@/components/review/ReviewPrompt";

const STORAGE_KEY = "setu-qr-menu-generator-v1";

const ACCENT_PRESETS = ["#26306B", "#B3261E", "#1B7A43", "#C2410C", "#0F766E", "#6D28D9"];

const inputClass =
  "w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo focus:ring-indigo/10";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });

export function QrMenuGeneratorTool() {
  const { t, lang } = useI18n();
  const [menu, setMenu] = useState<QrMenuData>(createEmptyMenu);
  const [hydrated, setHydrated] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Publishing state. `published` is null until the restaurant opts in, which
  // keeps the default behaviour exactly what it always was: the whole menu
  // inside the QR code, no server involved.
  const [published, setPublished] = useState<PublishedMenu | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [useShortQr, setUseShortQr] = useState(false);
  const [shortCopied, setShortCopied] = useState(false);

  // Load saved menu + resolve origin on the client only (avoids SSR mismatch)
  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QrMenuData;
        if (parsed && Array.isArray(parsed.categories)) setMenu(parsed);
      }
    } catch {
      // Corrupt saved data — start fresh
    }
    const record = getPublishedMenu();
    setPublished(record);
    // Once a menu is published the printed QR is the short one, so that is what
    // the tool shows by default.
    setUseShortQr(Boolean(record));
    setHydrated(true);
  }, []);

  // Auto-save (debounced)
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
      } catch {
        // Storage full or unavailable — the tool still works without saving
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [menu, hydrated]);

  const menuUrl = useMemo(
    () => (origin ? buildMenuUrl(menu, origin) : ""),
    [menu, origin]
  );

  const encodedMenu = useMemo(() => encodeMenu(menu), [menu]);

  const publishedUrl = published && origin ? shortMenuUrl(published.code, origin) : "";
  // Edits made since the last publish. The printed QR still serves the old menu
  // until the restaurant presses Update, so this has to be visible.
  const hasUnpublishedChanges = Boolean(published) && published?.payload !== encodedMenu;

  const itemCount = countMenuItems(menu);
  const hasContent = menu.restaurantName.trim().length > 0 && itemCount > 0;
  const urlLength = menuUrl.length;
  const overCapacity = urlLength > QR_CAPACITY_MAX;
  const capacityPercent = Math.min(100, Math.round((urlLength / QR_CAPACITY_MAX) * 100));

  // What the QR actually encodes. A published short link is ~40 characters, so
  // the capacity limit stops applying the moment it is in use.
  const showingShortQr = useShortQr && Boolean(publishedUrl);
  const qrValue = showingShortQr ? publishedUrl : menuUrl;
  const qrLevel: "M" | "L" = showingShortQr || urlLength <= QR_CAPACITY_M ? "M" : "L";
  const qrBlocked = !showingShortQr && overCapacity;

  const publish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      if (published) {
        await updateShortLink(published.code, encodedMenu, published.editToken);
        const updated = { ...published, payload: encodedMenu };
        setPublishedMenu(updated);
        setPublished(updated);
      } else {
        const link = await shortenPayload(encodedMenu, "menu");
        // A menu always comes back with an edit token; without it the menu
        // could never be updated, so treat its absence as a failure.
        if (!link.editToken) throw new ShortenError("failed", "No edit token returned.");
        const record: PublishedMenu = {
          code: link.code,
          editToken: link.editToken,
          payload: encodedMenu,
          publishedAt: new Date().toISOString(),
        };
        setPublishedMenu(record);
        setPublished(record);
        setUseShortQr(true);
      }
    } catch (error) {
      const reason = error instanceof ShortenError ? error.reason : "failed";
      setPublishError(t(reason === "offline" ? "qmPublishOfflineError" : "qmPublishFailedError"));
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = () => {
    // Forgetting the record throws away the edit key, and there is no way to
    // get it back — any QR already printed would be frozen on its current menu.
    const confirmed = window.confirm(t("qmUnpublishConfirm"));
    if (!confirmed) return;

    clearPublishedMenu();
    setPublished(null);
    setUseShortQr(false);
    setPublishError(null);
  };

  const copyShortLink = async () => {
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setShortCopied(true);
      setTimeout(() => setShortCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is on screen to copy by hand.
    }
  };

  // --- state updaters -------------------------------------------------------

  const updateField = (field: keyof QrMenuData, value: string) =>
    setMenu((prev) => ({ ...prev, [field]: value }));

  const updateCategory = (categoryId: string, name: string) =>
    setMenu((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === categoryId ? { ...c, name } : c)),
    }));

  const moveCategory = (categoryId: string, direction: -1 | 1) =>
    setMenu((prev) => {
      const index = prev.categories.findIndex((c) => c.id === categoryId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.categories.length) return prev;
      const categories = [...prev.categories];
      [categories[index], categories[target]] = [categories[target], categories[index]];
      return { ...prev, categories };
    });

  const removeCategory = (categoryId: string) =>
    setMenu((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== categoryId),
    }));

  const addCategory = () =>
    setMenu((prev) => ({ ...prev, categories: [...prev.categories, createEmptyCategory()] }));

  const updateItem = (
    categoryId: string,
    itemId: string,
    field: "name" | "price" | "description" | "tag",
    value: string
  ) =>
    setMenu((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              items: c.items.map((item) =>
                item.id === itemId
                  ? { ...item, [field]: field === "tag" ? (value as DietTag) : value }
                  : item
              ),
            }
          : c
      ),
    }));

  // --- variants (one user-named group per dish in the free tool) -------------

  const updateItemVariant = (
    categoryId: string,
    itemId: string,
    update: (variant: QrVariant | null) => QrVariant | null
  ) =>
    setMenu((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              items: c.items.map((item) =>
                item.id === itemId ? { ...item, variant: update(item.variant) } : item
              ),
            }
          : c
      ),
    }));

  const addVariant = (categoryId: string, itemId: string) =>
    updateItemVariant(categoryId, itemId, () => createEmptyVariant());

  const removeVariant = (categoryId: string, itemId: string) =>
    updateItemVariant(categoryId, itemId, () => null);

  const renameVariant = (categoryId: string, itemId: string, name: string) =>
    updateItemVariant(categoryId, itemId, (variant) =>
      variant ? { ...variant, name } : variant
    );

  const addVariantOption = (categoryId: string, itemId: string) =>
    updateItemVariant(categoryId, itemId, (variant) =>
      variant ? { ...variant, options: [...variant.options, { name: "", price: "" }] } : variant
    );

  const updateVariantOption = (
    categoryId: string,
    itemId: string,
    optionIndex: number,
    field: "name" | "price",
    value: string
  ) =>
    updateItemVariant(categoryId, itemId, (variant) =>
      variant
        ? {
            ...variant,
            options: variant.options.map((option, index) =>
              index === optionIndex ? { ...option, [field]: value } : option
            ),
          }
        : variant
    );

  const removeVariantOption = (categoryId: string, itemId: string, optionIndex: number) =>
    updateItemVariant(categoryId, itemId, (variant) => {
      if (!variant) return variant;
      const options = variant.options.filter((_, index) => index !== optionIndex);
      // Dropping the last option leaves nothing to price, so drop the group.
      return options.length > 0 ? { ...variant, options } : null;
    });

  const removeItem = (categoryId: string, itemId: string) =>
    setMenu((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      ),
    }));

  const addItem = (categoryId: string) =>
    setMenu((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId ? { ...c, items: [...c.items, createEmptyItem()] } : c
      ),
    }));

  const handleReset = () => {
    if (!window.confirm(t("qmResetConfirm"))) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setMenu(createEmptyMenu());
  };

  // --- Excel / CSV import & export -------------------------------------------

  const handleExport = async (format: "xlsx" | "csv") => {
    try {
      await exportMenuFile(menu, format);
    } catch (err) {
      console.error("Export failed:", err);
      alert(t("qmExportFailed"));
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setImporting(true);
    try {
      const categories = await importMenuFile(file);
      if (!categories) {
        alert(t("qmImportNoItems"));
        return;
      }
      const importedCount = categories.reduce((total, c) => total + c.items.length, 0);
      if (
        itemCount > 0 &&
        !window.confirm(
          fill(t("qmImportReplace"), {
            current: itemCount,
            imported: importedCount,
            file: file.name,
          })
        )
      ) {
        return;
      }
      setMenu((prev) => ({ ...prev, categories }));
    } catch (err) {
      console.error("Import failed:", err);
      alert(t("qmImportFailed"));
    } finally {
      setImporting(false);
    }
  };

  // --- QR export ------------------------------------------------------------

  // Dense QR codes need a large render to stay scannable when printed
  const renderQrCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const qrElement = document.querySelector('[data-qr="menu"]');
    const svg = qrElement?.querySelector("svg");
    if (!svg) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const qrImg = await loadImage(
        "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
      );
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);
      return canvas;
    } catch (err) {
      console.error("Failed to render QR canvas:", err);
      return null;
    }
  };

  const review = useReviewPrompt();

  const handleDownloadQR = async () => {
    const canvas = await renderQrCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    const slug = menu.restaurantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "menu";
    link.download = `${slug}-menu-qr.png`;
    link.click();
    // The print-ready QR is downloaded: the cycle is finished.
    review.complete();
  };

  const generateShareFiles = async () => {
    const canvas = await renderQrCanvas();
    if (!canvas) return [];
    return new Promise<File[]>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob ? [new File([blob], "menu-qr.png", { type: "image/png" })] : []);
      }, "image/png");
    });
  };

  // The near-the-limit warning links to the premium tool mid-sentence, so the
  // sentence stays one dictionary entry with the link marked by a placeholder.
  const nearLimit = splitAround(t("qmNearLimit"), "link");

  const handleCopyLink = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- render ----------------------------------------------------------------

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Form column */}
      <div className="space-y-6">
        {/* Restaurant details */}
        <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">{t("qmRestaurantDetails")}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMenu(createSampleMenu(lang))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("qmLoadSample")}
              </button>
              <button
                onClick={handleReset}
                title={t("qmClearMenu")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("resetLabel")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">
                {t("qmRestaurantName")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={menu.restaurantName}
                onChange={(e) => updateField("restaurantName", e.target.value)}
                placeholder={t("qmRestaurantNamePlaceholder")}
                maxLength={60}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">{t("qmTagline")}</label>
              <input
                type="text"
                value={menu.tagline}
                onChange={(e) => updateField("tagline", e.target.value)}
                placeholder={t("qmTaglinePlaceholder")}
                maxLength={100}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">{t("phone")}</label>
              <input
                type="tel"
                value={menu.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder={t("qmPhonePlaceholder")}
                maxLength={20}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">{t("address")}</label>
              <input
                type="text"
                value={menu.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder={t("qmAddressPlaceholder")}
                maxLength={120}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">{t("qmThemeColour")}</label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateField("accent", color)}
                    aria-label={fill(t("qmUseThemeColour"), { color })}
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      menu.accent === color ? "scale-110 border-ink" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={menu.accent}
                  onChange={(e) => updateField("accent", e.target.value)}
                  aria-label={t("qmPickCustomColour")}
                  className="h-8 w-8 cursor-pointer rounded-full border border-muted-line/40 bg-white p-0.5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Excel / CSV import & export */}
        <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("qmImportExport")}</h2>
              <p className="mt-1 text-xs text-muted">{t("qmImportExportHint")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo bg-indigo px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileUp className="h-3.5 w-3.5" />
                )}
                {t("qmImportExcel")}
              </button>
              <button
                onClick={() => handleExport("xlsx")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("qmExportExcel")}
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("exportCsv")}
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        {menu.categories.map((category, categoryIndex) => (
          <div key={category.id} className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <input
                type="text"
                value={category.name}
                onChange={(e) => updateCategory(category.id, e.target.value)}
                placeholder={fill(t("qmCategoryPlaceholder"), {
                  example: t(categoryIndex === 0 ? "qmExampleStarters" : "qmExampleMains"),
                })}
                maxLength={40}
                className={`${inputClass} font-semibold`}
              />
              <button
                onClick={() => moveCategory(category.id, -1)}
                disabled={categoryIndex === 0}
                title={t("qmMoveCategoryUp")}
                aria-label={t("qmMoveCategoryUp")}
                className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:bg-cream disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveCategory(category.id, 1)}
                disabled={categoryIndex === menu.categories.length - 1}
                title={t("qmMoveCategoryDown")}
                aria-label={t("qmMoveCategoryDown")}
                className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:bg-cream disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => removeCategory(category.id)}
                title={t("qmRemoveCategory")}
                aria-label={t("qmRemoveCategory")}
                className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-muted-line/30 bg-cream-paper/50 p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_110px_36px]">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(category.id, item.id, "name", e.target.value)}
                      placeholder={t("qmDishName")}
                      maxLength={60}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(e) => updateItem(category.id, item.id, "price", e.target.value)}
                      placeholder={t("qmPricePlaceholder")}
                      maxLength={12}
                      className={inputClass}
                    />
                    <select
                      value={item.tag}
                      onChange={(e) => updateItem(category.id, item.id, "tag", e.target.value)}
                      aria-label={t("qmDietaryTag")}
                      className={inputClass}
                    >
                      <option value="">{t("qmNoTag")}</option>
                      <option value="veg">🟢 {t("qmVeg")}</option>
                      <option value="nonveg">🔺 {t("qmNonVeg")}</option>
                    </select>
                    <button
                      onClick={() => removeItem(category.id, item.id)}
                      title={t("qmRemoveItem")}
                      aria-label={t("qmRemoveItem")}
                      className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(category.id, item.id, "description", e.target.value)
                    }
                    placeholder={t("qmDescPlaceholder")}
                    maxLength={120}
                    className={`${inputClass} mt-2`}
                  />

                  {/* Variants: one user-named group per dish. Each option
                      carries its own price and replaces the price above. */}
                  {item.variant ? (
                    <div className="mt-2 rounded-lg border border-indigo/20 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.variant.name}
                          onChange={(e) => renameVariant(category.id, item.id, e.target.value)}
                          placeholder={t("qmVariantNamePlaceholder")}
                          maxLength={40}
                          className={`${inputClass} font-semibold`}
                        />
                        <button
                          onClick={() => removeVariant(category.id, item.id)}
                          title={t("qmRemoveVariations")}
                          aria-label={t("qmRemoveVariations")}
                          className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2 space-y-2">
                        {item.variant.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_36px]">
                            <input
                              type="text"
                              value={option.name}
                              onChange={(e) =>
                                updateVariantOption(
                                  category.id,
                                  item.id,
                                  optionIndex,
                                  "name",
                                  e.target.value
                                )
                              }
                              placeholder={t("qmOptionPlaceholder")}
                              maxLength={40}
                              className={inputClass}
                            />
                            <input
                              type="text"
                              inputMode="decimal"
                              value={option.price}
                              onChange={(e) =>
                                updateVariantOption(
                                  category.id,
                                  item.id,
                                  optionIndex,
                                  "price",
                                  e.target.value
                                )
                              }
                              placeholder={t("qmPricePlaceholder")}
                              maxLength={12}
                              className={inputClass}
                            />
                            <button
                              onClick={() => removeVariantOption(category.id, item.id, optionIndex)}
                              title={t("qmRemoveOption")}
                              aria-label={t("qmRemoveOption")}
                              className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => addVariantOption(category.id, item.id)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("qmAddOption")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addVariant(category.id, item.id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-cream"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("qmAddVariations")}
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => addItem(category.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("qmAddItem")}
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addCategory}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo/30 bg-indigo/5 px-4 py-4 font-semibold text-indigo transition hover:bg-indigo/10"
        >
          <Plus className="h-5 w-5" />
          {t("qmAddCategory")}
        </button>

        {/* Mobile preview toggle */}
        <div className="lg:hidden">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="w-full rounded-lg border border-muted-line/40 bg-white px-4 py-3 font-semibold text-ink transition hover:bg-cream"
          >
            {t(showPreview ? "qmHidePreview" : "qmShowPreview")}
          </button>
          {showPreview && (
            <div className="mt-4">
              <MenuDisplay menu={menu} />
            </div>
          )}
        </div>
      </div>

      {/* QR + preview column */}
      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-ink">{t("qmYourQrHeading")}</h2>

          {!hasContent && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
              {t("qmNeedContent")}
            </div>
          )}

          {hasContent && qrBlocked && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">{t("qmTooLargeTitle")}</p>
              <p className="mt-1">{t("qmTooLargeBody")}</p>
              <div className="mt-3 rounded-lg border border-indigo/20 bg-white p-3 text-ink">
                <p className="text-sm font-semibold">{t("qmRemoveLimitTitle")}</p>
                <p className="mt-1 text-xs text-muted">{t("qmRemoveLimitBody")}</p>
                <a
                  href={QR_MENU_PRODUCT_PATH}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-indigo bg-indigo px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("qmTryPremium")}
                </a>
              </div>
            </div>
          )}

          {hasContent && !qrBlocked && qrValue && (
            <>
              <div className="flex justify-center rounded-lg bg-gray-50 p-6">
                <div data-qr="menu">
                  <QRCodeSVG value={qrValue} size={240} level={qrLevel} marginSize={2} />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                {fill(t(itemCount === 1 ? "qmItemOne" : "qmItemMany"), { count: itemCount })} ·{" "}
                {t(showingShortQr ? "qmPointsToPublished" : "qmWholeMenuInside")}
              </p>
              {showingShortQr && hasUnpublishedChanges ? (
                <p className="mt-1 text-center text-xs font-semibold text-amber-600">
                  {t("qmStillLastPublished")}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={handleDownloadQR}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-3 font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Download className="h-4 w-4" />
                  {t("qmDownloadQr")}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        {t("copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        {t("qmCopyLink")}
                      </>
                    )}
                  </button>
                  <a
                    href={qrValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("qmOpenMenu")}
                  </a>
                </div>
                <ShareButton
                  title={t("qmShareTitle")}
                  text={fill(t("qmShareText"), { name: menu.restaurantName })}
                  generateFiles={generateShareFiles}
                  className="w-full px-4 py-2.5"
                />
              </div>
            </>
          )}

          {/* Publishing — optional, and off until the restaurant asks for it */}
          {hasContent && shortLinksConfigured() && (
            <div className="mt-5 rounded-lg border border-muted-line/30 bg-cream-paper/40 p-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-indigo" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-ink">
                  {t(published ? "qmPublishedMenu" : "qmPublishForPermanent")}
                </h3>
              </div>

              {!published ? (
                <>
                  <p className="mt-2 text-xs text-muted">{t("qmPublishBody1")}</p>
                  <p className="mt-2 text-xs text-muted">{t("qmPublishBody2")}</p>
                  <button
                    onClick={publish}
                    disabled={publishing}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("qmPublishing")}
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        {t("qmPublishMenu")}
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-2 break-all rounded-lg bg-white p-2 text-xs text-ink">
                    {publishedUrl}
                  </p>

                  {hasUnpublishedChanges ? (
                    <p className="mt-2 text-xs font-semibold text-amber-600">
                      {t("qmUnpublishedChanges")}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-700">
                      {t("qmLiveUpToDate")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={publish}
                      disabled={publishing || !hasUnpublishedChanges}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo bg-indigo px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {publishing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {t("qmUpdatePublished")}
                    </button>
                    <button
                      onClick={copyShortLink}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-cream"
                    >
                      {shortCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          {t("copied")}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          {t("qmCopyShortLink")}
                        </>
                      )}
                    </button>
                  </div>

                  <label className="mt-3 flex items-start gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={!useShortQr}
                      onChange={(event) => setUseShortQr(!event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-indigo"
                    />
                    <span>{t("qmShowSelfContained")}</span>
                  </label>

                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">{t("qmOnlyThisBrowserTitle")}</p>
                    <p className="mt-1">{t("qmOnlyThisBrowserBody")}</p>
                  </div>

                  <button
                    onClick={unpublish}
                    className="mt-3 text-xs font-semibold text-muted underline"
                  >
                    {t("qmStopUsingPublished")}
                  </button>
                </>
              )}

              {publishError ? (
                <p className="mt-2 text-xs text-red-600">{publishError}</p>
              ) : null}
            </div>
          )}

          {/* Capacity meter — irrelevant once the QR holds a short link */}
          {hasContent && !showingShortQr && (
            <div className="mt-5">
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>{t("qmCapacityUsed")}</span>
                <span>{capacityPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted-line/20">
                <div
                  className={`h-full rounded-full transition-all ${
                    overCapacity
                      ? "bg-red-500"
                      : capacityPercent > 80
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
              {!overCapacity && capacityPercent > 80 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  {nearLimit[0]}
                  <a href={QR_MENU_PRODUCT_PATH} className="font-semibold underline">
                    {t("qmSwitchToPremium")}
                  </a>
                  {nearLimit[1]}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Desktop live preview */}
        <div className="hidden lg:block">
          <p className="mb-2 text-sm font-semibold text-muted">{t("qmLivePreview")}</p>
          <div className="max-h-[540px] overflow-y-auto rounded-2xl">
            <MenuDisplay menu={menu} />
          </div>
        </div>
      </div>

      <ReviewPromptDialog
        open={review.open}
        onAccept={review.accept}
        onDecline={review.decline}
      />
    </div>
  );
}
