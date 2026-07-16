import { Upload, X } from "lucide-react";
import type { BusinessDetails } from "@/lib/types/invoice";

interface BusinessDetailsSectionProps {
  data: BusinessDetails;
  onChange: (data: Partial<BusinessDetails>) => void;
}

export function BusinessDetailsSection({
  data,
  onChange,
}: BusinessDetailsSectionProps) {
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const logo = event.target?.result as string;
        onChange({ logo });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        Business Details
      </h3>

      <div className="space-y-4">
        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Business Logo (Optional)
          </label>
          {data.logo ? (
            <div className="relative inline-block">
              <img
                src={data.logo}
                alt="Business logo"
                className="h-24 w-24 rounded-lg border border-muted-line/40 object-cover"
              />
              <button
                type="button"
                onClick={() => onChange({ logo: undefined })}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
                aria-label="Remove logo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-muted-line/40 bg-cream/50 px-6 py-8 transition hover:border-indigo hover:bg-indigo/5">
              <Upload className="h-5 w-5 text-muted-warm" />
              <div>
                <p className="text-sm font-semibold text-ink">Click to upload logo</p>
                <p className="text-xs text-muted-warm">PNG, JPG up to 5MB</p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Business Name *</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="Your Business Name"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-ink">Phone</label>
            <input
              type="tel"
              value={data.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink">Email</label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="business@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">Address *</label>
          <textarea
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="Street, City, State, PIN"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">GSTIN (Optional)</label>
          <input
            type="text"
            value={data.gstin || ""}
            onChange={(e) => onChange({ gstin: e.target.value.toUpperCase() })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="27AABCT1234H1Z0"
            maxLength={15}
          />
          <p className="mt-1 text-xs text-muted-warm">
            Format: 2 digits (state) + 10 chars (PAN) + 3 chars
          </p>
        </div>
      </div>
    </div>
  );
}
