"use client";

import { FileText, Sparkles, Palette } from "lucide-react";

interface TemplateSelectorProps {
  selectedTemplate: "classic" | "modern" | "colorful";
  brandColor: string;
  onTemplateChange: (template: "classic" | "modern" | "colorful") => void;
  onBrandColorChange: (color: string) => void;
}

const BRAND_COLOR_PRESETS = [
  { name: "Indigo", color: "#26306B" },
  { name: "Blue", color: "#2196F3" },
  { name: "Green", color: "#4CAF50" },
  { name: "Orange", color: "#FF9800" },
  { name: "Purple", color: "#9C27B0" },
  { name: "Red", color: "#F44336" },
  { name: "Teal", color: "#009688" },
  { name: "Pink", color: "#E91E63" },
];

const TEMPLATES = [
  {
    id: "classic" as const,
    name: "Classic",
    description: "Formal & Traditional",
    icon: FileText,
  },
  {
    id: "modern" as const,
    name: "Modern",
    description: "Clean & Minimal",
    icon: Sparkles,
  },
  {
    id: "colorful" as const,
    name: "Colorful",
    description: "Creative & Bold",
    icon: Palette,
  },
];

export function TemplateSelector({
  selectedTemplate,
  brandColor,
  onTemplateChange,
  onBrandColorChange,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
          Invoice Template
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
                <span className="font-semibold text-ink">{name}</span>
              </div>
              <p className="text-xs text-muted-warm">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Color */}
      <div className="border-t border-muted-line/10 pt-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
          Brand Color
        </h3>

        <div className="mb-4 flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => onBrandColorChange(e.target.value)}
            className="h-12 w-16 cursor-pointer rounded-lg border border-muted-line/40"
          />
          <div>
            <p className="text-xs text-muted-warm">Current Color</p>
            <p className="font-mono text-sm font-semibold text-ink">{brandColor.toUpperCase()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-warm">Preset Colors</p>
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
                <span className="text-xs font-semibold text-ink">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
