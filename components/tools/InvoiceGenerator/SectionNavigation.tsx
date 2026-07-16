"use client";

import { Building2, Users, FileText, ShoppingCart, BookOpen, Banknote, Palette, Eye, EyeOff } from "lucide-react";

interface SectionNavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  showPreview: boolean;
  onPreviewToggle: (show: boolean) => void;
}

const SECTIONS = [
  { id: "business", label: "Business Details", icon: Building2 },
  { id: "client", label: "Bill To", icon: Users },
  { id: "invoice", label: "Invoice Details", icon: FileText },
  { id: "items", label: "Line Items", icon: ShoppingCart },
  { id: "bank", label: "Bank & Payment", icon: Banknote },
  { id: "notes", label: "Notes & Terms", icon: BookOpen },
  { id: "template", label: "Template", icon: Palette },
];

export function SectionNavigation({
  activeSection,
  onSectionChange,
  showPreview,
  onPreviewToggle,
}: SectionNavigationProps) {
  return (
    <div className="sticky top-0 z-40 border-b border-muted-line/20 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Navigation Buttons */}
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onSectionChange(id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeSection === id
                    ? "bg-indigo text-white"
                    : "border border-muted-line/30 text-muted hover:border-indigo hover:text-indigo"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => onPreviewToggle(!showPreview)}
            className="inline-flex items-center gap-2 rounded-lg border border-muted-line/30 px-3 py-2 text-sm font-semibold text-muted transition hover:border-indigo hover:text-indigo"
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span className="hidden sm:inline">Hide Preview</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Show Preview</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
