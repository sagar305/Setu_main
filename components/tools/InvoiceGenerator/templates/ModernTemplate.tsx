import { formatCurrency } from "@/lib/format";
import { amountInWordsIndian, calculateLineItem, calculateTotals } from "@/lib/invoice";
import { UPIQRCode } from "../UPIQRCode";
import type { InvoiceData } from "@/lib/types/invoice";

interface ModernTemplateProps {
  data: InvoiceData;
}

export function ModernTemplate({ data }: ModernTemplateProps) {
  const totals = calculateTotals(data.lineItems, data.fees, data.taxMode);
  const amountWords = amountInWordsIndian(totals.grandTotal);

  return (
    <div className="bg-white text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header with Brand Color */}
      <div className="flex items-center gap-6 p-8" style={{ backgroundColor: data.brandColor, color: "white" }}>
        {data.businessDetails.logo && (
          <img
            src={data.businessDetails.logo}
            alt="Business logo"
            className="h-20 w-20 rounded-lg object-cover"
          />
        )}
        <div>
          <div className="text-3xl font-bold">{data.businessDetails.name}</div>
          <div className="mt-2 opacity-90">Professional Invoice</div>
        </div>
      </div>

      <div className="p-8">
        {/* Invoice Meta */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <div className="text-xs font-semibold opacity-60">Invoice #</div>
            <div className="mt-1 text-lg font-bold">{data.invoiceDetails.number}</div>
          </div>
          <div>
            <div className="text-xs font-semibold opacity-60">Date</div>
            <div className="mt-1 text-lg font-bold">
              {new Date(data.invoiceDetails.date).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          {data.invoiceDetails.dueDate && (
            <div>
              <div className="text-xs font-semibold opacity-60">Due Date</div>
              <div className="mt-1 text-lg font-bold">
                {new Date(data.invoiceDetails.dueDate).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          )}
          {data.invoiceDetails.poNumber && (
            <div>
              <div className="text-xs font-semibold opacity-60">PO #</div>
              <div className="mt-1 text-lg font-bold">{data.invoiceDetails.poNumber}</div>
            </div>
          )}
        </div>

        {/* From/To */}
        <div className="mb-8 grid grid-cols-2 gap-12">
          <div>
            <div className="mb-3 text-xs font-bold uppercase opacity-60">From</div>
            <div className="space-y-1 text-sm">
              <div className="font-bold text-lg">{data.businessDetails.name}</div>
              <div>{data.businessDetails.address}</div>
              {data.businessDetails.gstin && <div>GSTIN: {data.businessDetails.gstin}</div>}
              <div>{data.businessDetails.phone}</div>
              <div>{data.businessDetails.email}</div>
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-bold uppercase opacity-60">Bill To</div>
            <div className="space-y-1 text-sm">
              <div className="font-bold text-lg">{data.clientDetails.name}</div>
              <div>{data.clientDetails.address}</div>
              {data.clientDetails.gstin && <div>GSTIN: {data.clientDetails.gstin}</div>}
              {data.clientDetails.phone && <div>{data.clientDetails.phone}</div>}
              {data.clientDetails.email && <div>{data.clientDetails.email}</div>}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="mb-8 w-full text-xs">
          <thead>
            <tr
              style={{ backgroundColor: data.brandColor + "10", borderTopWidth: "2px", borderBottomWidth: "2px" }}
            >
              <th className="px-4 py-3 text-left font-bold">Item Description</th>
              <th className="px-4 py-3 text-center font-bold">Qty</th>
              <th className="px-4 py-3 text-right font-bold">Price</th>
              <th className="px-4 py-3 text-center font-bold">Disc %</th>
              <th className="px-4 py-3 text-center font-bold">Tax %</th>
              <th className="px-4 py-3 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, idx) => {
              const calc = calculateLineItem(item, data.taxMode);
              return (
                <tr
                  key={item.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? "#fafafa" : "white",
                    borderBottomWidth: "1px",
                  }}
                >
                  <td className="px-4 py-3 text-left">{item.description}</td>
                  <td className="px-4 py-3 text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.rate)}</td>
                  <td className="px-4 py-3 text-center">{item.discountPercent}%</td>
                  <td className="px-4 py-3 text-center">{item.taxRate}%</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(calc.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mb-8 flex justify-end">
          <div className="w-80">
            <div className="mb-2 flex justify-between border-b py-2 text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>

            {totals.totalDiscount > 0 && (
              <div className="mb-2 flex justify-between border-b py-2 text-sm">
                <span>Discount</span>
                <span className="font-semibold text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
              </div>
            )}

            {Object.entries(totals.taxByRate)
              .filter(([_, amount]) => amount > 0)
              .map(([rate, amount]) => (
              <div key={rate} className="mb-2 flex justify-between border-b py-2 text-sm">
                <span>Tax @ {rate}%</span>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}

            {totals.totalFees > 0 && (
              <>
                {Object.entries(totals.feeBreakdown).map(([feeName, feeAmount]) => (
                  <div key={feeName} className="mb-2 flex justify-between border-b py-2 text-sm">
                    <span>{feeName}</span>
                    <span className="font-semibold">{formatCurrency(feeAmount)}</span>
                  </div>
                ))}
              </>
            )}

            <div
              className="mt-3 flex justify-between py-3 text-lg font-bold"
              style={{ color: data.brandColor, borderTopWidth: "2px" }}
            >
              <span>TOTAL</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="mb-6 border-b py-4 text-xs">
          <div className="font-bold">Amount in Words</div>
          <div className="mt-1">{amountWords}</div>
        </div>

        {/* Payment Details */}
        {(data.bankDetails?.accountNo || data.bankDetails?.upiId) && (
          <div className="mb-6 border-b py-4">
            <div className="font-bold text-xs">Payment Details</div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="space-y-1 text-xs">
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

        {/* Notes & Terms */}
        {(data.notes || data.terms) && (
          <div className="text-xs">
            {data.notes && (
              <div className="mb-4">
                <div className="font-bold">Notes</div>
                <div className="mt-1 whitespace-pre-wrap text-gray-600">{data.notes}</div>
              </div>
            )}

            {data.terms && (
              <div>
                <div className="font-bold">Terms & Conditions</div>
                <div className="mt-1 whitespace-pre-wrap text-gray-600">{data.terms}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
