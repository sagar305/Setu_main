import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PwaAppLayout } from "@/components/pwa/PwaAppLayout";
import { pwaMetadata } from "@/lib/pwa/apps";

export const metadata: Metadata = pwaMetadata("pos");

export default function Layout({ children }: { children: ReactNode }) {
  return <PwaAppLayout appId="pos">{children}</PwaAppLayout>;
}
