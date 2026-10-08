"use client";

import { FileText, Sparkles, Palette } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";

interface TemplateSelectorProps {
  selectedTemplate: "classic" | "modern" | "colorful";
  brandColor: string;
  onTemplateChange: (template: "classic" | "modern" | "colorful") => void;
  onBrandColorChange: (color: string) => void;
}

// The hex value is what gets stored; the name beside the swatch is just how
// this reader says that colour.
const BRAND_COLOR_PRESETS: { name: TKey; color: string }[] = [
  { name: "igColorIndigo", color: "#26306B" },
  { name: "igColorBlue", color: "#2196F3" },
  { name: "igColorGreen", color: "#4CAF50" },
  { name: "igColorOrange", color: "#FF9800" },
  { name: "igColorPurple", color: "#9C27B0" },
  { name: "igColorRed", color: "#F44336" },
  { name: "igColorTeal", color: "#009688" },
  { name: "igColorPink", color: "#E91E63" },
];

// The id is stored; the name and description follow the reader.
const TEMPLATES: {
  id: "classic" | "modern" | "colorful";
  name: TKey;
  description: TKey;
  icon: typeof FileText;
}[] = [
  {
    id: "classic",
    name: "igTplClassic",
    description: "igTplClassicDesc",
    icon: FileText,
  },
  {
    id: "modern",
    name: "igTplModern",
    description: "igTplModernDesc",
    icon: Sparkles,
  },
  {
    id: "colorful",
    name: "igTplColorful",
    description: "igTplColorfulDesc",
    icon: Palette,
  },
];

export function TemplateSelector({
  selectedTemplate,
  brandColor,
  onTemplateChange,
  onBrandColorChange,
}: TemplateSelectorProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
          {t("igInvoiceTemplate")}
        </h3>

        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map(({ id, name, description, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTemplateChange(id)}
              className={`rounded-xl border-2 p-4 text-left transition ${
                selectedTemplate === id
                  ? "border-indigo bg-indigo/5"
                  : "border-muted-line/30 hover:border-indigo/50"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-5 w-5" />
                <span className="font-semibold text-ink">{t(name)}</span>
              </div>
              <p className="text-xs text-muted-warm">{t(description)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Color */}
      <div className="border-t border-muted-line/10 pt-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
          {t("igBrandColor")}
        </h3>

        <div className="mb-4 flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => onBrandColorChange(e.target.value)}
            className="h-12 w-16 cursor-pointer rounded-lg border border-muted-line/40"
          />
          <div>
            <p className="text-xs text-muted-warm">{t("igCurrentColor")}</p>
            <p className="font-mono text-sm font-semibold text-ink">{brandColor.toUpperCase()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-warm">{t("igPresetColors")}</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {BRAND_COLOR_PRESETS.map(({ name, color }) => (
              <button
                key={color}
                onClick={() => onBrandColorChange(color)}
                className={`flex items-center gap-2 rounded-lg border-2 p-2 transition ${
                  brandColor.toUpperCase() === color.toUpperCase()
                    ? "border-indigo bg-indigo/5"
                    : "border-muted-line/30 hover:border-indigo/50"
                }`}
              >
                <div
                  className="h-5 w-5 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-semibold text-ink">{t(name)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
