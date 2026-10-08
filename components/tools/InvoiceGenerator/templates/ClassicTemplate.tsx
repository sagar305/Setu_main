import { formatCurrency } from "@/lib/format";
import { amountInWordsIndian, calculateLineItem, calculateTotals, splitTax } from "@/lib/invoice";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { UPIQRCode } from "../UPIQRCode";
import type { InvoiceData } from "@/lib/types/invoice";

interface ClassicTemplateProps {
  data: InvoiceData;
}

export function ClassicTemplate({ data }: ClassicTemplateProps) {
  const { t, lang } = useI18n();
  const totals = calculateTotals(data.lineItems, data.fees, data.taxMode);
  // The spelled-out amount is still English: a number-to-words engine per
  // language is its own piece of work, and a wrong one on a tax document is
  // worse than an English one. The label around it follows the reader.
  const amountWords = amountInWordsIndian(totals.grandTotal);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(intlLocaleFor(lang));

  return (
    <div className="bg-white p-8 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-4">
          {data.businessDetails.logo && (
            <img
              src={data.businessDetails.logo}
              alt={t("igBusinessLogoAlt")}
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <div>
            <div className="text-2xl font-bold" style={{ color: data.brandColor }}>
              {data.businessDetails.name}
            </div>
            <div className="mt-1 text-xs text-gray-600">{t("igDocInvoice")}</div>
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-bold">
            {fill(t("igDocInvoiceNo"), { no: data.invoiceDetails.number })}
          </div>
          <div>{fill(t("igDocDate"), { date: fmtDate(data.invoiceDetails.date) })}</div>
          {data.invoiceDetails.dueDate && (
            <div>{fill(t("igDocDue"), { date: fmtDate(data.invoiceDetails.dueDate) })}</div>
          )}
        </div>
      </div>

      {/* From/To Section */}
      <div className="mb-8 grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="mb-2 font-bold" style={{ color: data.brandColor }}>
            {t("igDocFrom")}
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
            {t("igDocBillTo")}
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
            <th className="border-b border-gray-300 py-2 text-left font-bold">{t("igItemDescription")}</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">{t("quantity")}</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">{t("rate")}</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">{t("igDocDiscPct")}</th>
            <th className="border-b border-gray-300 py-2 text-center font-bold">{t("igTaxPct")}</th>
            <th className="border-b border-gray-300 py-2 text-right font-bold">{t("amount")}</th>
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
            <span>{t("igDocSubtotal")}:</span>
            <span className="font-bold">{formatCurrency(totals.subtotal)}</span>
          </div>

          {totals.totalDiscount > 0 && (
            <div className="mb-1 flex justify-between border-b border-gray-300 py-1">
              <span>{t("igDocTotalDiscount")}:</span>
              <span className="font-bold text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
            </div>
          )}

          {Object.entries(totals.taxByRate)
            .filter(([_, amount]) => amount > 0)
            .map(([rate, amount]) => (
            <div key={rate} className="mb-1 flex justify-between border-b border-gray-300 py-1">
              <span>{fill(t("igDocTaxAt"), { rate })}:</span>
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
            <span>{t("igDocTotal")}:</span>
            <span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="mb-6 border-b border-gray-300 pb-4 text-xs">
        <div className="font-bold">{t("igDocAmountInWords")}</div>
        <div>{amountWords}</div>
      </div>

      {/* Bank Details */}
      {(data.bankDetails?.accountNo || data.bankDetails?.upiId) && (
        <div className="mb-6 border-b border-gray-300 pb-4">
          <div className="font-bold mb-2 text-xs">{t("igDocPaymentDetails")}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-xs">
              {data.bankDetails.accountNo && (
                <div>{fill(t("igDocAccount"), { value: data.bankDetails.accountNo })}</div>
              )}
              {data.bankDetails.ifsc && (
                <div>{fill(t("igDocIfsc"), { value: data.bankDetails.ifsc })}</div>
              )}
              {data.bankDetails.upiId && (
                <div>{fill(t("igDocUpi"), { value: data.bankDetails.upiId })}</div>
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
          <div className="font-bold">{t("igDocNotes")}</div>
          <div className="mt-1 whitespace-pre-wrap text-gray-700">{data.notes}</div>
        </div>
      )}

      {/* Terms */}
      {data.terms && (
        <div className="text-xs">
          <div className="font-bold">{t("igDocTerms")}</div>
          <div className="mt-1 whitespace-pre-wrap text-gray-700">{data.terms}</div>
        </div>
      )}
    </div>
  );
}
