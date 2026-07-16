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
} from "lucide-react";
import {
  buildMenuUrl,
  countMenuItems,
  createEmptyCategory,
  createEmptyItem,
  createEmptyMenu,
  createSampleMenu,
  QR_CAPACITY_M,
  QR_CAPACITY_MAX,
  type DietTag,
  type QrMenuData,
} from "@/lib/qrmenu";
import { MenuDisplay } from "./MenuDisplay";
import { ShareButton } from "@/components/tools/ShareButton";

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
  const [menu, setMenu] = useState<QrMenuData>(createEmptyMenu);
  const [hydrated, setHydrated] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  const itemCount = countMenuItems(menu);
  const hasContent = menu.restaurantName.trim().length > 0 && itemCount > 0;
  const urlLength = menuUrl.length;
  const overCapacity = urlLength > QR_CAPACITY_MAX;
  const qrLevel: "M" | "L" = urlLength <= QR_CAPACITY_M ? "M" : "L";
  const capacityPercent = Math.min(100, Math.round((urlLength / QR_CAPACITY_MAX) * 100));

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
    if (!window.confirm("Clear the entire menu and start over?")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setMenu(createEmptyMenu());
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

  const handleDownloadQR = async () => {
    const canvas = await renderQrCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    const slug = menu.restaurantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "menu";
    link.download = `${slug}-menu-qr.png`;
    link.click();
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
            <h2 className="text-lg font-semibold text-ink">Restaurant details</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMenu(createSampleMenu())}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Load sample
              </button>
              <button
                onClick={handleReset}
                title="Clear menu"
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">
                Restaurant name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={menu.restaurantName}
                onChange={(e) => updateField("restaurantName", e.target.value)}
                placeholder="e.g. Sharma's Kitchen"
                maxLength={60}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Tagline</label>
              <input
                type="text"
                value={menu.tagline}
                onChange={(e) => updateField("tagline", e.target.value)}
                placeholder="e.g. Authentic North Indian flavours"
                maxLength={100}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Phone</label>
              <input
                type="tel"
                value={menu.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+91 98765 43210"
                maxLength={20}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Address</label>
              <input
                type="text"
                value={menu.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Short address or landmark"
                maxLength={120}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Theme colour</label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateField("accent", color)}
                    aria-label={`Use theme colour ${color}`}
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
                  aria-label="Pick a custom theme colour"
                  className="h-8 w-8 cursor-pointer rounded-full border border-muted-line/40 bg-white p-0.5"
                />
              </div>
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
                placeholder={`Category name (e.g. ${categoryIndex === 0 ? "Starters" : "Main Course"})`}
                maxLength={40}
                className={`${inputClass} font-semibold`}
              />
              <button
                onClick={() => moveCategory(category.id, -1)}
                disabled={categoryIndex === 0}
                title="Move category up"
                aria-label="Move category up"
                className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:bg-cream disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveCategory(category.id, 1)}
                disabled={categoryIndex === menu.categories.length - 1}
                title="Move category down"
                aria-label="Move category down"
                className="rounded-lg border border-muted-line/40 p-2 text-muted transition hover:bg-cream disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => removeCategory(category.id)}
                title="Remove category"
                aria-label="Remove category"
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
                      placeholder="Dish name"
                      maxLength={60}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(e) => updateItem(category.id, item.id, "price", e.target.value)}
                      placeholder="₹ Price"
                      maxLength={12}
                      className={inputClass}
                    />
                    <select
                      value={item.tag}
                      onChange={(e) => updateItem(category.id, item.id, "tag", e.target.value)}
                      aria-label="Dietary tag"
                      className={inputClass}
                    >
                      <option value="">No tag</option>
                      <option value="veg">🟢 Veg</option>
                      <option value="nonveg">🔺 Non-veg</option>
                    </select>
                    <button
                      onClick={() => removeItem(category.id, item.id)}
                      title="Remove item"
                      aria-label="Remove item"
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
                    placeholder="Short description (optional)"
                    maxLength={120}
                    className={`${inputClass} mt-2`}
                  />
                </div>
              ))}
              <button
                onClick={() => addItem(category.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addCategory}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo/30 bg-indigo/5 px-4 py-4 font-semibold text-indigo transition hover:bg-indigo/10"
        >
          <Plus className="h-5 w-5" />
          Add category
        </button>

        {/* Mobile preview toggle */}
        <div className="lg:hidden">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="w-full rounded-lg border border-muted-line/40 bg-white px-4 py-3 font-semibold text-ink transition hover:bg-cream"
          >
            {showPreview ? "Hide menu preview" : "Show menu preview"}
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
          <h2 className="mb-4 text-lg font-semibold text-ink">Your menu QR code</h2>

          {!hasContent && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
              Add your restaurant name and at least one dish to generate the QR code.
            </div>
          )}

          {hasContent && overCapacity && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Menu is too large for one QR code.</p>
              <p className="mt-1">
                Shorten dish descriptions or remove some items — or split the menu into two QR
                codes (e.g. Food and Drinks).
              </p>
            </div>
          )}

          {hasContent && !overCapacity && menuUrl && (
            <>
              <div className="flex justify-center rounded-lg bg-gray-50 p-6">
                <div data-qr="menu">
                  <QRCodeSVG value={menuUrl} size={240} level={qrLevel} marginSize={2} />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                {itemCount} {itemCount === 1 ? "item" : "items"} · whole menu stored inside the QR
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={handleDownloadQR}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-3 font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Download className="h-4 w-4" />
                  Download QR (print-ready)
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy link
                      </>
                    )}
                  </button>
                  <a
                    href={menuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open menu
                  </a>
                </div>
                <ShareButton
                  title="Menu QR Code"
                  text={`Scan to see the menu of ${menu.restaurantName}`}
                  generateFiles={generateShareFiles}
                  className="w-full px-4 py-2.5"
                />
              </div>
            </>
          )}

          {/* Capacity meter */}
          {hasContent && (
            <div className="mt-5">
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>QR capacity used</span>
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
                  Getting close to the limit — keep descriptions short.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Desktop live preview */}
        <div className="hidden lg:block">
          <p className="mb-2 text-sm font-semibold text-muted">
            Live preview — what customers see after scanning
          </p>
          <div className="max-h-[540px] overflow-y-auto rounded-2xl">
            <MenuDisplay menu={menu} />
          </div>
        </div>
      </div>
    </div>
  );
}
