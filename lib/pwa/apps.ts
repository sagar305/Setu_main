// Installable ("Add to Home Screen") product apps.
//
// Each free product app installs as its own home-screen app with its own
// icon, scoped to its page, so a shop that installs the POS and a clinic that
// installs the clinic app each get a direct icon that opens straight into the
// tool. Manifests are served from app/app-manifest/[id]/route.ts; icons live in
// public/pwa/<id>-{180,192,512}.png.
//
// Server-only in practice: client components receive a PwaApp as props and
// import only its type, so unlaunched (feature-flagged) apps never reach the
// browser bundle.

import {
  pharmacySoftwareEnabled,
  rentalSoftwareEnabled,
  repairSoftwareEnabled,
  tokenSystemEnabled,
} from "@/lib/featureFlags";

export type PwaApp = {
  id: string;
  /** Full name, shown on install prompts and app switchers. */
  name: string;
  /** Home-screen label: keep it under ~12 characters so it isn't truncated. */
  shortName: string;
  description: string;
  /** The product page; it is both the start URL and the app's scope. */
  path: string;
  /** Build-time feature flag; omitted = always live. */
  enabled?: () => boolean;
};

export const PWA_APPS = [
  {
    id: "pos",
    name: "Setu Browser POS",
    shortName: "Setu POS",
    description: "Free billing, inventory and udhaar for small shops. Works offline.",
    path: "/products/browser-based-pos",
  },
  {
    id: "dine",
    name: "Setu Restaurant POS",
    shortName: "Setu Dine",
    description: "Free restaurant POS with tables, KOT printing and GST billing. Works offline.",
    path: "/products/free-restaurant-pos",
  },
  {
    id: "tuition",
    name: "Setu Tuition Manager",
    shortName: "Tuition",
    description: "Free tuition software for attendance, monthly fees and fee receipts. Works offline.",
    path: "/products/free-tuition-software",
  },
  {
    id: "clinic",
    name: "Setu Clinic",
    shortName: "Clinic",
    description: "Free clinic software for prescriptions, patient records and billing. Works offline.",
    path: "/products/free-clinic-software",
  },
  {
    id: "pharmacy",
    name: "Setu Pharmacy",
    shortName: "Pharmacy",
    description: "Free pharmacy billing with batch-wise stock and expiry tracking.",
    path: "/products/free-pharmacy-software",
    enabled: pharmacySoftwareEnabled,
  },
  {
    id: "rental",
    name: "Setu Rental Manager",
    shortName: "Rentals",
    description: "Free rental software for tent houses and equipment hire.",
    path: "/products/free-rental-software",
    enabled: rentalSoftwareEnabled,
  },
  {
    id: "repair",
    name: "Setu Repair Shop",
    shortName: "Repairs",
    description: "Free job card software for mobile and laptop repair shops.",
    path: "/products/free-repair-shop-software",
    enabled: repairSoftwareEnabled,
  },
  {
    id: "token",
    name: "Setu Token System",
    shortName: "Tokens",
    description: "Free token system that calls numbers aloud and shows them on a TV.",
    path: "/products/free-token-system",
    enabled: tokenSystemEnabled,
  },
  {
    id: "bank",
    name: "Setu Bank Statement Analyzer",
    shortName: "Statements",
    description: "Classify and reconcile bank statements privately in your browser.",
    path: "/products/bank-statement-analyzer",
  },
] as const satisfies readonly PwaApp[];

export type PwaAppId = (typeof PWA_APPS)[number]["id"];

/** A live app by id; flagged-off apps are treated as unknown. */
export function getPwaApp(id: string): PwaApp | undefined {
  const app: PwaApp | undefined = PWA_APPS.find((entry) => entry.id === id);
  return app && (app.enabled?.() ?? true) ? app : undefined;
}

export function livePwaApps(): PwaApp[] {
  return PWA_APPS.filter((app: PwaApp) => app.enabled?.() ?? true);
}

export const PWA_THEME_COLOR = "#26306B";
export const PWA_BACKGROUND_COLOR = "#F2EFE7";

/** Metadata for a product's layout.tsx: links the manifest and home-screen icon. */
export function pwaMetadata(id: PwaAppId) {
  const app = getPwaApp(id);
  if (!app) return {};
  return {
    manifest: `/app-manifest/${app.id}`,
    appleWebApp: {
      capable: true,
      title: app.shortName,
      statusBarStyle: "default" as const,
    },
    icons: {
      icon: "/icon.svg",
      apple: `/pwa/${app.id}-180.png`,
    },
  };
}
