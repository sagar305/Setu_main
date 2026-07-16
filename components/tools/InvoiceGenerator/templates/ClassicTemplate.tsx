import { formatCurrency } from "@/lib/format";
import { amountInWordsIndian, calculateLineItem, calculateTotals, splitTax } from "@/lib/invoice";
import { UPIQRCode } from "../UPIQRCode";
import type { InvoiceData } from "@/lib/types/invoice";

interface ClassicTemplateProps {
  data: InvoiceData;
}

export function ClassicTemplate({ data }: ClassicTemplateProps) {
  const totals = calculateTotals(data.lineItems, data.fees, data.taxMode);
  const amountWords = amountInWordsIndian(totals.grandTotal);

  return (
    <div className="bg-white p-8 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-4">
          {data.businessDetails.logo && (
            <img
              src={data.businessDetails.logo}
              alt="Business logo"
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <div>
            <div className="text-2xl font-bold" style={{ color: data.brandColor }}>
              {data.businessDetails.name}
            </div>
            <div className="mt-1 text-xs text-gray-600">INVOICE</div>
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-bold">Invoice #: {data.invoiceDetails.number}</div>
          <div>Date: {new Date(data.invoiceDetails.date).toLocaleDateString("en-IN")}</div>
          {data.invoiceDetails.dueDate && (
            <div>Due: {new Date(data.invoiceDetails.dueDate).toLocaleDateString("en-IN")}</div>
          )}
        </div>
      </div>

      {/* From/To Section */}
      <div className="mb-8 grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="mb-2 font-bold" style={{ color: data.brandColor }}>
            FROM
          </div>
          <div className="space-y-1 text-gray-700">
            <div className="font-bold">{data.businessDetails.name}</div>
            {data.businessDetails.gstin && <div>GSTIN: {data.businessDetails.gstin}</div>}
            <div>{data.businessDetails.address}</div>
            <div>Ph: {data.businessDetails.phone}</div>
            <div>{data.businessDetails.email}</div>
          </div>
        </div>

        <div>
          <div className="mb-2 font-bold" style={{ color: data.brandColor }}>
            BILL TO
          </div>
          <div className="space-y-1 text-gray-700">
            <div className="font-bold">{data.clientDetails.name}</div>
            {data.clientDetails.gstin && <div>GSTIN: {data.clientDetails.gstin}</div>}
            <div>{data.clientDetails.address}</div>
            {data.clientDetails.phone && <div>Ph: {data.clientDetails.phone}</div>}
            {data.clientDetails.email && <div>{data.clientDetails.email}</div>}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="mb-6 w-full border-collapse text-xs">
        <thead>
          <tr className="border-t-2 border-b border-black">
            <th className="border-b border-gray-300 py-2 text-left font-bold">Item Description</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">Qty</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">Rate</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">Disc %</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">Tax %</th>
            <th className="border-b border-gray-300 py-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lineItems.map((item) => {
            const calc = calculateLineItem(item, data.taxMode);
            return (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2 text-left">{item.description}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-center">{formatCurrency(item.rate)}</td>
                <td className="py-2 text-center">{item.discountPercent}%</td>
                <td className="py-2 text-center">{item.taxRate}%</td>
                <td className="py-2 text-right font-bold">{formatCurrency(calc.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mb-6 flex justify-end">
        <div className="w-64 text-xs">
          <div className="mb-1 flex justify-between border-b border-gray-300 py-1">
            <span>Subtotal:</span>
            <span className="font-bold">{formatCurrency(totals.subtotal)}</span>
          </div>

          {totals.totalDiscount > 0 && (
            <div className="mb-1 flex justify-between border-b border-gray-300 py-1">
              <span>Total Discount:</span>
              <span className="font-bold text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
            </div>
          )}

          {Object.entries(totals.taxByRate)
            .filter(([_, amount]) => amount > 0)
            .map(([rate, amount]) => (
            <div key={rate} className="mb-1 flex justify-between border-b border-gray-300 py-1">
              <span>Tax @ {rate}%:</span>
              <span className="font-bold">{formatCurrency(amount)}</span>
            </div>
          ))}

          {Object.entries(totals.feeBreakdown)
            .filter(([_, feeAmount]) => feeAmount !== 0)
            .map(([feeName, feeAmount]) => (
            <div key={feeName} className="mb-1 flex justify-between border-b border-gray-300 py-1">
              <span>{feeName}:</span>
              <span className={`font-bold ${feeAmount < 0 ? "text-red-600" : ""}`}>
                {feeAmount < 0 ? `-${formatCurrency(Math.abs(feeAmount))}` : formatCurrency(feeAmount)}
              </span>
            </div>
          ))}

          <div
            className="mt-3 flex justify-between border-t-2 border-black py-2 text-sm font-bold"
            style={{ color: data.brandColor }}
          >
            <span>TOTAL:</span>
            <span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="mb-6 border-b border-gray-300 pb-4 text-xs">
        <div className="font-bold">Amount in Words:</div>
        <div>{amountWords}</div>
      </div>

      {/* Bank Details */}
      {(data.bankDetails?.accountNo || data.bankDetails?.upiId) && (
        <div className="mb-6 border-b border-gray-300 pb-4">
          <div className="font-bold mb-2 text-xs">Payment Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-xs">
              {data.bankDetails.accountNo && (
                <div>Account: {data.bankDetails.accountNo}</div>
              )}
              {data.bankDetails.ifsc && (
                <div>IFSC: {data.bankDetails.ifsc}</div>
              )}
              {data.bankDetails.upiId && (
                <div>UPI: {data.bankDetails.upiId}</div>
              )}
            </div>
            {data.bankDetails.upiId && (
              <div className="flex justify-end">
                <UPIQRCode
                  upiId={data.bankDetails.upiId}
                  amount={calculateTotals(data.lineItems, data.fees, data.taxMode).grandTotal}
                  businessName={data.businessDetails.name}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="mb-4 border-b border-gray-300 pb-4 text-xs">
          <div className="font-bold">Notes:</div>
          <div className="mt-1 whitespace-pre-wrap text-gray-700">{data.notes}</div>
        </div>
      )}

      {/* Terms */}
      {data.terms && (
        <div className="text-xs">
          <div className="font-bold">Terms & Conditions:</div>
          <div className="mt-1 whitespace-pre-wrap text-gray-700">{data.terms}</div>
        </div>
      )}
    </div>
  );
}
