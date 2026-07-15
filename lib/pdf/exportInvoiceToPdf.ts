import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { getInvoiceFileName } from "@/lib/invoice";
import type { InvoiceData } from "@/lib/types/invoice";

export async function exportInvoiceToPdf(
  data: InvoiceData,
  element: HTMLElement,
  options?: {
    scale?: number;
    quality?: number;
  }
) {
  try {
    const scale = options?.scale || 2;
    const quality = options?.quality || 0.95;

    // Capture the invoice element as canvas
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: imgHeight > imgWidth ? "portrait" : "portrait",
      unit: "mm",
      format: "a4",
    });

    // Add image to PDF
    const imgData = canvas.toDataURL("image/png", quality);
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= 297; // A4 height in mm

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }

    // Download PDF
    const fileName = getInvoiceFileName(data.invoiceDetails.number, data.invoiceDetails.date);
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF. Please try again.");
  }
}
