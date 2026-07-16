import { Phone, MapPin } from "lucide-react";
import type { QrMenuData, DietTag } from "@/lib/qrmenu";

// FSSAI-style diet markers: green square + dot for veg, red square + triangle
// for non-veg — instantly recognisable to Indian diners.
function DietMark({ tag }: { tag: DietTag }) {
  if (!tag) return null;
  const color = tag === "veg" ? "#1B7A43" : "#B3261E";
  return (
    <span
      className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center border-2"
      style={{ borderColor: color }}
      title={tag === "veg" ? "Vegetarian" : "Non-vegetarian"}
      aria-label={tag === "veg" ? "Vegetarian" : "Non-vegetarian"}
    >
      {tag === "veg" ? (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span
          className="h-0 w-0 border-x-4 border-b-8 border-x-transparent"
          style={{ borderBottomColor: color }}
        />
      )}
    </span>
  );
}

export function MenuDisplay({ menu }: { menu: QrMenuData }) {
  const accent = menu.accent || "#26306B";
  const categories = menu.categories.filter(
    (category) => category.name.trim() || category.items.some((item) => item.name.trim())
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-muted-line/30 bg-white shadow-sm">
      {/* Header */}
      <div className="px-6 py-8 text-center text-white" style={{ backgroundColor: accent }}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {menu.restaurantName.trim() || "Your Restaurant"}
        </h1>
        {menu.tagline.trim() && (
          <p className="mt-2 text-sm text-white/80 sm:text-base">{menu.tagline}</p>
        )}
        {(menu.phone.trim() || menu.address.trim()) && (
          <div className="mt-4 flex flex-col items-center gap-1.5 text-xs text-white/80 sm:text-sm">
            {menu.phone.trim() && (
              <a
                href={`tel:${menu.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {menu.phone}
              </a>
            )}
            {menu.address.trim() && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                {menu.address}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="divide-y divide-muted-line/20">
        {categories.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-muted">
            No menu items yet. Add categories and dishes to see them here.
          </p>
        )}
        {categories.map((category, index) => {
          const items = category.items.filter((item) => item.name.trim());
          return (
            <section key={category.id || index} className="px-6 py-6">
              <h2
                className="mb-4 text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {category.name.trim() || `Category ${index + 1}`}
              </h2>
              <ul className="space-y-4">
                {items.map((item, itemIndex) => (
                  <li key={item.id || itemIndex} className="flex items-start gap-3">
                    <span className="mt-0.5">
                      <DietMark tag={item.tag} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold text-ink">{item.name}</h3>
                        {item.price.trim() && (
                          <span className="whitespace-nowrap font-semibold text-ink">
                            {/^[0-9]/.test(item.price.trim()) ? `₹${item.price.trim()}` : item.price.trim()}
                          </span>
                        )}
                      </div>
                      {item.description.trim() && (
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-sm text-muted">No items in this category yet.</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-muted-line/20 bg-cream-paper px-6 py-4 text-center">
        <a
          href="/tools/qr-menu-generator"
          className="text-xs text-muted underline-offset-2 hover:underline"
        >
          Free digital menu by Setu Technology
        </a>
      </div>
    </div>
  );
}
