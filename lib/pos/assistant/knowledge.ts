// What the assistant knows about the POS itself.
//
// Each article answers one "how do I…" question in the words of the screen it
// points to. `phrases` are the ways people actually ask — in English and in
// Hinglish — and are what retrieval scores against; `keywords` are the few
// words that, on their own, make an article the likely answer. Keep answers
// short enough to read at the counter, and keep them true: when a screen's
// labels change, the article that names them changes with it.

import type { ScreenId } from "@/components/tools/FreePos/nav";

export type HelpArticle = {
  id: string;
  title: string;
  phrases: string[];
  keywords: string[];
  answer: string[];
  /** The screen the answer is about, offered as a one-tap "Take me there". */
  screen?: ScreenId;
  /** A command the assistant can run for the user instead, offered as a chip. */
  tryCommand?: string;
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "add-product",
    title: "Add a product",
    phrases: ["how do i add a product", "add new item", "create product", "naya product kaise dale", "add item to menu"],
    keywords: ["product", "item", "naya"],
    answer: [
      "Open Products and press Add product. Only the name and selling price are required.",
      "Turn on Track stock to enter the opening stock; cost price is optional but makes profit reports work.",
      "Or just tell me: “add product Maggi at 14 with 50 stock”.",
    ],
    screen: "products",
    tryCommand: "add product Maggi at 14 with 50 stock",
  },
  {
    id: "stock",
    title: "Add or reduce stock",
    phrases: ["how do i add stock", "update stock", "restock", "stock kaise badhaye", "inventory update", "stock received"],
    keywords: ["stock", "inventory", "restock", "maal"],
    answer: [
      "On Products, use the Adjust stock button on a product's row — choose Add stock, Reduce stock or set an exact count, with an optional note.",
      "Every change is logged, and sales reduce stock automatically.",
      "Or tell me: “add 24 stock to Maggi” or “set Maggi stock to 10”.",
    ],
    screen: "products",
    tryCommand: "add 24 stock to Maggi",
  },
  {
    id: "low-stock",
    title: "Low-stock alerts",
    phrases: ["low stock alert", "which items are running out", "low stock threshold", "khatam hone wala maal"],
    keywords: ["low", "threshold", "running", "khatam"],
    answer: [
      "A tracked product counts as low when its stock is at or below its low-stock threshold (5 unless you set another on the product).",
      "The Dashboard's Stock status card lists them. Ask me “what is low on stock?” any time.",
    ],
    screen: "dashboard",
    tryCommand: "what is low on stock?",
  },
  {
    id: "sell",
    title: "Make a sale",
    phrases: ["how do i make a bill", "how to sell", "create invoice", "bill kaise banaye", "checkout", "billing"],
    keywords: ["bill", "sale", "sell", "invoice", "checkout", "billing"],
    answer: [
      "Open New Sale, tap products (or scan a barcode into the search box and press Enter) to fill the cart.",
      "Pick a payment method and press Charge. The receipt opens straight after.",
      "Or tell me: “sell 2 Maggi and 1 Coke by UPI” and I'll record it after you confirm.",
    ],
    screen: "sell",
    tryCommand: "sell 2 Maggi by cash",
  },
  {
    id: "barcode",
    title: "Use a barcode scanner",
    phrases: ["barcode scanner", "scan barcode", "how to scan products", "scanner kaise lagaye"],
    keywords: ["barcode", "scanner", "scan"],
    answer: [
      "Any USB or Bluetooth scanner that types like a keyboard works — no setup.",
      "Save the barcode on the product, then on New Sale click the search box and scan: an exact barcode or SKU match is added to the cart instantly.",
      "Need labels? The Barcode Generator tool prints them from your saved products.",
    ],
    screen: "sell",
  },
  {
    id: "discount",
    title: "Give a discount",
    phrases: ["how do i give discount", "apply discount", "discount kaise de", "percentage off"],
    keywords: ["discount", "off", "chhoot"],
    answer: [
      "On New Sale, under Discount, choose flat amount or percent and type the value.",
      "Tax is worked out on the discounted amount, so the bill stays correct.",
    ],
    screen: "sell",
  },
  {
    id: "tax",
    title: "Set up GST / tax",
    phrases: ["how do i add gst", "set tax rate", "gst kaise lagaye", "tax inclusive price", "enable tax"],
    keywords: ["gst", "tax", "vat", "inclusive"],
    answer: [
      "Settings → Invoice, tax & receipt: switch tax on and set the default rate.",
      "Each product can override the rate and say whether its price already includes tax.",
      "Your GSTIN (tax number) goes in Settings → Business profile, and prints on the receipt.",
    ],
    screen: "settings",
  },
  {
    id: "hold",
    title: "Hold a bill",
    phrases: ["hold the bill", "park cart", "serve another customer", "bill rok ke rakho", "recall held cart"],
    keywords: ["hold", "park", "recall", "held"],
    answer: [
      "On New Sale press Hold to park the cart with an optional note, and serve the next customer.",
      "Press Recall to bring a held cart back exactly as it was.",
    ],
    screen: "sell",
  },
  {
    id: "past-sale",
    title: "Record an old sale",
    phrases: ["record past sale", "backdate bill", "forgot to enter sale yesterday", "purani sale", "import sales"],
    keywords: ["past", "backdate", "old", "yesterday", "purani", "import"],
    answer: [
      "On New Sale tick Record a past sale and pick the date and time before you charge.",
      "For many at once, Orders → Import past sales takes a CSV or Excel file.",
    ],
    screen: "orders",
  },
  {
    id: "credit",
    title: "Credit / Udhaar sales",
    phrases: ["give credit to customer", "udhaar kaise likhe", "credit sale", "pay later", "khata"],
    keywords: ["credit", "udhaar", "udhar", "khata", "later"],
    answer: [
      "Switch on Customer Ledger in Settings → Connected tools (it is on by default).",
      "Then on New Sale choose a saved customer and pick Credit (Udhaar) as the payment. The amount posts to their ledger automatically.",
    ],
    screen: "settings",
  },
  {
    id: "receipt",
    title: "Print or share a receipt",
    phrases: ["print receipt", "printer setup", "thermal printer", "share bill on whatsapp", "reprint bill", "58mm printer"],
    keywords: ["print", "printer", "receipt", "thermal", "whatsapp", "reprint", "share"],
    answer: [
      "After every sale the receipt opens — print it or share the invoice from there.",
      "To reprint, open Orders, find the bill and choose View / print receipt.",
      "Paper size (80 mm, 58 mm or A4) and the footer line are in Settings → Invoice, tax & receipt.",
    ],
    screen: "orders",
  },
  {
    id: "cancel",
    title: "Cancel or refund a bill",
    phrases: ["cancel bill", "refund order", "wrong bill", "bill galat ho gaya", "void invoice", "return"],
    keywords: ["cancel", "refund", "void", "return", "galat"],
    answer: [
      "Open Orders, find the bill and choose Cancel order. Stock for its items is put back and it leaves your sales totals.",
      "Or tell me the invoice number: “cancel INV-00012”.",
    ],
    screen: "orders",
  },
  {
    id: "customers",
    title: "Save customers",
    phrases: ["add customer", "save customer phone", "customer list", "grahak jodo"],
    keywords: ["customer", "customers", "grahak", "client"],
    answer: [
      "Customers → Add new customer saves a name, phone and notes. Pick them at checkout to keep their purchase history.",
      "Or tell me: “add customer Ramesh 9876543210”.",
    ],
    screen: "customers",
    tryCommand: "add customer Ramesh 9876543210",
  },
  {
    id: "reports",
    title: "Reports and exports",
    phrases: ["sales report", "export to excel", "download csv", "profit report", "daily report", "hisaab"],
    keywords: ["report", "reports", "export", "csv", "excel", "profit", "hisaab"],
    answer: [
      "Reports shows sales, top products and payment split for any period.",
      "Export data (CSV) at the bottom downloads orders, items, products and customers for Excel or your accountant.",
      "You can also just ask me: “sales this month” or “top products this week”.",
    ],
    screen: "reports",
    tryCommand: "sales this month",
  },
  {
    id: "backup",
    title: "Backup and restore",
    phrases: ["backup my data", "restore backup", "move to new computer", "data kaise bachaye", "new phone"],
    keywords: ["backup", "restore", "move", "transfer", "computer", "phone"],
    answer: [
      "Your data lives only in this browser. Settings → Backup & restore → Export backup (JSON) saves everything to one file.",
      "On the new device open the POS and use Restore from backup with that file.",
      "Say “take a backup” and I'll download one now.",
    ],
    screen: "settings",
    tryCommand: "take a backup",
  },
  {
    id: "sheet",
    title: "Google Sheet sync",
    phrases: ["sync with google sheet", "use on two devices", "multiple counters", "cloud sync"],
    keywords: ["sheet", "sheets", "google", "sync", "devices", "cloud"],
    answer: [
      "Settings → Google Sheet sync connects your own Google Sheet through an Apps Script link, with step-by-step setup on that card.",
      "Changes are pushed to the sheet, and another device can restore from it. Your data goes only to your own sheet.",
    ],
    screen: "settings",
  },
  {
    id: "pin",
    title: "Counter PIN lock",
    phrases: ["set a pin", "lock the pos", "password protect", "staff should not see", "auto lock"],
    keywords: ["pin", "lock", "password", "security"],
    answer: [
      "Settings → Counter lock: set a 4–8 digit PIN. The POS asks for it when it opens and can lock itself after idle minutes.",
      "Once a PIN is set, the lock button next to search locks the counter instantly.",
    ],
    screen: "settings",
  },
  {
    id: "payments",
    title: "Payment methods",
    phrases: ["add payment method", "add paytm", "upi qr", "payment options"],
    keywords: ["payment", "upi", "paytm", "phonepe", "gpay", "qr", "card"],
    answer: [
      "Cash, UPI and Card are ready. Add more (Paytm, PhonePe…) under Settings → Payment methods.",
      "Put your UPI ID in Settings → Business profile to collect UPI payments against your bills.",
    ],
    screen: "settings",
  },
  {
    id: "invoice-number",
    title: "Invoice numbering",
    phrases: ["change invoice number", "invoice prefix", "bill number series", "start invoice from"],
    keywords: ["prefix", "numbering", "series", "number"],
    answer: [
      "Settings → Invoice, tax & receipt sets the prefix (like INV-) and the next number. Numbers never repeat, even after a restore.",
    ],
    screen: "settings",
  },
  {
    id: "offline",
    title: "Working offline",
    phrases: ["does it work without internet", "offline mode", "internet gaya", "no internet"],
    keywords: ["offline", "internet", "network", "wifi"],
    answer: [
      "Yes. Once the page has loaded, billing, stock, customers, reports — and I — all keep working with no internet.",
      "Everything is saved in this browser as you go.",
    ],
  },
  {
    id: "privacy",
    title: "Where is my data?",
    phrases: ["where is my data stored", "is my data safe", "do you see my sales", "data kaha hai", "login"],
    keywords: ["data", "privacy", "safe", "stored", "login", "account"],
    answer: [
      "Everything — products, sales, customers — is stored only in this browser on this device. There is no login and nothing is sent to us.",
      "This assistant runs on your device too: your questions and your data never leave it.",
      "Take regular backups, because clearing browser data would erase it.",
    ],
  },
  {
    id: "tools",
    title: "Connected tools",
    phrases: ["what other tools", "expense tracker", "stock register", "connected tools", "profit dashboard"],
    keywords: ["tools", "expense", "expenses", "purchase", "supplier", "ledger"],
    answer: [
      "Settings → Connected tools lists free tools that read the same data: Customer Ledger, Expense Tracker, Purchase Register, Profit Dashboard, Stock Register, Barcode Generator and more.",
      "Switching one on needs no re-typing — it already sees your products, customers and sales.",
    ],
    screen: "settings",
  },
  {
    id: "reset",
    title: "Delete everything",
    phrases: ["delete all data", "reset pos", "start fresh", "clear everything"],
    keywords: ["reset", "delete", "clear", "fresh"],
    answer: [
      "Settings → Danger zone → Delete all data wipes this browser's POS. Export a backup first — it cannot be undone.",
      "I won't do this one for you.",
    ],
    screen: "settings",
  },
];
