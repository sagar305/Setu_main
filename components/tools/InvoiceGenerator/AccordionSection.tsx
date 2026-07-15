"use client";

import { ChevronDown, Lock, LockOpen } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  children: React.ReactNode;
}

export function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  isLocked = false,
  onToggleLock,
  children,
}: AccordionSectionProps) {
  return (
    <div className={`border-b border-muted-line/20 ${isLocked ? "bg-gray-50" : ""}`}>
      <div className="flex w-full items-center justify-between px-6 py-4 transition hover:bg-cream/30">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-3"
        >
          <div className="text-indigo">{icon}</div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">
            {title}
          </h3>
          {isLocked && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Locked</span>}
        </button>
        <div className="flex items-center gap-2">
          {onToggleLock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock();
              }}
              className="p-2 text-muted hover:text-indigo transition"
              title={isLocked ? "Unlock section" : "Lock section"}
            >
              {isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <LockOpen className="h-4 w-4" />
              )}
            </button>
          )}
          <ChevronDown
            className={`h-5 w-5 text-muted transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      {isOpen && (
        <div className={`space-y-6 border-t border-muted-line/20 px-6 py-6 ${isLocked ? "bg-gray-50 opacity-75 pointer-events-none" : "bg-cream/10"}`}>
          {children}
        </div>
      )}
    </div>
  );
}
