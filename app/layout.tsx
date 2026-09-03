import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { NepalSupportBanner } from "@/components/NepalSupportBanner";
import { Footer } from "@/components/Footer";
import { getSiteContent } from "@/lib/content";
import { LanguageProvider } from "@/lib/i18n";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://setutechnology.com"),
  title: {
    default: "Setu Technology | Setu for your business",
    template: "%s",
  },
  description:
    "Setu Technology builds operational software for businesses globally, starting with Setu Dine for restaurants.",
  openGraph: {
    siteName: "Setu Technology",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-800x418.png",
        width: 800,
        height: 418,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-500x261.png",
        width: 500,
        height: 261,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Identity signals for search engines and AI models. A thin Organization block
// makes it easy to confuse this company with similarly named ones, so keep the
// description, contact point and profile links here specific and current.
//
// `sameAs` is derived from the footer's social links so a profile only has to
// be added in one place — and so this list can never drift into listing a
// profile the site itself does not link to.
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Setu Technology",
  alternateName: "Setu",
  url: "https://setutechnology.com",
  logo: "https://setutechnology.com/icon.svg",
  description:
    "Setu Technology builds operational software for businesses — restaurant billing and POS, kitchen and queue management, QR menus, and a free suite of business calculators and tools. Started with restaurants, expanding to retail and clinics.",
  foundingDate: "2026-06-21",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@setutechnology.com",
    url: "https://setutechnology.com/contact",
    availableLanguage: ["English"],
  },
  sameAs: getSiteContent().footer.social.map((profile) => profile.href),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteContent();

  return (
    <html lang="en" className={sora.variable}>
      <body className="font-sora">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <LanguageProvider>
          <NepalSupportBanner />
          <Nav site={site} />
          <main>{children}</main>
          <Footer site={site} />
        </LanguageProvider>
        {/* Vercel Web Analytics: cookieless page-view and referrer data. It
            collects no personal data and never sees what users type into the
            calculators or tools, which keeps the on-device promise intact. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
