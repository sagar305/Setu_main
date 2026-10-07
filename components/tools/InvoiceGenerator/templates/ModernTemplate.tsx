import { formatCurrency } from "@/lib/format";
import { amountInWordsIndian, calculateLineItem, calculateTotals } from "@/lib/invoice";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { UPIQRCode } from "../UPIQRCode";
import type { InvoiceData } from "@/lib/types/invoice";

interface ModernTemplateProps {
  data: InvoiceData;
}

export function ModernTemplate({ data }: ModernTemplateProps) {
  const { t, lang } = useI18n();
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(intlLocaleFor(lang), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const totals = calculateTotals(data.lineItems, data.fees, data.taxMode);
  const amountWords = amountInWordsIndian(totals.grandTotal);

  return (
    <div className="bg-white text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header with Brand Color */}
      <div className="flex items-center gap-6 p-8" style={{ backgroundColor: data.brandColor, color: "white" }}>
        {data.businessDetails.logo && (
          <img
            src={data.businessDetails.logo}
            alt={t("igBusinessLogoAlt")}
            className="h-20 w-20 rounded-lg object-cover"
          />
        )}
        <div>
          <div className="text-3xl font-bold">{data.businessDetails.name}</div>
          <div className="mt-2 opacity-90">{t("igDocProfessional")}</div>
        </div>
      </div>

      <div className="p-8">
        {/* Invoice Meta */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <div className="text-xs font-semibold opacity-60">{t("igDocInvoiceHash")}</div>
            <div className="mt-1 text-lg font-bold">{data.invoiceDetails.number}</div>
          </div>
          <div>
            <div className="text-xs font-semibold opacity-60">{t("date")}</div>
            <div className="mt-1 text-lg font-bold">{fmtDate(data.invoiceDetails.date)}</div>
          </div>
          {data.invoiceDetails.dueDate && (
            <div>
              <div className="text-xs font-semibold opacity-60">{t("igDueDate")}</div>
              <div className="mt-1 text-lg font-bold">{fmtDate(data.invoiceDetails.dueDate)}</div>
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
            <div className="mb-3 text-xs font-bold uppercase opacity-60">{t("igDocFrom")}</div>
            <div className="space-y-1 text-sm">
              <div className="font-bold text-lg">{data.businessDetails.name}</div>
              <div>{data.businessDetails.address}</div>
              {data.businessDetails.gstin && <div>GSTIN: {data.businessDetails.gstin}</div>}
              <div>{data.businessDetails.phone}</div>
              <div>{data.businessDetails.email}</div>
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-bold uppercase opacity-60">{t("igDocBillTo")}</div>
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
              <th className="px-4 py-3 text-left font-bold">{t("igItemDescription")}</th>
              <th className="px-4 py-3 text-center font-bold">{t("quantity")}</th>
              <th className="px-4 py-3 text-right font-bold">{t("igDocPrice")}</th>
              <th className="px-4 py-3 text-center font-bold">{t("igDocDiscPct")}</th>
              <th className="px-4 py-3 text-center font-bold">{t("igTaxPct")}</th>
              <th className="px-4 py-3 text-right font-bold">{t("amount")}</th>
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
              <span>{t("igDocSubtotal")}</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>

            {totals.totalDiscount > 0 && (
              <div className="mb-2 flex justify-between border-b py-2 text-sm">
                <span>{t("igDocDiscount")}</span>
                <span className="font-semibold text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
              </div>
            )}

            {Object.entries(totals.taxByRate)
              .filter(([_, amount]) => amount > 0)
              .map(([rate, amount]) => (
              <div key={rate} className="mb-2 flex justify-between border-b py-2 text-sm">
                <span>{fill(t("igDocTaxAt"), { rate })}</span>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}

            {Object.entries(totals.feeBreakdown)
              .filter(([_, feeAmount]) => feeAmount !== 0)
              .map(([feeName, feeAmount]) => (
              <div key={feeName} className="mb-2 flex justify-between border-b py-2 text-sm">
                <span>{feeName}</span>
                <span className={`font-semibold ${feeAmount < 0 ? "text-red-600" : ""}`}>
                  {feeAmount < 0 ? `-${formatCurrency(Math.abs(feeAmount))}` : formatCurrency(feeAmount)}
                </span>
              </div>
            ))}

            <div
              className="mt-3 flex justify-between py-3 text-lg font-bold"
              style={{ color: data.brandColor, borderTopWidth: "2px" }}
            >
              <span>{t("igDocTotal")}</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="mb-6 border-b py-4 text-xs">
          <div className="font-bold">{t("igDocAmountInWordsPlain")}</div>
          <div className="mt-1">{amountWords}</div>
        </div>

        {/* Payment Details */}
        {(data.bankDetails?.accountNo || data.bankDetails?.upiId) && (
          <div className="mb-6 border-b py-4">
            <div className="font-bold text-xs">{t("igDocPaymentDetails")}</div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="space-y-1 text-xs">
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
                <div className="font-bold">{t("igDocNotesPlain")}</div>
                <div className="mt-1 whitespace-pre-wrap text-gray-600">{data.notes}</div>
              </div>
            )}

            {data.terms && (
              <div>
                <div className="font-bold">{t("igTermsConditions")}</div>
                <div className="mt-1 whitespace-pre-wrap text-gray-600">{data.terms}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
