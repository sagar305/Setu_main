import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getSiteContent } from "@/lib/content";

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
        url: "/og/setu-og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    image: "/og/setu-og-image.png",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Setu Technology",
  url: "https://setutechnology.com",
  logo: "https://setutechnology.com/icon.svg",
  sameAs: ["https://www.instagram.com/setu.technology"],
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
        <Nav site={site} />
        <main>{children}</main>
        <Footer site={site} />
      </body>
    </html>
  );
}
