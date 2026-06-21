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
  metadataBase: new URL("https://setutech.com"),
  title: {
    default: "Setu Technology | Setu for your business",
    template: "%s",
  },
  description:
    "Setu Technology builds operational software for businesses across India and Southeast Asia, starting with Setu POS for restaurants.",
  openGraph: {
    siteName: "Setu Technology",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteContent();

  return (
    <html lang="en" className={sora.variable}>
      <body className="font-sora">
        <Nav site={site} />
        <main>{children}</main>
        <Footer site={site} />
      </body>
    </html>
  );
}
