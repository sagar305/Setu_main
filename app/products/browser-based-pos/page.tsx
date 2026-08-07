import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Banknote,
  Barcode,
  Blocks,
  BookUser,
  CalendarRange,
  ClipboardList,
  Copy,
  CreditCard,
  DatabaseBackup,
  FileSpreadsheet,
  Globe,
  HandCoins,
  Hash,
  HardDrive,
  History,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Lock,
  Palette,
  PauseCircle,
  Percent,
  PieChart,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
  Ruler,
  ScanBarcode,
  Search,
  Share2,
  Sheet,
  ShieldCheck,
  Tags,
  Timer,
  TrendingUp,
  Trophy,
  TriangleAlert,
  Undo2,
  UserPlus,
  Users,
  WifiOff,
  Zap,
} from "lucide-react";
import { FreePosApp } from "@/components/tools/FreePos/FreePosApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { POS_TOOLS, POS_TOOL_CATEGORIES } from "@/lib/pos/posTools";
import { freeOffer } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Browser Based POS — Free, Offline, No Login | Setu",
  description:
    "Free browser-based POS for small shops. Barcode billing, held carts, udhaar, inventory, reports, PIN lock and Sheet sync — works offline, no signup.",
  keywords: [
    "browser based POS",
    "free POS",
    "offline POS",
    "browser POS",
    "free billing software",
    "POS for small business",
    "free POS software India",
    "no login POS",
    "retail billing",
    "udhaar POS",
    "POS with Google Sheet sync",
  ],
  alternates: {
    canonical: "/products/browser-based-pos",
  },
  openGraph: {
    title: "Browser Based POS - Free, Offline, No Login",
    description:
      "Bill customers, manage products and inventory, print receipts. 100% free, works offline, data stays in your browser.",
    url: "/products/browser-based-pos",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Browser Based POS",
      },
    ],
  },
};

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

type FeatureSection = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: Feature[];
};

/** Quick badges under the hero — the things people scan for first. */
const HIGHLIGHTS: { icon: ComponentType<{ className?: string }>; label: string }[] = [
  { icon: WifiOff, label: "Works offline" },
  { icon: ScanBarcode, label: "Barcode ready" },
  { icon: PauseCircle, label: "Hold & recall carts" },
  { icon: HandCoins, label: "Udhaar / credit sales" },
  { icon: Lock, label: "PIN counter lock" },
  { icon: Sheet, label: "Google Sheet sync" },
  { icon: Printer, label: "80mm / 58mm / A4" },
  { icon: Globe, label: "Any currency" },
];

const CORE: Feature[] = [
  {
    icon: Zap,
    title: "Fast billing",
    description:
      "Search or scan, tap a price tile, charge. A whole sale takes seconds, and the receipt opens the moment it is saved.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    description:
      "After the first visit the POS is cached in your browser. Lose the internet mid-rush and billing, printing and stock all keep going.",
  },
  {
    icon: HardDrive,
    title: "Your data, your device",
    description:
      "Products, orders, customers and settings live in your browser's IndexedDB. No cloud account, no server, nothing to cancel.",
  },
  {
    icon: Receipt,
    title: "Receipts & PDF",
    description:
      "Print to a thermal roll or an A4 sheet, download a PDF, or send a share link — all generated on your device.",
  },
  {
    icon: Layers,
    title: "Inventory tracking",
    description:
      "Opening stock, stock sold, current stock — with low-stock and out-of-stock flags and a full movement log behind every change.",
  },
  {
    icon: DatabaseBackup,
    title: "Backup & restore",
    description:
      "Export everything to a single JSON file and restore it on any device. Five CSV exports open straight in Excel.",
  },
];

const COUNTER: FeatureSection = {
  eyebrow: "At the counter",
  title: "Built for the minute a customer is waiting",
  subtitle:
    "The Sell screen is the one your staff live on, so everything on it is one tap or one scan away.",
  items: [
    {
      icon: ScanBarcode,
      title: "Scan or search",
      description:
        "One box searches name, SKU and barcode. Any USB or Bluetooth scanner that types works — scan, and the item drops into the cart on Enter.",
    },
    {
      icon: LayoutGrid,
      title: "Tap-to-add price tiles",
      description:
        "Every product is a tile with its price and live stock count. Low stock turns amber, out of stock turns red, so nobody sells air by accident.",
    },
    {
      icon: Percent,
      title: "Discounts, flat or percent",
      description:
        "Knock off a round amount or a percentage on the whole bill. Subtotal, discount, tax and total recalculate as you type.",
    },
    {
      icon: PauseCircle,
      title: "Hold and recall carts",
      description:
        "Park a cart with a note like “Table 4” or “blue shirt”, serve the next customer, and pull the first one back exactly as it was.",
    },
    {
      icon: CreditCard,
      title: "Your payment methods",
      description:
        "Cash, UPI and Card are ready on day one. Add Bank Transfer, Wallet or anything else you actually get paid by.",
    },
    {
      icon: HandCoins,
      title: "Credit (Udhaar)",
      description:
        "Switch on the Customer Ledger and a Credit button appears for saved customers — the bill goes to their ledger balance instead of the till.",
    },
  ],
};

const CATALOGUE: FeatureSection = {
  eyebrow: "Catalogue & stock",
  title: "A product list that survives a real shop",
  subtitle:
    "Prices, tax treatment, units and stock movements — set once on the product, applied on every bill.",
  items: [
    {
      icon: Tags,
      title: "Categories you control",
      description:
        "Create a category while adding a product, rename it later, filter the whole list by it. Search covers names, SKUs and barcodes too.",
    },
    {
      icon: Barcode,
      title: "SKU & barcode per item",
      description:
        "Store the code printed on the packet, then scan it at billing. The Barcode Generator can print codes for items that never had one.",
    },
    {
      icon: Percent,
      title: "Tax the way you price",
      description:
        "Set a default rate once, or override it per product — and mark whether the price already includes tax or gets it added on top.",
    },
    {
      icon: Banknote,
      title: "Cost price and margin",
      description:
        "Record what an item cost you alongside what you sell it for, so the profit tools and ABC analysis have something real to work with.",
    },
    {
      icon: Ruler,
      title: "Units and descriptions",
      description:
        "Sell in pcs, kg, litre, plate — whatever fits. Duplicate a similar product to add the next size in a couple of seconds.",
    },
    {
      icon: History,
      title: "Stock movement log",
      description:
        "Add, reduce or correct stock with a note. Every opening balance, sale, restock and adjustment is kept with the resulting stock level.",
    },
  ],
};

const RECEIPTS: FeatureSection = {
  eyebrow: "Receipts & sharing",
  title: "Hand it over, print it, or send it",
  subtitle:
    "The bill is the one thing every customer takes home, so it prints on what you own and carries your details.",
  items: [
    {
      icon: Printer,
      title: "Thermal and A4",
      description:
        "80mm and 58mm thermal rolls (Epson TM and friends) plus plain A4. Pick the paper size in Settings and printing just matches it.",
    },
    {
      icon: Hash,
      title: "Your invoice numbers",
      description:
        "Set the prefix and the next number, and every bill continues the series — including after a restore from backup.",
    },
    {
      icon: ShieldCheck,
      title: "Business details & GSTIN",
      description:
        "Name, phone, address, email and tax number print on the receipt, with your own footer line at the bottom.",
    },
    {
      icon: Palette,
      title: "Custom receipt designs",
      description:
        "Design a receipt in the Receipt Generator — logo, fields, footer — and it becomes a printing option inside the POS.",
    },
    {
      icon: Share2,
      title: "Share link & WhatsApp",
      description:
        "Send a bill as a link the customer opens in any browser, straight to their WhatsApp number or copied to anywhere else.",
    },
    {
      icon: QrCode,
      title: "QR and UPI on the link",
      description:
        "The share sheet shows a QR of the link for a phone across the counter, and adds your UPI ID so the customer can pay from the bill.",
    },
  ],
};

const NUMBERS: FeatureSection = {
  eyebrow: "Know your numbers",
  title: "The day, the week and the slow-moving stock",
  subtitle:
    "Reporting is not a paid tier here. Everything the POS records, you can read back and export.",
  items: [
    {
      icon: LayoutDashboard,
      title: "Dashboard at a glance",
      description:
        "Today's sales, total orders, customers and products up top; quick actions and your most recent bills right underneath.",
    },
    {
      icon: CalendarRange,
      title: "Any date range",
      description:
        "Today, yesterday, last 7 days, this month — or pick your own from and to dates for a custom stretch.",
    },
    {
      icon: TrendingUp,
      title: "Sales, orders, average bill",
      description:
        "Total sales, how many orders made it up, and the average order value for the range you chose.",
    },
    {
      icon: PieChart,
      title: "Payment breakdown",
      description:
        "How much came in by cash, UPI, card or any method you added — with the count of sales behind each one.",
    },
    {
      icon: Trophy,
      title: "Best sellers & stock status",
      description:
        "Top products by quantity and revenue, plus a live list of everything low on stock or already out of it.",
    },
    {
      icon: FileSpreadsheet,
      title: "Five CSV exports",
      description:
        "Products, customers, orders, the sales report for your date range and the full inventory log — UTF-8, so Excel opens them cleanly.",
    },
  ],
};

const CUSTOMERS: FeatureSection = {
  eyebrow: "Customers",
  title: "Remember the regulars",
  subtitle:
    "A customer book that fills itself as you bill, and feeds the ledger and statement tools when you need to chase money.",
  items: [
    {
      icon: UserPlus,
      title: "Add mid-sale",
      description:
        "A walk-in becomes a saved customer without leaving the billing screen — name, phone, email, address and a notes line.",
    },
    {
      icon: BookUser,
      title: "Purchase history",
      description:
        "Open a customer to see every bill they have taken, oldest to newest, and jump straight to any one of them.",
    },
    {
      icon: Users,
      title: "Lifetime value",
      description:
        "Order count and total spent sit at the top of each customer, so you know who is worth a discount.",
    },
    {
      icon: HandCoins,
      title: "Udhaar that adds up",
      description:
        "Credit sales post to the Customer Ledger automatically, and the statement and aging tools read the same book.",
    },
  ],
};

const SAFETY: FeatureSection = {
  eyebrow: "Safety & continuity",
  title: "Locked at the till, backed up off it",
  subtitle:
    "Data that only lives in one browser needs a lock in front of it and a copy behind it. Both are built in.",
  items: [
    {
      icon: Lock,
      title: "PIN counter lock",
      description:
        "Set a PIN and the POS asks for it when the tab opens. Lock the screen by hand any time you step away from the counter.",
    },
    {
      icon: Timer,
      title: "Idle auto-lock",
      description:
        "Choose how many minutes of inactivity lock the till on their own — nothing on screen responds until the right PIN is entered.",
    },
    {
      icon: DatabaseBackup,
      title: "One-file backup",
      description:
        "Export a POS_BACKUP.json with every product, order, customer and setting, and restore it on any device or browser.",
    },
    {
      icon: TriangleAlert,
      title: "Backup nudges",
      description:
        "Settings shows when you last backed up and warns you plainly when you have sales that have never been exported.",
    },
    {
      icon: Sheet,
      title: "Google Sheet sync",
      description:
        "Connect your own sheet and orders, products and customers keep updating in it — browser to your Google account, never through us.",
    },
    {
      icon: Undo2,
      title: "Restore from the sheet",
      description:
        "If this browser's data is ever cleared, pull the whole workspace back out of your connected sheet and carry on.",
    },
  ],
};

const OPERATIONS: Feature[] = [
  {
    icon: Search,
    title: "Order history you can filter",
    description:
      "Every bill stays searchable by invoice number, with all, completed and cancelled views.",
  },
  {
    icon: RotateCcw,
    title: "Cancel puts stock back",
    description:
      "Cancelling an order returns each tracked item to stock and writes the movement into the inventory log.",
  },
  {
    icon: Copy,
    title: "Reprint any old bill",
    description:
      "Open a past order to view, print, PDF or re-share its receipt, exactly as it was issued.",
  },
  {
    icon: Globe,
    title: "Any currency",
    description:
      "Rupee by default, and every other ISO currency is a dropdown away — amounts format for the one you pick.",
  },
  {
    icon: ClipboardList,
    title: "Honest stock warnings",
    description:
      "Short on stock? The POS says so and still lets the sale through, because the customer is standing there.",
  },
  {
    icon: WifiOff,
    title: "An offline banner, not an error",
    description:
      "Drop the connection and a quiet “Offline — sales still work” badge appears instead of a broken screen.",
  },
];

const TOOL_CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "Sales & billing": Receipt,
  "Money in": HandCoins,
  "Money out": Banknote,
  "Reports & analysis": PieChart,
};

const FAQ_ITEMS = [
  {
    question: "Is this POS really free?",
    answer:
      "Yes. There is no login, no subscription and no hidden tier. The POS runs entirely in your browser and stores everything on your device.",
  },
  {
    question: "Does it work without internet?",
    answer:
      "Yes. After your first visit the POS is cached in your browser, so you can open it, bill customers and print receipts completely offline. Your data is stored locally in IndexedDB and survives browser restarts.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "All data — products, customers, orders and settings — is stored in your browser's IndexedDB on your device. Nothing is uploaded to any server. Use the backup feature to export a POS_BACKUP.json file you can restore on any device.",
  },
  {
    question: "Can I print receipts on a thermal printer?",
    answer:
      "Yes. Receipts print on 80mm and 58mm thermal roll printers (like Epson TM series) as well as regular A4 printers — pick your paper size in Settings. You can also download any receipt as a PDF or send it as a share link.",
  },
  {
    question: "What happens if I clear my browser data?",
    answer:
      "Clearing site data deletes your POS data, so export a backup regularly. The POS tells you when you last backed up, and a backup file restores everything — products, orders, customers and settings. If you connected a Google Sheet, you can also restore the whole workspace from it.",
  },
  {
    question: "Can it sync my data to a Google Sheet?",
    answer:
      "Yes. Connect your own Google Sheet (Settings → Google Sheet sync) and the POS automatically keeps your orders, products and customers updated in it. Data goes directly from your browser to your Google account — never through our servers. If your browser data is ever lost, you can restore the whole POS from that sheet.",
  },
  {
    question: "Does it support barcode scanners?",
    answer:
      "Yes. Any USB or Bluetooth scanner that types the barcode works: scan into the billing search box and the matching product is added to the cart instantly.",
  },
  {
    question: "Can I hold a bill and come back to it?",
    answer:
      "Yes. Hold parks the current cart with a note you choose — a table number, a customer's name — and frees the counter for the next person. The Held button brings any parked cart back with its items, discount and customer intact.",
  },
  {
    question: "Can I give credit (udhaar) to regular customers?",
    answer:
      "Yes. With the Customer Ledger switched on in Settings → Connected tools, a Credit (Udhaar) payment option appears for saved customers. The full amount is added to that customer's ledger balance instead of being collected at the counter, and the statement and aging tools read the same ledger.",
  },
  {
    question: "Can I stop staff from opening the POS?",
    answer:
      "Yes. Set a PIN under Settings → Counter lock. The POS then asks for it whenever the tab opens, you can lock the screen by hand at any time, and you can have it lock itself after a chosen number of idle minutes.",
  },
  {
    question: "Does it only work in Indian rupees?",
    answer:
      "No. The rupee is the default, but you can pick any ISO currency in Settings and every amount, receipt and report formats to it. UPI payment options only appear for rupee bills.",
  },
  {
    question: "What else can I plug into the POS?",
    answer:
      `Setu has ${POS_TOOLS.length} free tools that read the same on-device data — invoicing, quotations, customer ledger, expenses, purchase register, profit and loss, stock register and more. Switch one on in Settings → Connected tools and it already knows your business, customers, products and sales.`,
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Browser Based POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Free browser-based point-of-sale for small businesses. Bill customers, manage products and inventory, and print thermal receipts. Works offline, with all data stored on the device.",
  featureList: [
    "Barcode scanning and product search",
    "Hold and recall parked carts",
    "Flat or percentage discounts",
    "Custom payment methods and credit (udhaar) sales",
    "Inventory tracking with a full stock movement log",
    "Thermal (80mm/58mm) and A4 receipt printing",
    "PDF receipts and shareable invoice links with UPI",
    "Sales, payment and best-seller reports with CSV exports",
    "PIN counter lock with idle auto-lock",
    "JSON backup and restore",
    "One-way Google Sheet sync and restore",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/browser-based-pos" }),
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

function SectionIntro({ section, onDark = false }: { section: FeatureSection; onDark?: boolean }) {
  return (
    <FadeIn>
      <div className="mx-auto max-w-2xl text-center">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.3em] ${
            onDark ? "text-saffron" : "text-muted-warm"
          }`}
        >
          {section.eyebrow}
        </p>
        <h2
          className={`mt-4 text-3xl font-bold tracking-tight ${
            onDark ? "text-cream-paper" : "text-ink"
          }`}
        >
          {section.title}
        </h2>
        <p className={`mt-4 leading-relaxed ${onDark ? "text-cream-paper/80" : "text-muted"}`}>
          {section.subtitle}
        </p>
      </div>
    </FadeIn>
  );
}

/** The animated card grid every feature section on this page uses. */
function FeatureCards({ items, onDark = false }: { items: Feature[]; onDark?: boolean }) {
  return (
    <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <FadeInStaggerItem key={item.title}>
            <div
              className={`group h-full rounded-xl border p-6 transition duration-300 ${
                onDark
                  ? "border-cream-paper/15 bg-white/5 hover:border-saffron/40 hover:bg-white/10"
                  : "border-muted-line/20 bg-white shadow-sm hover:-translate-y-1 hover:border-indigo/30 hover:shadow-md"
              }`}
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg transition duration-300 ${
                  onDark
                    ? "bg-saffron/20 group-hover:bg-saffron/30"
                    : "bg-indigo/10 group-hover:bg-indigo group-hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    onDark ? "text-saffron" : "text-indigo group-hover:text-white"
                  }`}
                />
              </div>
              <h3 className={`mb-2 font-bold ${onDark ? "text-cream-paper" : "text-ink"}`}>
                {item.title}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  onDark ? "text-cream-paper/75" : "text-muted"
                }`}
              >
                {item.description}
              </p>
            </div>
          </FadeInStaggerItem>
        );
      })}
    </FadeInStagger>
  );
}

export default function BrowserBasedPosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Page Header */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
              <span className="text-sm font-semibold text-indigo">Free Tool — Works Offline</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Browser Based POS
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Bill customers, manage products and track inventory — right from your browser. No
              login, no subscription, no internet needed.
            </p>
          </div>
        </FadeIn>

        <FadeInStagger className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {HIGHLIGHTS.map((highlight) => {
            const Icon = highlight.icon;
            return (
              <FadeInStaggerItem key={highlight.label}>
                <span className="inline-flex items-center gap-2 rounded-full border border-muted-line/30 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo/40 hover:text-indigo">
                  <Icon className="h-4 w-4 text-indigo" />
                  {highlight.label}
                </span>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </section>

      {/* The POS app */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <FreePosApp />
      </section>

      {/* Core capabilities */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              Everything a small shop needs
            </h2>
          </FadeIn>
          <FeatureCards items={CORE} />
        </div>
      </section>

      {/* Billing screen */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={COUNTER} />
          <FeatureCards items={COUNTER.items} />
        </div>
      </section>

      {/* Products & inventory */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={CATALOGUE} />
          <FeatureCards items={CATALOGUE.items} />
        </div>
      </section>

      {/* Receipts */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={RECEIPTS} />
          <FeatureCards items={RECEIPTS.items} />
        </div>
      </section>

      {/* Reports — on indigo, because this is the part owners come back for */}
      <section className="bg-indigo py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={NUMBERS} onDark />
          <FeatureCards items={NUMBERS.items} onDark />
        </div>
      </section>

      {/* Customers */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={CUSTOMERS} />
          <FeatureCards items={CUSTOMERS.items} />
        </div>
      </section>

      {/* Lock, backup, sync */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={SAFETY} />
          <FeatureCards items={SAFETY.items} />
        </div>
      </section>

      {/* Connected tools */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Connected tools
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                {POS_TOOLS.length} free tools that already know your shop
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Switch one on in Settings and it opens with your business details, customers,
                products and sales already in it — same device, same data, nothing to re-type. A
                few also unlock behaviour inside the POS itself.
              </p>
            </div>
          </FadeIn>

          <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-2">
            {POS_TOOL_CATEGORIES.map((category) => {
              const tools = POS_TOOLS.filter((tool) => tool.category === category);
              const Icon = TOOL_CATEGORY_ICONS[category] ?? Blocks;
              return (
                <FadeInStaggerItem key={category}>
                  <div className="h-full rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo/30 hover:shadow-md">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo/10">
                        <Icon className="h-4 w-4 text-indigo" />
                      </span>
                      <h3 className="font-bold text-ink">{category}</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {tools.map((tool) => (
                        <li key={tool.slug}>
                          <Link href={tool.route} className="group block text-sm">
                            <span className="font-semibold text-ink transition group-hover:text-indigo">
                              {tool.name}
                            </span>{" "}
                            <span className="text-muted">{tool.description}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeInStaggerItem>
              );
            })}
          </FadeInStagger>
        </div>
      </section>

      {/* Day-to-day details */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              The small things that stop a busy day going wrong
            </h2>
          </FadeIn>
          <FeatureCards items={OPERATIONS} />
        </div>
      </section>

      {/* Info */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="space-y-8">
            <FadeIn>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">Who is this POS for?</h2>
                <p className="mb-4 text-muted">
                  Built for small businesses that want fast billing without paying for software or
                  creating accounts:
                </p>
                <ul className="space-y-2 text-muted">
                  {[
                    "Small retailers and local shops",
                    "Small restaurants, cafes and food stalls",
                    "Home businesses and independent sellers",
                    "Freelancers and service providers",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="text-indigo">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">Keep your data safe</h2>
                <div className="rounded-lg border-l-4 border-saffron bg-saffron/10 p-4">
                  <p className="text-sm text-muted">
                    <strong>Important:</strong> your data lives only in this browser. If you clear
                    site data or uninstall the browser, it is gone. Export a backup (Settings →
                    Backup) regularly and keep the file somewhere safe — or connect a Google Sheet
                    and the POS keeps a copy there for you.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">
                  Need more? Try Setu&apos;s full POS
                </h2>
                <p className="mb-4 text-muted">
                  When you outgrow a single browser — multiple counters, cloud sync, staff
                  accounts, GST reports — take a look at our full products:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/products/restaurant-pos"
                    className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
                  >
                    Setu Dine (Restaurant POS)
                  </Link>
                  <Link
                    href="/products/retail"
                    className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
                  >
                    Setu Retail
                  </Link>
                  <Link
                    href="/tools/invoice-generator"
                    className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
                  >
                    Invoice Generator
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Faq headline="Browser Based POS — questions" items={FAQ_ITEMS} />
    </>
  );
}
