"use client";

import { ClassicTemplate } from "./templates/ClassicTemplate";
import { ModernTemplate } from "./templates/ModernTemplate";
import { ColorfulTemplate } from "./templates/ColorfulTemplate";
import type { InvoiceData } from "@/lib/types/invoice";

interface InvoicePreviewProps {
  data: InvoiceData;
}

export function InvoicePreview({ data }: InvoicePreviewProps) {
  // Filter out items without description
  const filteredData = {
    ...data,
    lineItems: data.lineItems.filter(item => item.description.trim() !== "")
  };

  return (
    <div className="w-full">
      {filteredData.template === "classic" && <ClassicTemplate data={filteredData} />}
      {filteredData.template === "modern" && <ModernTemplate data={filteredData} />}
      {filteredData.template === "colorful" && <ColorfulTemplate data={filteredData} />}
    </div>
  );
}
