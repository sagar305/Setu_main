// UPI ID validation and formatting
// UPI format: username@bankname
// Username can be alphanumeric, dots, hyphens, underscores (2-60 chars)
// Bank name is fixed list of valid PSP providers

const VALID_PSP_PROVIDERS = [
  "airtel",
  "airtelpaymentsbank",
  "allbank",
  "andb",
  "aubank",
  "axisbank",
  "barodabob",
  "barodampay",
  "baroda",
  "birlasoft",
  "bkid",
  "boi",
  "boibank",
  "cbin",
  "centralbank",
  "citi",
  "citibankupi",
  "citigold",
  "cityupi",
  "corp",
  "corpbank",
  "csb",
  "csbbank",
  "dbs",
  "deutsche",
  "digi",
  "digibank",
  "dmbank",
  "dmbk",
  "emandate",
  "ezeepay",
  "federalbank",
  "federal",
  "fbl",
  "fintoo",
  "fisl",
  "flipkart",
  "flipsmart",
  "fpt",
  "frb",
  "google-pay",
  "googleplay",
  "gpl",
  "gratis",
  "gratisbank",
  "gscb",
  "gscbil",
  "hdfc",
  "hdfcbank",
  "hsbc",
  "hsbcupi",
  "ibl",
  "idfcbank",
  "idfc",
  "ikwik",
  "imobile",
  "indus",
  "indusind",
  "iob",
  "iplbank",
  "ippsl",
  "isf",
  "itin",
  "jio",
  "jiomoney",
  "kbl",
  "kblbank",
  "kmbl",
  "kotak",
  "kotakbank",
  "kmbl",
  "okaxis",
  "okicici",
  "okhdfcbank",
  "okhdfcupi",
  "okaxis",
  "omhbank",
  "pnb",
  "pnbindia",
  "postbank",
  "ppl",
  "psb",
  "public",
  "pubank",
  "pushpin",
  "pymnt",
  "pypl",
  "rabobank",
  "rbl",
  "rblbank",
  "republic",
  "res",
  "rmhbank",
  "rmh",
  "sbi",
  "sbiupi",
  "scb",
  "sc",
  "scbindia",
  "scmp",
  "scmobile",
  "scnri",
  "scupi",
  "scwallet",
  "src",
  "srcb",
  "srcbindia",
  "sunbank",
  "suryagold",
  "syndbank",
  "syndicatebank",
  "syndicate",
  "thesouthindianbank",
  "thebank",
  "timecosmos",
  "tjsb",
  "tjsbbank",
  "tnb",
  "tnbbank",
  "transcode",
  "tsp",
  "ttbank",
  "tvm",
  "tvmoney",
  "ubank",
  "ubaroda",
  "uboi",
  "udf",
  "uibl",
  "ujivan",
  "ujvnc",
  "ulips",
  "unibank",
  "unionbank",
  "unionbankofindia",
  "unitedbank",
  "united",
  "upi",
  "upibob",
  "upiicici",
  "upiybl",
  "upiaxis",
  "upibankofbaroda",
  "wallet",
  "wibmo",
  "ybl",
  "yono",
  "yonoindusind",
  "yourstmt",
  "yphone",
  "zppl",
];

// Currencies for which UPI payment is offered. UPI is an India (INR) rail —
// even where cross-border UPI acceptance exists, the merchant is paid in INR.
// Add more codes here if another currency's rail is ever supported.
const UPI_CURRENCIES = new Set(["INR"]);

export function supportsUpi(currency: string | undefined): boolean {
  return !!currency && UPI_CURRENCIES.has(currency.toUpperCase());
}

export function isValidUPIId(upiId: string): boolean {
  if (!upiId || typeof upiId !== "string") {
    return false;
  }

  const upiId_lower = upiId.toLowerCase().trim();

  // Check if it contains exactly one @
  if ((upiId_lower.match(/@/g) || []).length !== 1) {
    return false;
  }

  const [username, provider] = upiId_lower.split("@");

  // Validate username part (2-60 chars, alphanumeric, dots, hyphens, underscores)
  if (!username || username.length < 2 || username.length > 60) {
    return false;
  }

  const usernameRegex = /^[a-z0-9._-]+$/;
  if (!usernameRegex.test(username)) {
    return false;
  }

  // Validate provider part
  if (!provider || !VALID_PSP_PROVIDERS.includes(provider)) {
    return false;
  }

  return true;
}

export function formatUPIId(upiId: string): string {
  return upiId.toLowerCase().trim();
}

export function generateUPIUrl(
  upiId: string,
  amount?: number,
  notes?: string,
  businessName?: string
): string {
  const formattedUPI = formatUPIId(upiId);

  const params = new URLSearchParams();
  params.set("pa", formattedUPI);

  if (businessName) {
    params.set("pn", businessName);
  }

  if (amount && amount > 0) {
    params.set("am", String(Math.round(amount * 100) / 100)); // Ensure 2 decimal places
  }

  if (notes) {
    params.set("tn", notes);
  } else {
    params.set("tn", "Payment");
  }

  return `upi://pay?${params.toString()}`;
}
