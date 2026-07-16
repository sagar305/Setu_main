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

    // Wait for any dynamic content (like QR codes) to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if element is visible and has content
    if (!element || element.offsetHeight === 0) {
      throw new Error("Invoice preview is not visible or empty");
    }

    // Capture the invoice element as canvas
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
      foreignObjectRendering: true,
      windowHeight: element.scrollHeight,
    });

    if (!canvas) {
      throw new Error("Failed to capture invoice preview");
    }

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
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
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    throw new Error(message || "Failed to generate PDF. Please try again.");
  }
}

export async function generateInvoicePdfBlob(
  data: InvoiceData,
  element: HTMLElement,
  options?: {
    scale?: number;
    quality?: number;
  }
): Promise<Blob | null> {
  try {
    const scale = options?.scale || 2;
    const quality = options?.quality || 0.95;

    // Wait for any dynamic content (like QR codes) to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if element is visible and has content
    if (!element || element.offsetHeight === 0) {
      throw new Error("Invoice preview is not visible or empty");
    }

    // Capture the invoice element as canvas
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
      foreignObjectRendering: true,
      windowHeight: element.scrollHeight,
    });

    if (!canvas) {
      throw new Error("Failed to capture invoice preview");
    }

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
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

    // Return as blob
    const blob = pdf.output("blob");
    return blob || new Blob();
  } catch (error) {
    console.error("Error generating PDF blob:", error);
    return new Blob();
  }
}
