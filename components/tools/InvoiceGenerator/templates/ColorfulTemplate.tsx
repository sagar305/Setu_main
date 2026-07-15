import { formatCurrency } from "@/lib/format";
import { amountInWordsIndian, calculateLineItem, calculateTotals } from "@/lib/invoice";
import { UPIQRCode } from "../UPIQRCode";
import type { InvoiceData } from "@/lib/types/invoice";

interface ColorfulTemplateProps {
  data: InvoiceData;
}

// Helper to adjust color brightness
function adjustBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return (
    "#" +
    (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16)
      .slice(1)
  );
}

export function ColorfulTemplate({ data }: ColorfulTemplateProps) {
  const totals = calculateTotals(data.lineItems, data.taxMode);
  const amountWords = amountInWordsIndian(totals.grandTotal);
  const lightBgColor = adjustBrightness(data.brandColor, 15);

  return (
    <div className="bg-white text-sm" style={{ fontFamily: "Georgia, serif" }}>
      {/* Colorful Header */}
      <div className="relative overflow-hidden p-8" style={{ backgroundColor: data.brandColor }}>
        <div
          className="absolute right-0 top-0 h-32 w-32 rounded-full opacity-20"
          style={{
            backgroundColor: "white",
            transform: "translate(30%, -30%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-4 text-white">
          {data.businessDetails.logo && (
            <img
              src={data.businessDetails.logo}
              alt="Business logo"
              className="h-20 w-20 rounded-lg object-cover"
            />
          )}
          <div>
            <div className="text-4xl font-bold">{data.businessDetails.name}</div>
            <div className="mt-3 text-sm opacity-90">Invoice for Professional Services</div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Invoice Details Cards */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div
            className="rounded-lg p-4 text-white"
            style={{ backgroundColor: data.brandColor }}
          >
            <div className="text-xs font-semibold opacity-80">Invoice Number</div>
            <div className="mt-2 text-2xl font-bold">{data.invoiceDetails.number}</div>
          </div>
          <div
            className="rounded-lg p-4 text-white"
            style={{ backgroundColor: lightBgColor, color: data.brandColor }}
          >
            <div className="text-xs font-semibold opacity-80">Invoice Date</div>
            <div className="mt-2 text-lg font-bold">
              {new Date(data.invoiceDetails.date).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          <div
            className="rounded-lg p-4 text-white"
            style={{ backgroundColor: adjustBrightness(data.brandColor, -10) }}
          >
            <div className="text-xs font-semibold opacity-80">Due Date</div>
            <div className="mt-2 text-lg font-bold">
              {new Date(data.invoiceDetails.dueDate).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* From/To */}
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div className="rounded-lg p-6" style={{ backgroundColor: lightBgColor }}>
            <div
              className="mb-3 text-xs font-bold uppercase"
              style={{ color: data.brandColor }}
            >
              From
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-bold text-base">{data.businessDetails.name}</div>
              <div className="opacity-80">{data.businessDetails.address}</div>
              {data.businessDetails.gstin && (
                <div className="text-xs opacity-60">GSTIN: {data.businessDetails.gstin}</div>
              )}
              <div className="text-xs opacity-60">{data.businessDetails.phone}</div>
            </div>
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: lightBgColor }}>
            <div
              className="mb-3 text-xs font-bold uppercase"
              style={{ color: data.brandColor }}
            >
              Bill To
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-bold text-base">{data.clientDetails.name}</div>
              <div className="opacity-80">{data.clientDetails.address}</div>
              {data.clientDetails.gstin && (
                <div className="text-xs opacity-60">GSTIN: {data.clientDetails.gstin}</div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table with Colorful Rows */}
        <div className="mb-8 overflow-hidden rounded-lg border-2" style={{ borderColor: data.brandColor }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: data.brandColor, color: "white" }}>
                <th className="px-4 py-3 text-left font-bold">Description</th>
                <th className="px-4 py-3 text-center font-bold">Qty</th>
                <th className="px-4 py-3 text-right font-bold">Rate</th>
                <th className="px-4 py-3 text-center font-bold">Disc %</th>
                <th className="px-4 py-3 text-center font-bold">Tax %</th>
                <th className="px-4 py-3 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((item, idx) => {
                const calc = calculateLineItem(item, data.taxMode);
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor: isEven ? lightBgColor : "white",
                      opacity: 0.9,
                    }}
                  >
                    <td className="px-4 py-3 text-left font-medium">{item.description}</td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.rate)}</td>
                    <td className="px-4 py-3 text-center">{item.discountPercent}%</td>
                    <td className="px-4 py-3 text-center">{item.taxRate}%</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(calc.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="mb-8 flex justify-end">
          <div className="w-80 rounded-lg p-6" style={{ backgroundColor: lightBgColor }}>
            <div className="mb-2 flex justify-between border-b py-2 text-sm">
              <span className="opacity-80">Subtotal</span>
              <span className="font-bold">{formatCurrency(totals.subtotal)}</span>
            </div>

            {totals.totalDiscount > 0 && (
              <div className="mb-2 flex justify-between border-b py-2 text-sm">
                <span className="opacity-80">Discount</span>
                <span className="font-bold text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
              </div>
            )}

            {Object.entries(totals.taxByRate).map(([rate, amount]) => (
              <div key={rate} className="mb-2 flex justify-between border-b py-2 text-sm">
                <span className="opacity-80">Tax @ {rate}%</span>
                <span className="font-bold">{formatCurrency(amount)}</span>
              </div>
            ))}

            <div
              className="mt-4 flex justify-between rounded-lg py-3 px-4 text-base font-bold"
              style={{ backgroundColor: data.brandColor, color: "white" }}
            >
              <span>TOTAL</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div
          className="mb-6 rounded-lg p-4"
          style={{ backgroundColor: lightBgColor, borderLeftWidth: "4px", borderLeftColor: data.brandColor }}
        >
          <div className="text-xs font-bold" style={{ color: data.brandColor }}>
            Amount in Words
          </div>
          <div className="mt-2 font-medium">{amountWords}</div>
        </div>

        {/* Payment & Footer Info */}
        {(data.bankDetails?.accountNo || data.bankDetails?.upiId || data.notes || data.terms) && (
          <div className="space-y-4 text-xs">
            {(data.bankDetails?.accountNo || data.bankDetails?.upiId) && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: lightBgColor, borderLeftWidth: "4px", borderLeftColor: data.brandColor }}
              >
                <div className="font-bold" style={{ color: data.brandColor }}>
                  Payment Information
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div className="space-y-1 text-sm">
                    {data.bankDetails.accountNo && <div>Account: {data.bankDetails.accountNo}</div>}
                    {data.bankDetails.ifsc && <div>IFSC: {data.bankDetails.ifsc}</div>}
                    {data.bankDetails.upiId && <div>UPI: {data.bankDetails.upiId}</div>}
                  </div>
                  {data.bankDetails.upiId && (
                    <div className="flex justify-end">
                      <UPIQRCode
                        upiId={data.bankDetails.upiId}
                        amount={totals.grandTotal}
                        businessName={data.businessDetails.name}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.notes && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: lightBgColor, borderLeftWidth: "4px", borderLeftColor: data.brandColor }}
              >
                <div className="font-bold" style={{ color: data.brandColor }}>
                  Notes
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{data.notes}</div>
              </div>
            )}

            {data.terms && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: lightBgColor, borderLeftWidth: "4px", borderLeftColor: data.brandColor }}
              >
                <div className="font-bold" style={{ color: data.brandColor }}>
                  Terms & Conditions
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{data.terms}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
