import { ChevronDown } from "lucide-react";
import type { BankDetails } from "@/lib/types/invoice";

interface BankDetailsSectionProps {
  data: BankDetails | undefined;
  isVisible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onChange: (data: Partial<BankDetails>) => void;
}

export function BankDetailsSection({
  data = {},
  isVisible,
  onVisibilityChange,
  onChange,
}: BankDetailsSectionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onVisibilityChange(!isVisible)}
        className="mb-4 flex w-full items-center gap-2 text-sm font-semibold text-ink transition hover:text-indigo"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isVisible ? "rotate-180" : ""}`}
        />
        Bank & Payment Details (Optional)
      </button>

      {isVisible && (
        <div className="space-y-4 border-l-2 border-indigo/20 pl-4">
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
      )}
    </div>
  );
}
