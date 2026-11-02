import { describe, expect, it } from "vitest";
import { createSampleMenu, decodeMenu } from "@/lib/qrmenu";
import { linkedMenuPayload, withBranding } from "@/lib/qrmenu-pos-link";

describe("linked free menu branding", () => {
  it("lets the QR tool set only the tagline and colour", () => {
    const menu = createSampleMenu();
    const branded = withBranding(menu, { tagline: " Since 1998 ", accent: "#B3261E" });
    expect(branded.tagline).toBe("Since 1998");
    expect(branded.accent).toBe("#B3261E");
    expect(branded.restaurantName).toBe(menu.restaurantName);
    expect(branded.categories).toBe(menu.categories);
  });

  it("publishes the same payload from either tool", () => {
    const menu = createSampleMenu();
    const branding = { tagline: "Pure veg", accent: "#1B7A43" };
    const payload = linkedMenuPayload(menu, branding);
    expect(payload).toBe(linkedMenuPayload(menu, { ...branding }));
    expect(decodeMenu(payload)).toMatchObject({ tagline: "Pure veg", accent: "#1B7A43" });
  });
});
