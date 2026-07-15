"use client";

import { ClassicTemplate } from "./templates/ClassicTemplate";
import { ModernTemplate } from "./templates/ModernTemplate";
import { ColorfulTemplate } from "./templates/ColorfulTemplate";
import type { InvoiceData } from "@/lib/types/invoice";

interface InvoicePreviewProps {
  data: InvoiceData;
}

export function InvoicePreview({ data }: InvoicePreviewProps) {
  return (
    <div className="w-full">
      {data.template === "classic" && <ClassicTemplate data={data} />}
      {data.template === "modern" && <ModernTemplate data={data} />}
      {data.template === "colorful" && <ColorfulTemplate data={data} />}
    </div>
  );
}
