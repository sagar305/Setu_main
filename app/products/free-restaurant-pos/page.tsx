import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Banknote,
  BarChart3,
  Bike,
  ChefHat,
  ClipboardList,
  Clock,
  DatabaseBackup,
  Download,
  HandCoins,
  LayoutGrid,
  Lock,
  Merge,
  Percent,
  Printer,
  Receipt,
  Salad,
  Share2,
  ShoppingBag,
  Split,
  Sheet,
  Timer,
  TriangleAlert,
  Utensils,
  UtensilsCrossed,
  WifiOff,
} from "lucide-react";
import { FreeDineApp } from "@/components/tools/FreeDine/FreeDineApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Free Restaurant POS & Billing Software | Setu",
  description:
    "Free restaurant POS with table management, KOT printing, split bills and GST billing. Works offline in your browser, no signup, free forever for one outlet.",
  keywords: [
    "free restaurant billing software",
    "free KOT software",
    "restaurant POS free",
    "free restaurant management software India",
    "offline restaurant billing",
    "restaurant billing software",
    "KOT printing software",
    "free cafe POS",
    "GST restaurant bill",
    "split bill software",
  ],
  alternates: {
    canonical: "/products/free-restaurant-pos",
  },
  openGraph: {
    title: "Free Restaurant POS & Billing Software",
    description:
      "Tables, KOT, split bills, GST and day-end reports. Works offline, no signup, free forever for one restaurant.",
    url: "/products/free-restaurant-pos",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Free Restaurant POS",
      },
    ],
  },
};

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const HIGHLIGHTS: { icon: ComponentType<{ className?: string }>; label: string }[] = [
  { icon: WifiOff, label: "Works offline" },
  { icon: LayoutGrid, label: "Table management" },
  { icon: ChefHat, label: "KOT printing" },
  { icon: Split, label: "Split & merge bills" },
  { icon: Percent, label: "GST with CGST/SGST" },
  { icon: Salad, label: "Half / full & add-ons" },
  { icon: Printer, label: "80mm / 58mm / A4" },
  { icon: Lock, label: "PIN counter lock" },
];

const SERVICE: Feature[] = [
  {
    icon: LayoutGrid,
    title: "A floor you can read at a glance",
    description:
      "Every table with its state, running total and how long it has been sitting. Colour is never the only signal — each table says free, running or bill printed in words, so a washed-out screen in daylight still tells you the truth.",
  },
  {
    icon: Clock,
    title: "Bills that stay open",
    description:
      "A table's ticket stays open for as long as the meal lasts. Items go on in rounds, the kitchen gets each round as it is ordered, and the bill is settled at the end — which is the one thing a retail till cannot do.",
  },
  {
    icon: ChefHat,
    title: "KOT, one round at a time",
    description:
      "Sending a round prints a kitchen ticket with only that round on it, and no prices. Reprint it with one tap. No printer? The kitchen reads it off the screen, which is what most small kitchens do anyway.",
  },
  {
    icon: TriangleAlert,
    title: "Cancellations leave a trail",
    description:
      "Once an item has gone to the kitchen it cannot be quietly deleted. Pulling it prints a cancellation slip and stays on the ticket with its reason — that record is how you spot waste and mistakes at the end of the month.",
  },
  {
    icon: ShoppingBag,
    title: "Dine-in, takeaway and delivery",
    description:
      "Counter orders sit alongside the floor with their own tickets, customer name and delivery address. Everything lands in the same reports.",
  },
  {
    icon: Timer,
    title: "Built for the rush",
    description:
      "44px targets, one-handed on a phone, and a ticket panel that never shifts under your thumb. A mis-tap at eight o'clock bills the wrong table.",
  },
];

const MENU: Feature[] = [
  {
    icon: Utensils,
    title: "Half, full and every size between",
    description:
      "An item can carry as many variants as it needs, each with its own price. Ordering one asks which — no more guessing why the biryani rang up wrong.",
  },
  {
    icon: ClipboardList,
    title: "Add-ons and options",
    description:
      "Extra cheese at ₹40, no onion at ₹0, spice level pick-one. Option groups can be required or optional, single or multi-select, and they ride along to the kitchen ticket.",
  },
  {
    icon: Salad,
    title: "Veg, non-veg and egg marks",
    description:
      "Every dish carries the mark Indian menus are required to show, on screen and on the bill.",
  },
  {
    icon: Clock,
    title: "Sold out at 8pm, back tomorrow",
    description:
      "One tap hides a dish from ordering without deleting it, and one tap brings it back. Nobody should have to retype a dish because the paneer ran out.",
  },
  {
    icon: Download,
    title: "Import your menu from a spreadsheet",
    description:
      "Export to CSV, edit forty dishes in Excel, import it back — sizes and add-ons included. Typing a menu on a phone is nobody's evening.",
  },
  {
    icon: Receipt,
    title: "Per-dish tax rates",
    description:
      "Set a default and override it where you need to. Inclusive and exclusive pricing both work, and the bill shows the split either way.",
  },
];

const BILLING: Feature[] = [
  {
    icon: Split,
    title: "Split three ways, three ways",
    description:
      "By what each person ate, by an even share, or by amounts the table has agreed between themselves. Each part prints and pays on its own, and the parts always add back to the bill exactly.",
  },
  {
    icon: Merge,
    title: "Merge tables",
    description:
      "Two tables become one, with both tables' sent rounds kept in order. The absorbed table frees itself.",
  },
  {
    icon: Percent,
    title: "GST that stands up",
    description:
      "Subtotal, then discount, then service charge, then tax — in that order, because the order changes the number. CGST and SGST print per rate slab with the taxable value against each.",
  },
  {
    icon: HandCoins,
    title: "Service charge, honestly",
    description:
      "Off by default, because it is voluntary in India. When you do levy it, it is taxed as part of the supply and the bill tells the guest they can ask for it to be removed.",
  },
  {
    icon: Banknote,
    title: "₹500 cash and ₹300 by UPI",
    description:
      "One bill can take as many tenders as it needs. Add your own methods too — Swiggy, Zomato, Sodexo.",
  },
  {
    icon: Share2,
    title: "Print, PDF or WhatsApp",
    description:
      "80mm, 58mm or A4. Share the bill as a PDF where the browser allows it, and as a summary where it doesn't. Amount in words uses lakh and crore.",
  },
];

const TRUST: Feature[] = [
  {
    icon: BarChart3,
    title: "Four numbers at midnight",
    description:
      "Sales, bill count, average bill and tax collected — plus what sold, by hour, and what was discounted or cancelled. Every figure is computed from the bills themselves, so a report can never disagree with them.",
  },
  {
    icon: Printer,
    title: "Day close you can print",
    description:
      "A Z-report style summary with the GST slabs and the payment breakup. Reprint it whenever — nothing is locked off.",
  },
  {
    icon: Clock,
    title: "For restaurants that close at 2am",
    description:
      "Set the business day to start at 4am and a one o'clock order counts towards the night the staff actually worked, in both the KOT numbering and the day summary.",
  },
  {
    icon: DatabaseBackup,
    title: "Backup, and a nag when you forget",
    description:
      "Your data lives in this browser, which is why there is no login — and why one JSON file is the difference between a cleared cache and losing your year. Free Dine reminds you weekly.",
  },
  {
    icon: Lock,
    title: "PIN the counter",
    description:
      "Lock on open and after idle, so a passing guest cannot poke at the till while you are in the kitchen.",
  },
  {
    icon: WifiOff,
    title: "Keeps billing through an outage",
    description:
      "Once the page has loaded it stays loaded. Take orders, fire KOTs and print bills with the wifi down.",
  },
];

const SECTIONS: { eyebrow: string; title: string; subtitle: string; items: Feature[] }[] = [
  {
    eyebrow: "Service",
    title: "Built around the open ticket",
    subtitle:
      "A shop's sale is over in thirty seconds. A table's bill stays open for an hour. Everything here follows from that one difference.",
    items: SERVICE,
  },
  {
    eyebrow: "Menu",
    title: "A menu shaped like a real one",
    subtitle: "Sizes, add-ons, veg marks and the dish that runs out at eight.",
    items: MENU,
  },
  {
    eyebrow: "Billing",
    title: "The awkward part, handled",
    subtitle: "Splitting, merging, service charge and a GST bill that adds up to the paisa.",
    items: BILLING,
  },
  {
    eyebrow: "Trust",
    title: "What stops you leaving after a week",
    subtitle: "Reports you believe, data you can get out, and a till that keeps working.",
    items: TRUST,
  },
];

const DIFFERENCES: { capability: string; retail: string; dine: string }[] = [
  { capability: "Open bills per table", retail: "Hold and recall only", dine: "First-class" },
  { capability: "Tables and floor areas", retail: "—", dine: "Yes" },
  { capability: "Kitchen tickets (KOT)", retail: "—", dine: "Per round, no prices" },
  { capability: "Half / full, add-ons", retail: "—", dine: "Yes" },
  { capability: "Split and merge bills", retail: "—", dine: "Yes" },
  { capability: "Service charge", retail: "—", dine: "Yes" },
  { capability: "Barcode scanning", retail: "Yes", dine: "Not how restaurants work" },
  { capability: "Stock tracking", retail: "Yes", dine: "Out of scope" },
];

const FREE_VS_PAID: { feature: string; free: string; paid: string }[] = [
  { feature: "Billing, tax, tables, KOT", free: "Full", paid: "Full" },
  { feature: "Split, merge, service charge", free: "Full", paid: "Full" },
  { feature: "Reports and day close", free: "This outlet, this device", paid: "Across outlets" },
  { feature: "Multi-outlet", free: "—", paid: "Yes" },
  { feature: "Staff roles and logins", free: "One device, PIN lock", paid: "Owner / manager / staff" },
  { feature: "Coupons and loyalty", free: "Manual discounts", paid: "Coupon and loyalty engine" },
  { feature: "Synced CRM", free: "On this device", paid: "Yes" },
  { feature: "QR customer tracking", free: "—", paid: "Yes" },
];

const FAQ_ITEMS = [
  {
    question: "Is this really free, or is it a trial?",
    answer:
      "It is free forever for one restaurant on one device, and nothing is switched off after a month. Setu Dine, the paid product at ₹499/month, is the one that runs across several outlets, devices and staff logins — the limit is capacity, never features.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "No. There is no signup, no login and no server. Your menu, tables and bills are stored in this browser on this device, which is why nothing is uploaded and nobody else can read it.",
  },
  {
    question: "What happens if I clear my browser data?",
    answer:
      "You would lose everything, which is why Free Dine asks you to download a backup file every week. Restoring it into a fresh browser takes one click. If you are running a busy restaurant, take the backup — it is the single most important habit with a browser-based till.",
  },
  {
    question: "Does it work without internet?",
    answer:
      "Yes. Once the page has loaded, it keeps working with the wifi down — you can take orders, fire kitchen tickets and print bills through an outage. Nothing needs a connection because nothing is sent anywhere.",
  },
  {
    question: "Can I print KOTs to my kitchen printer?",
    answer:
      "Yes — 80mm and 58mm thermal, and A4 for restaurants without a kitchen printer. The KOT carries only the round you just sent and no prices. If you have no printer at all, the kitchen can read it off the screen, which is what most small kitchens do.",
  },
  {
    question: "Can I split a bill?",
    answer:
      "Three ways: by moving dishes onto separate bills, by an even share, or by amounts the table gives you. Each part gets its own bill number, prints on its own and is paid on its own, and the parts always add back to the original total exactly.",
  },
  {
    question: "How does GST work on the bill?",
    answer:
      "Each dish can carry its own rate, or inherit a default, with inclusive or exclusive pricing. The bill computes subtotal, then discount, then service charge, then tax — in that fixed order — and prints CGST and SGST per rate slab with the taxable value against each.",
  },
  {
    question: "Is service charge added automatically?",
    answer:
      "No, it is off by default, because service charge is voluntary in India. You can switch it on per ticket or set it as your default, and when it is charged the bill tells the guest they may ask for it to be removed.",
  },
  {
    question: "Does this share data with the free Browser Based POS?",
    answer:
      "No. They are separate products with separate databases. A retail counter and a dining room need different menus, different customers and different bill numbers, so nothing crosses between them — and resetting or restoring one never touches the other.",
  },
  {
    question: "Can I move my data to paid Setu Dine later?",
    answer:
      "Yes. Your menu exports as a CSV and your whole workspace exports as a JSON backup, so a restaurant that outgrows the free version can bring its menu and history along rather than starting over.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Dine — Free Restaurant POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Free browser-based restaurant POS and billing software. Table management, kitchen order tickets, split and merge bills, GST with CGST/SGST, and day-end reports. Works offline with all data stored on the device.",
  featureList: [
    "Table and floor area management with live running totals",
    "Open tickets that survive a browser restart",
    "Kitchen order tickets printed per round, without prices",
    "Item variations (half/full) and modifier groups (add-ons)",
    "Split bills by item, equal share or amount",
    "Merge tables into one bill",
    "GST with per-item rates and CGST/SGST breakup",
    "Optional service charge, off by default",
    "Multiple payment methods on one bill",
    "Thermal (80mm/58mm) and A4 bill and KOT printing",
    "Day summary, item report, hourly sales and printable day close",
    "CSV menu import and export",
    "PIN counter lock with idle auto-lock",
    "JSON backup and restore",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-restaurant-pos" }),
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

const RELATED_TOOLS = [
  { href: "/calculators/food-cost-calculator", label: "Food Cost Calculator" },
  { href: "/calculators/menu-engineering-calculator", label: "Menu Engineering Calculator" },
  { href: "/calculators/recipe-costing-calculator", label: "Recipe Costing Calculator" },
  { href: "/calculators/table-turnover-calculator", label: "Table Turnover Calculator" },
  { href: "/calculators/liquor-cost-calculator", label: "Liquor Cost Calculator" },
  {
    href: "/calculators/online-order-commission-calculator",
    label: "Online Order Commission Calculator",
  },
];

export default function FreeRestaurantPosPage() {
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

      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
              <span className="text-sm font-semibold text-indigo">
                Free Forever — One Restaurant, Works Offline
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Free Restaurant POS &amp; Billing Software
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Run the floor, send orders to the kitchen and print a GST bill — from your browser.
              No signup, no subscription, and it keeps working when the wifi doesn&apos;t.
            </p>
          </div>
        </FadeIn>

        <FadeInStagger className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {HIGHLIGHTS.map((highlight) => (
            <FadeInStaggerItem key={highlight.label}>
              <span className="inline-flex items-center gap-2 rounded-full border border-muted-line/30 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-sm">
                <highlight.icon className="h-4 w-4 text-indigo" />
                {highlight.label}
              </span>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </section>

      {/* The product itself, above the marketing — people came here to use it. */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <FreeDineApp />
      </section>

      {SECTIONS.map((section, index) => (
        <section
          key={section.title}
          className={index % 2 === 0 ? "bg-cream-paper py-16" : "py-16"}
        >
          <div className="mx-auto max-w-7xl px-6">
            <FadeIn>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-bold uppercase tracking-wide text-indigo">
                  {section.eyebrow}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">
                  {section.title}
                </h2>
                <p className="mt-3 text-lg text-muted">{section.subtitle}</p>
              </div>
            </FadeIn>

            <FadeInStagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <FadeInStaggerItem key={item.title}>
                  <div className="h-full rounded-2xl border border-muted-line/30 bg-white p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo/10 text-indigo">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-bold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                  </div>
                </FadeInStaggerItem>
              ))}
            </FadeInStagger>
          </div>
        </section>
      ))}

      {/* Why this is not the retail POS wearing a different hat. */}
      <section className="bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-ink">
                Already using our Browser Based POS?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">
                They are different tills for different rooms, with separate data. A shop rings up a
                sale and it is over; a restaurant keeps a bill open for an hour.
              </p>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-muted-line/30 bg-white shadow-sm">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-muted-line/20 bg-cream-paper text-left">
                    <th className="px-5 py-3 font-bold text-ink">Capability</th>
                    <th className="px-5 py-3 font-bold text-ink">Browser Based POS</th>
                    <th className="px-5 py-3 font-bold text-ink">Free Dine</th>
                  </tr>
                </thead>
                <tbody>
                  {DIFFERENCES.map((row) => (
                    <tr key={row.capability} className="border-b border-muted-line/10 last:border-0">
                      <td className="px-5 py-3 font-semibold text-ink">{row.capability}</td>
                      <td className="px-5 py-3 text-muted">{row.retail}</td>
                      <td className="px-5 py-3 text-muted">{row.dine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          <FadeIn>
            <p className="mt-4 text-center text-sm text-muted">
              Running a shop rather than a restaurant?{" "}
              <Link
                href="/products/browser-based-pos"
                className="font-semibold text-indigo underline underline-offset-2"
              >
                Use the Browser Based POS
              </Link>{" "}
              — it has barcode billing and stock tracking, which this deliberately does not.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* The upgrade path: state the ceiling factually, never nag. */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-ink">
                Where free stops and Setu Dine starts
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">
                The line is capacity, never features. Everything a single restaurant needs is here
                and stays here. Setu Dine is the one that runs across outlets, devices and staff.
              </p>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-muted-line/30 bg-white shadow-sm">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-muted-line/20 bg-cream-paper text-left">
                    <th className="px-5 py-3 font-bold text-ink">Feature</th>
                    <th className="px-5 py-3 font-bold text-ink">Free Dine</th>
                    <th className="px-5 py-3 font-bold text-ink">Setu Dine (₹499/mo)</th>
                  </tr>
                </thead>
                <tbody>
                  {FREE_VS_PAID.map((row) => (
                    <tr key={row.feature} className="border-b border-muted-line/10 last:border-0">
                      <td className="px-5 py-3 font-semibold text-ink">{row.feature}</td>
                      <td className="px-5 py-3 text-muted">{row.free}</td>
                      <td className="px-5 py-3 text-muted">{row.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="mt-8 rounded-2xl border border-muted-line/30 bg-cream-paper p-6 text-center">
              <p className="text-sm text-muted">
                Opening a second outlet, or want your staff on their own logins?
              </p>
              <Link
                href="/products/restaurant-pos"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink"
              >
                <UtensilsCrossed className="h-4 w-4" />
                See Setu Dine
              </Link>
              <p className="mt-3 text-xs text-muted">
                Your menu and history export as CSV and JSON, so nothing is stranded here.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <h2 className="text-center text-2xl font-bold tracking-tight text-ink">
              Free tools for restaurant owners
            </h2>
            <p className="mt-2 text-center text-sm text-muted">
              Work out what a dish costs before you price it on the menu above.
            </p>
          </FadeIn>
          <FadeInStagger className="mt-8 flex flex-wrap justify-center gap-2.5">
            {RELATED_TOOLS.map((tool) => (
              <FadeInStaggerItem key={tool.href}>
                <Link
                  href={tool.href}
                  className="inline-flex items-center gap-2 rounded-full border border-muted-line/30 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-indigo/50 hover:text-indigo"
                >
                  {tool.label}
                </Link>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      <Faq headline="Free restaurant POS — questions" items={FAQ_ITEMS} />
    </>
  );
}
