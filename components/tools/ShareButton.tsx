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
  const [isPreparing, setIsPreparing] = useState(false);
  // Files generated on a previous tap, waiting for a fresh tap to share.
  // iOS only honors navigator.share() when called immediately on a tap, so
  // when file generation takes too long we cache the result and share it
  // synchronously on the next tap.
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

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

  const shareNow = (files: File[]) => {
    const shareData: ShareData = { title, text };
    if (files.length > 0 && canShareFiles(files)) {
      shareData.files = files;
    }
    // navigator.share must be invoked synchronously within the tap handler
    return navigator.share(shareData);
  };

  const handleClick = async () => {
    if (isPreparing) return;

    // Second tap: file is ready — share it within this fresh tap gesture
    if (pendingFiles) {
      const files = pendingFiles;
      try {
        await shareNow(files);
        setPendingFiles(null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User closed the share sheet — done with this file
          setPendingFiles(null);
        } else {
          console.error("Share failed:", err);
          alert("Could not open the share menu. Please try again.");
        }
      }
      return;
    }

    // First tap: generate the file(s)
    setIsPreparing(true);
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
        setIsPreparing(false);
        return;
      }
    }
    setIsPreparing(false);

    // Try to share right away — works when the browser still honors the tap
    try {
      await shareNow(files);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User closed the share sheet — not an error
      } else if (files.length > 0) {
        // The browser no longer counts this as a tap gesture (iOS).
        // Keep the file ready and ask for one more tap.
        setPendingFiles(files);
      } else {
        console.error("Share failed:", err);
        alert("Could not open the share menu. Please try again.");
      }
    }
  };

  if (!isSupported || !isMobile) {
    return null;
  }

  const label = isPreparing
    ? "Preparing..."
    : pendingFiles
      ? "Tap to share"
      : "Share";

  return (
    <button
      onClick={handleClick}
      disabled={isPreparing}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        pendingFiles
          ? "animate-pulse border-indigo bg-indigo text-white"
          : "border-indigo/30 bg-indigo/5 text-indigo hover:bg-indigo/10"
      }`}
      title="Share"
    >
      {isPreparing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      <span>{label}</span>
    </button>
  );
}
