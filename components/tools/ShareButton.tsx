"use client";

import { useState, useEffect } from "react";
import { Share2, Send } from "lucide-react";
import { shareViaWeb, canShare, getWhatsAppShareUrl, getEmailShareUrl } from "@/lib/share";

interface ShareButtonProps {
  title: string;
  text: string;
  invoiceNumber?: string;
  phoneNumber?: string;
  generateFiles?: () => Promise<File[]>;
}

export function ShareButton({
  title,
  text,
  invoiceNumber,
  phoneNumber,
  generateFiles,
}: ShareButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsSupported(canShare());
    // Check if device is mobile/tablet (less than 1024px width)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleWebShare = async () => {
    const shareData: any = {
      title,
      text,
    };

    if (generateFiles) {
      try {
        const files = await generateFiles();
        if (files && files.length > 0) {
          shareData.files = files;
        }
      } catch (err) {
        console.error("Failed to generate share files:", err);
      }
    }

    const success = await shareViaWeb(shareData);
    if (success) {
      setShowMenu(false);
    }
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = getWhatsAppShareUrl(text, phoneNumber);
    window.open(whatsappUrl, "_blank");
    setShowMenu(false);
  };

  const handleEmailShare = () => {
    const emailUrl = getEmailShareUrl(title, text);
    window.location.href = emailUrl;
    setShowMenu(false);
  };

  if (!isSupported || !isMobile) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/10"
        title="Share invoice"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 z-50 rounded-lg border border-muted-line/20 bg-white shadow-lg overflow-hidden">
          <button
            onClick={handleWebShare}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream text-left"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 transition hover:bg-cream text-left"
          >
            <Send className="h-4 w-4" />
            WhatsApp
          </button>

          <button
            onClick={handleEmailShare}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream text-left border-t border-muted-line/10"
          >
            <span>✉</span>
            Email
          </button>
        </div>
      )}
    </div>
  );
}
