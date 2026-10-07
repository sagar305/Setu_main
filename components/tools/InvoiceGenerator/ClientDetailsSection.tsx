import type { ClientDetails } from "@/lib/types/invoice";
import { useI18n } from "@/lib/i18n";

interface ClientDetailsSectionProps {
  data: ClientDetails;
  onChange: (data: Partial<ClientDetails>) => void;
}

export function ClientDetailsSection({
  data,
  onChange,
}: ClientDetailsSectionProps) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        {t("igBillTo")}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink">{t("igClientNameReq")}</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder={t("igClientNamePlaceholder")}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">{t("igAddressReq")}</label>
          <textarea
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder={t("igAddressPlaceholder")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-ink">{t("phone")}</label>
            <input
              type="tel"
              value={data.phone || ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink">{t("email")}</label>
            <input
              type="email"
              value={data.email || ""}
              onChange={(e) => onChange({ email: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="client@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">{t("igGstinOptional")}</label>
          <input
            type="text"
            value={data.gstin || ""}
            onChange={(e) => onChange({ gstin: e.target.value.toUpperCase() })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="27AABCT5678H2Z0"
            maxLength={15}
          />
          <p className="mt-1 text-xs text-muted-warm">{t("igB2cHint")}</p>
        </div>
      </div>
    </div>
  );
}
