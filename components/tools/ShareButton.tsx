"use client";

import { useState, useEffect } from "react";
import { Share2, Loader2 } from "lucide-react";
import { canShare, canShareFiles } from "@/lib/share";

interface ShareButtonProps {
  title: string;
  text: string;
  invoiceNumber?: string;
  phoneNumber?: string;
  generateFiles?: () => Promise<File[]>;
}

export function ShareButton({ title, text, generateFiles }: ShareButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

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

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    let files: File[] = [];
    if (generateFiles) {
      try {
        files = await generateFiles();
      } catch (err) {
        alert(
          err instanceof Error && err.message
            ? err.message
            : "Could not prepare the file to share. Please try again."
        );
        setIsSharing(false);
        return;
      }
    }

    const shareData: ShareData = { title, text };
    if (files.length > 0 && canShareFiles(files)) {
      shareData.files = files;
    }

    try {
      await navigator.share(shareData);
    } catch (err) {
      // AbortError means the user closed the share sheet — not an error
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error("Share failed:", err);
        alert("Could not open the share menu. Please try again.");
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (!isSupported || !isMobile) {
    return null;
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/10 disabled:cursor-not-allowed disabled:opacity-50"
      title="Share"
    >
      {isSharing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      <span>{isSharing ? "Preparing..." : "Share"}</span>
    </button>
  );
}
