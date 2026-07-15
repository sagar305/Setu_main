import type { BankDetails } from "@/lib/types/invoice";

interface BankDetailsSectionProps {
  data: BankDetails | undefined;
  onChange: (data: Partial<BankDetails>) => void;
}

export function BankDetailsSection({
  data = {},
  onChange,
}: BankDetailsSectionProps) {
  return (
    <div>
      <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink">
              Account Number
            </label>
            <input
              type="text"
              value={data.accountNo || ""}
              onChange={(e) => onChange({ accountNo: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="1234567890"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-ink">IFSC Code</label>
              <input
                type="text"
                value={data.ifsc || ""}
                onChange={(e) => onChange({ ifsc: e.target.value.toUpperCase() })}
                className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
                placeholder="SBIN0001234"
                maxLength={11}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink">UPI ID</label>
              <input
                type="text"
                value={data.upiId || ""}
                onChange={(e) => onChange({ upiId: e.target.value.toLowerCase() })}
                className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
                placeholder="name@upi"
              />
            </div>
          </div>
      </div>
    </div>
  );
}
