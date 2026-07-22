// Calculator-specific translation dictionaries. Kept separate from the shared
// chrome dictionary (./dictionaries.ts) because of volume. English is the base;
// any missing key in another language falls back to English automatically
// (see lib/i18n/index.tsx). Note: on-screen calculator UI is translated here,
// but text baked into generated PDF/Excel exports stays English because the
// jsPDF built-in fonts cannot render Devanagari/Tamil/Arabic glyphs.

import type { LanguageCode } from "./config";

export type CalcDictKey =
  // AOV
  | "aovTotalRevenue"
  | "aovNumOrders"
  | "aovTargetIncrease"
  | "aovCurrent"
  | "aovAtTarget"
  | "aovExtraRevenue"
  // Break-even
  | "beFixedCosts"
  | "beVarCost"
  | "beSellPrice"
  | "beUnits"
  | "beRevenue"
  | "beContribution"
  | "beNote"
  // CAC
  | "cacSpend"
  | "cacNewCustomers"
  | "cacAvgRevenue"
  | "cacCost"
  | "cacRatio"
  // Discount
  | "discOriginalPrice"
  | "discDiscount"
  | "discYouSave"
  | "discFinalPrice"
  // Food cost
  | "fcIngredientCost"
  | "fcMenuPrice"
  | "fcFoodCostPct"
  | "fcGrossProfit"
  | "fcNoteWithin"
  | "fcNoteAbove"
  // Gratuity
  | "gratSalary"
  | "gratYears"
  | "gratPayable"
  | "gratNote"
  // GST
  | "gstAdd"
  | "gstRemove"
  | "gstAmountBefore"
  | "gstAmountIncl"
  | "gstRate"
  | "gstBaseAmount"
  | "gstAmountLabel"
  | "gstTotalAmount"
  // Income tax
  | "itGrossIncome"
  | "itDeductions"
  | "itOldRegime"
  | "itNewRegime"
  | "itNewSaves"
  | "itOldSaves"
  | "itDisclaimer"
  // Inventory turnover
  | "invCogs"
  | "invAvgValue"
  | "invDaysPeriod"
  | "invRatio"
  | "invDio"
  // Liquor cost
  | "lcBottleCost"
  | "lcBottleSize"
  | "lcPourSize"
  | "lcSellPrice"
  | "lcPourCostPct"
  | "lcProfitPerPour"
  | "lcCostPerPour"
  | "lcPoursPerBottle"
  // Loan EMI
  | "emiLoanAmount"
  | "emiInterestRate"
  | "emiTenure"
  | "emiMonths"
  | "emiYears"
  | "emiMonthly"
  | "emiTotalInterest"
  | "emiTotalPayment"
  // Markup
  | "mkCostPrice"
  | "mkTargetMarkup"
  | "mkSellingPrice"
  | "mkProfitPerUnit"
  | "mkResultingMargin"
  // Profit margin
  | "pmProfit"
  | "pmMargin"
  | "pmMarkup"
  // Menu engineering
  | "meMenuItems"
  | "meItemNo"
  | "meItemName"
  | "mePrice"
  | "meCost"
  | "meUnitsSold"
  | "meAddItem"
  | "meItemNamePlaceholder"
  | "mePricePlaceholder"
  | "meCostPlaceholder"
  | "meUnitsPlaceholder"
  | "meTotalRevenue"
  | "meTotalCost"
  | "meTotalContribution"
  | "meAvgMargin"
  | "meStars"
  | "meCashCows"
  | "mePuzzles"
  | "meDogs"
  | "meStarsDesc"
  | "meCashCowsDesc"
  | "mePuzzlesDesc"
  | "meDogsDesc"
  | "meExportExcel"
  | "meExportPdf"
  | "meMargin"
  | "meMarginPct"
  | "meClassification"
  | "meHowToUse"
  | "meStarBadge"
  | "meCashCowBadge"
  | "mePuzzleBadge"
  | "meDogBadge"
  | "meStarsTip"
  | "meCashCowsTip"
  | "mePuzzlesTip"
  | "meDogsTip"
  // Online menu price
  | "ompTakeHome"
  | "ompCommission"
  | "ompGstOnComm"
  | "ompGatewayFee"
  | "ompPackaging"
  | "ompGstCharge"
  | "ompListPrice"
  | "ompMarkup"
  | "ompGstRemit"
  | "ompCommPlusGst"
  | "ompGatewayPackaging"
  | "ompInfeasible"
  | "ompAssumption"
  // Online order commission
  | "oocOrderValue"
  | "oocTotalDeductions"
  | "oocRealPayout"
  | "oocTakeHomePct"
  // Recipe costing
  | "rcServings"
  | "rcTargetFoodCost"
  | "rcTotalCost"
  | "rcCostPerServing"
  | "rcSuggestedPrice"
  | "rcIngredient"
  | "rcCostUsed"
  | "rcIngredientPlaceholder"
  | "rcAddIngredient"
  // Stock reorder point
  | "srDailySales"
  | "srLeadTime"
  | "srSafetyStock"
  | "srReorderAt"
  | "srLeadDemand"
  // Table turnover
  | "ttCovers"
  | "ttTables"
  | "ttServiceLength"
  | "ttRate"
  | "ttAvgTurn"
  // Take-home salary
  | "thCtc"
  | "thBasic"
  | "thProfTax"
  | "thMonthly"
  | "thPf"
  | "thAnnual"
  | "thNote"
  // Tip split
  | "tsEqual"
  | "tsWeighted"
  | "tsPool"
  | "tsAddStaff"
  | "tsHoursShares"
  | "tsStaff"
  | "tsNamePlaceholder"
  // Unit suffixes
  | "unitYrs"
  | "unitDays"
  | "unitMl"
  | "unitUnits"
  | "unitHrs"
  | "unitMin";

export type CalcDict = Record<CalcDictKey, string>;

const en: CalcDict = {
  aovTotalRevenue: "Total revenue (period)",
  aovNumOrders: "Number of orders",
  aovTargetIncrease: "Target AOV increase",
  aovCurrent: "Current AOV",
  aovAtTarget: "AOV at target increase",
  aovExtraRevenue: "Extra revenue, same order volume",
  beFixedCosts: "Fixed costs (per month)",
  beVarCost: "Variable cost per unit",
  beSellPrice: "Selling price per unit",
  beUnits: "Break-even units",
  beRevenue: "Break-even revenue",
  beContribution: "Contribution margin",
  beNote:
    "Your selling price doesn't cover the variable cost per unit, so there's no break-even point — every unit sold loses money. Raise the price or lower the variable cost to make break-even possible.",
  cacSpend: "Marketing & sales spend",
  cacNewCustomers: "New customers acquired",
  cacAvgRevenue: "Average revenue per customer (optional)",
  cacCost: "Customer acquisition cost",
  cacRatio: "Revenue-to-CAC ratio",
  discOriginalPrice: "Original price",
  discDiscount: "Discount",
  discYouSave: "You save",
  discFinalPrice: "Final price",
  fcIngredientCost: "Ingredient cost per dish",
  fcMenuPrice: "Menu selling price",
  fcFoodCostPct: "Food cost %",
  fcGrossProfit: "Gross profit per dish",
  fcNoteWithin: "This is within the typical 28-35% range most restaurants target.",
  fcNoteAbove:
    "This is above the typical 28-35% range — check portioning, wastage or whether the price needs to move.",
  gratSalary: "Last drawn monthly salary (basic + DA)",
  gratYears: "Years of service",
  gratPayable: "Estimated gratuity payable",
  gratNote:
    "Your uncapped calculation works out to {amount}, above the statutory tax-exempt ceiling of ₹20,00,000. This ceiling is revised periodically by the government — confirm the current limit before treating this as a final figure.",
  gstAdd: "Add GST",
  gstRemove: "Remove GST",
  gstAmountBefore: "Amount (before GST)",
  gstAmountIncl: "Amount (including GST)",
  gstRate: "GST Rate",
  gstBaseAmount: "Base amount",
  gstAmountLabel: "GST amount",
  gstTotalAmount: "Total amount",
  itGrossIncome: "Annual gross income",
  itDeductions: "Deductions claimed (old regime — 80C, HRA, etc.)",
  itOldRegime: "Old regime tax (incl. cess)",
  itNewRegime: "New regime tax (incl. cess)",
  itNewSaves: "New regime saves you",
  itOldSaves: "Old regime saves you",
  itDisclaimer:
    "Estimate only, using FY 2025-26 (AY 2026-27) slabs and a simplified Section 87A rebate — it excludes surcharge and several itemised deductions. Tax slabs typically change with each Union Budget, so verify against the latest official slabs or a chartered accountant before filing or making a regime decision.",
  invCogs: "Cost of goods sold (period)",
  invAvgValue: "Average inventory value",
  invDaysPeriod: "Days in period",
  invRatio: "Inventory turnover ratio",
  invDio: "Days inventory outstanding",
  lcBottleCost: "Bottle cost",
  lcBottleSize: "Bottle size",
  lcPourSize: "Pour size",
  lcSellPrice: "Selling price per pour",
  lcPourCostPct: "Pour cost %",
  lcProfitPerPour: "Profit per pour",
  lcCostPerPour: "Cost per pour",
  lcPoursPerBottle: "Pours per bottle",
  emiLoanAmount: "Loan amount",
  emiInterestRate: "Annual interest rate",
  emiTenure: "Tenure",
  emiMonths: "Months",
  emiYears: "Years",
  emiMonthly: "Monthly EMI",
  emiTotalInterest: "Total interest",
  emiTotalPayment: "Total payment",
  mkCostPrice: "Cost price",
  mkTargetMarkup: "Target markup",
  mkSellingPrice: "Selling price",
  mkProfitPerUnit: "Profit per unit",
  mkResultingMargin: "Resulting margin",
  pmProfit: "Profit",
  pmMargin: "Profit margin",
  pmMarkup: "Markup",
  meMenuItems: "Menu Items",
  meItemNo: "Item",
  meItemName: "Item Name",
  mePrice: "Price",
  meCost: "Cost",
  meUnitsSold: "Units Sold",
  meAddItem: "Add Menu Item",
  meItemNamePlaceholder: "Item name",
  mePricePlaceholder: "e.g. 100.50",
  meCostPlaceholder: "e.g. 50.25",
  meUnitsPlaceholder: "e.g. 100",
  meTotalRevenue: "Total Revenue",
  meTotalCost: "Total Cost",
  meTotalContribution: "Total Contribution",
  meAvgMargin: "Avg Margin %",
  meStars: "Stars",
  meCashCows: "Cash Cows",
  mePuzzles: "Puzzles",
  meDogs: "Dogs",
  meStarsDesc: "High margin + High popularity",
  meCashCowsDesc: "High margin + Low popularity",
  mePuzzlesDesc: "Low margin + High popularity",
  meDogsDesc: "Low margin + Low popularity",
  meExportExcel: "Export to Excel",
  meExportPdf: "Export to PDF",
  meMargin: "Margin",
  meMarginPct: "Margin %",
  meClassification: "Classification",
  meHowToUse: "How to Use",
  meStarBadge: "Star",
  meCashCowBadge: "Cash Cow",
  mePuzzleBadge: "Puzzle",
  meDogBadge: "Dog",
  meStarsTip: "High margin + High popularity. Promote these items.",
  meCashCowsTip: "High margin + Low popularity. Increase visibility.",
  mePuzzlesTip: "Low margin + High popularity. Raise prices or reduce costs.",
  meDogsTip: "Low margin + Low popularity. Remove or reposition.",
  ompTakeHome: "Price you want to take home",
  ompCommission: "Platform commission",
  ompGstOnComm: "GST on commission",
  ompGatewayFee: "Payment gateway fee",
  ompPackaging: "Packaging cost",
  ompGstCharge: "GST you charge on this item",
  ompListPrice: "Price to list on the platform",
  ompMarkup: "Markup over your target price",
  ompGstRemit: "GST you'll remit",
  ompCommPlusGst: "Commission + GST on it",
  ompGatewayPackaging: "Gateway fee + packaging",
  ompInfeasible:
    "Commission, GST and fees together add up to 100% or more of the listed price, so no menu price can recover your target take-home on this item. Try lowering the commission or fee inputs, or reconsider listing this item online at this margin.",
  ompAssumption:
    "Assumes commission and gateway fees are charged on the listed price, and that the listed price already includes the GST you charge on the item. Aggregator agreements vary — verify against an actual payout report before rolling out new prices.",
  oocOrderValue: "Order value",
  oocTotalDeductions: "Total deductions",
  oocRealPayout: "Your real payout",
  oocTakeHomePct: "Take-home %",
  rcServings: "Servings this recipe yields",
  rcTargetFoodCost: "Target food cost %",
  rcTotalCost: "Total recipe cost (all servings)",
  rcCostPerServing: "Cost per serving",
  rcSuggestedPrice: "Suggested price per serving",
  rcIngredient: "Ingredient",
  rcCostUsed: "Cost used",
  rcIngredientPlaceholder: "e.g. Paneer",
  rcAddIngredient: "Add ingredient",
  srDailySales: "Average daily sales",
  srLeadTime: "Supplier lead time",
  srSafetyStock: "Safety stock",
  srReorderAt: "Reorder at",
  srLeadDemand: "Lead-time demand",
  ttCovers: "Covers served",
  ttTables: "Number of tables",
  ttServiceLength: "Service length",
  ttRate: "Table turnover rate",
  ttAvgTurn: "Avg. turn time",
  thCtc: "Annual CTC",
  thBasic: "Basic salary (% of CTC)",
  thProfTax: "Monthly professional tax",
  thMonthly: "Monthly take-home",
  thPf: "Employee PF deducted",
  thAnnual: "Annual take-home",
  thNote:
    "Estimate based on typical PF and professional tax assumptions — actual take-home depends on your exact salary structure and any income tax TDS deducted.",
  tsEqual: "Equal split",
  tsWeighted: "By hours / shares",
  tsPool: "Total tip pool",
  tsAddStaff: "Add staff member",
  tsHoursShares: "Hours / shares",
  tsStaff: "Staff",
  tsNamePlaceholder: "e.g. Riya",
  unitYrs: "yrs",
  unitDays: "days",
  unitMl: "ml",
  unitUnits: "units",
  unitHrs: "hrs",
  unitMin: "min",
};

const hi: Partial<CalcDict> = {
  aovTotalRevenue: "कुल आमदनी (अवधि)",
  aovNumOrders: "ऑर्डर की संख्या",
  aovTargetIncrease: "लक्षित AOV वृद्धि",
  aovCurrent: "वर्तमान AOV",
  aovAtTarget: "लक्षित वृद्धि पर AOV",
  aovExtraRevenue: "समान ऑर्डर पर अतिरिक्त आमदनी",
  beFixedCosts: "स्थिर लागत (प्रति माह)",
  beVarCost: "प्रति इकाई परिवर्तनीय लागत",
  beSellPrice: "प्रति इकाई विक्रय मूल्य",
  beUnits: "ब्रेक-ईवन इकाइयाँ",
  beRevenue: "ब्रेक-ईवन आमदनी",
  beContribution: "योगदान मार्जिन",
  beNote:
    "आपका विक्रय मूल्य प्रति इकाई परिवर्तनीय लागत को कवर नहीं करता, इसलिए कोई ब्रेक-ईवन बिंदु नहीं है — बिकने वाली हर इकाई पर नुकसान होता है। ब्रेक-ईवन संभव बनाने के लिए कीमत बढ़ाएँ या परिवर्तनीय लागत घटाएँ।",
  cacSpend: "मार्केटिंग और बिक्री खर्च",
  cacNewCustomers: "नए ग्राहक प्राप्त",
  cacAvgRevenue: "प्रति ग्राहक औसत आमदनी (वैकल्पिक)",
  cacCost: "ग्राहक अधिग्रहण लागत",
  cacRatio: "आमदनी-से-CAC अनुपात",
  discOriginalPrice: "मूल कीमत",
  discDiscount: "छूट",
  discYouSave: "आपकी बचत",
  discFinalPrice: "अंतिम कीमत",
  fcIngredientCost: "प्रति व्यंजन सामग्री लागत",
  fcMenuPrice: "मेन्यू विक्रय मूल्य",
  fcFoodCostPct: "फ़ूड कॉस्ट %",
  fcGrossProfit: "प्रति व्यंजन सकल लाभ",
  fcNoteWithin: "यह अधिकांश रेस्तराँ के लक्षित सामान्य 28-35% दायरे में है।",
  fcNoteAbove:
    "यह सामान्य 28-35% दायरे से ऊपर है — पोर्शनिंग, बर्बादी जाँचें या देखें कि कीमत बदलनी चाहिए या नहीं।",
  gratSalary: "अंतिम मासिक वेतन (मूल + DA)",
  gratYears: "सेवा के वर्ष",
  gratPayable: "अनुमानित देय ग्रेच्युटी",
  gratNote:
    "आपकी बिना सीमा वाली गणना {amount} बनती है, जो ₹20,00,000 की वैधानिक कर-मुक्त सीमा से अधिक है। यह सीमा सरकार द्वारा समय-समय पर संशोधित होती है — इसे अंतिम आंकड़ा मानने से पहले मौजूदा सीमा की पुष्टि करें।",
  gstAdd: "GST जोड़ें",
  gstRemove: "GST हटाएँ",
  gstAmountBefore: "राशि (GST से पहले)",
  gstAmountIncl: "राशि (GST सहित)",
  gstRate: "GST दर",
  gstBaseAmount: "आधार राशि",
  gstAmountLabel: "GST राशि",
  gstTotalAmount: "कुल राशि",
  itGrossIncome: "वार्षिक सकल आय",
  itDeductions: "दावा की गई कटौतियाँ (पुरानी व्यवस्था — 80C, HRA, आदि)",
  itOldRegime: "पुरानी व्यवस्था कर (सेस सहित)",
  itNewRegime: "नई व्यवस्था कर (सेस सहित)",
  itNewSaves: "नई व्यवस्था से आपकी बचत",
  itOldSaves: "पुरानी व्यवस्था से आपकी बचत",
  itDisclaimer:
    "केवल अनुमान, FY 2025-26 (AY 2026-27) स्लैब और सरलीकृत धारा 87A छूट के आधार पर — इसमें सरचार्ज और कई मदवार कटौतियाँ शामिल नहीं हैं। कर स्लैब आमतौर पर हर केंद्रीय बजट में बदलते हैं, इसलिए फाइल करने या व्यवस्था चुनने से पहले नवीनतम आधिकारिक स्लैब या चार्टर्ड अकाउंटेंट से पुष्टि करें।",
  invCogs: "बेचे गए माल की लागत (अवधि)",
  invAvgValue: "औसत इन्वेंट्री मूल्य",
  invDaysPeriod: "अवधि के दिन",
  invRatio: "इन्वेंट्री टर्नओवर अनुपात",
  invDio: "दिन इन्वेंट्री बकाया",
  lcBottleCost: "बोतल की लागत",
  lcBottleSize: "बोतल का आकार",
  lcPourSize: "पौर आकार",
  lcSellPrice: "प्रति पौर विक्रय मूल्य",
  lcPourCostPct: "पौर कॉस्ट %",
  lcProfitPerPour: "प्रति पौर लाभ",
  lcCostPerPour: "प्रति पौर लागत",
  lcPoursPerBottle: "प्रति बोतल पौर",
  emiLoanAmount: "ऋण राशि",
  emiInterestRate: "वार्षिक ब्याज दर",
  emiTenure: "अवधि",
  emiMonths: "महीने",
  emiYears: "वर्ष",
  emiMonthly: "मासिक EMI",
  emiTotalInterest: "कुल ब्याज",
  emiTotalPayment: "कुल भुगतान",
  mkCostPrice: "लागत मूल्य",
  mkTargetMarkup: "लक्षित मार्कअप",
  mkSellingPrice: "विक्रय मूल्य",
  mkProfitPerUnit: "प्रति इकाई लाभ",
  mkResultingMargin: "परिणामी मार्जिन",
  pmProfit: "लाभ",
  pmMargin: "लाभ मार्जिन",
  pmMarkup: "मार्कअप",
  meMenuItems: "मेन्यू आइटम",
  meItemNo: "आइटम",
  meItemName: "आइटम का नाम",
  mePrice: "कीमत",
  meCost: "लागत",
  meUnitsSold: "बिकी इकाइयाँ",
  meAddItem: "मेन्यू आइटम जोड़ें",
  meItemNamePlaceholder: "आइटम का नाम",
  mePricePlaceholder: "उदा. 100.50",
  meCostPlaceholder: "उदा. 50.25",
  meUnitsPlaceholder: "उदा. 100",
  meTotalRevenue: "कुल आमदनी",
  meTotalCost: "कुल लागत",
  meTotalContribution: "कुल योगदान",
  meAvgMargin: "औसत मार्जिन %",
  meStars: "स्टार्स",
  meCashCows: "कैश काउज़",
  mePuzzles: "पज़ल्स",
  meDogs: "डॉग्स",
  meStarsDesc: "उच्च मार्जिन + उच्च लोकप्रियता",
  meCashCowsDesc: "उच्च मार्जिन + कम लोकप्रियता",
  mePuzzlesDesc: "कम मार्जिन + उच्च लोकप्रियता",
  meDogsDesc: "कम मार्जिन + कम लोकप्रियता",
  meExportExcel: "Excel में निर्यात करें",
  meExportPdf: "PDF में निर्यात करें",
  meMargin: "मार्जिन",
  meMarginPct: "मार्जिन %",
  meClassification: "वर्गीकरण",
  meHowToUse: "उपयोग कैसे करें",
  meStarBadge: "स्टार",
  meCashCowBadge: "कैश काउ",
  mePuzzleBadge: "पज़ल",
  meDogBadge: "डॉग",
  meStarsTip: "उच्च मार्जिन + उच्च लोकप्रियता। इन आइटम को बढ़ावा दें।",
  meCashCowsTip: "उच्च मार्जिन + कम लोकप्रियता। दृश्यता बढ़ाएँ।",
  mePuzzlesTip: "कम मार्जिन + उच्च लोकप्रियता। कीमत बढ़ाएँ या लागत घटाएँ।",
  meDogsTip: "कम मार्जिन + कम लोकप्रियता। हटाएँ या पुनः स्थापित करें।",
  ompTakeHome: "जो कीमत आप घर ले जाना चाहते हैं",
  ompCommission: "प्लेटफ़ॉर्म कमीशन",
  ompGstOnComm: "कमीशन पर GST",
  ompGatewayFee: "पेमेंट गेटवे शुल्क",
  ompPackaging: "पैकेजिंग लागत",
  ompGstCharge: "इस आइटम पर आपके द्वारा लगाया GST",
  ompListPrice: "प्लेटफ़ॉर्म पर सूचीबद्ध करने की कीमत",
  ompMarkup: "आपके लक्षित मूल्य पर मार्कअप",
  ompGstRemit: "जो GST आप जमा करेंगे",
  ompCommPlusGst: "कमीशन + उस पर GST",
  ompGatewayPackaging: "गेटवे शुल्क + पैकेजिंग",
  ompInfeasible:
    "कमीशन, GST और शुल्क मिलकर सूचीबद्ध कीमत का 100% या अधिक हो जाते हैं, इसलिए इस आइटम पर कोई भी मेन्यू कीमत आपका लक्षित टेक-होम वापस नहीं दिला सकती। कमीशन या शुल्क कम करके देखें, या इस मार्जिन पर इस आइटम को ऑनलाइन सूचीबद्ध करने पर पुनर्विचार करें।",
  ompAssumption:
    "मान लिया गया है कि कमीशन और गेटवे शुल्क सूचीबद्ध कीमत पर लगते हैं, और सूचीबद्ध कीमत में आपके द्वारा आइटम पर लगाया GST पहले से शामिल है। एग्रीगेटर अनुबंध अलग-अलग होते हैं — नई कीमतें लागू करने से पहले वास्तविक पेआउट रिपोर्ट से पुष्टि करें।",
  oocOrderValue: "ऑर्डर मूल्य",
  oocTotalDeductions: "कुल कटौतियाँ",
  oocRealPayout: "आपका वास्तविक भुगतान",
  oocTakeHomePct: "टेक-होम %",
  rcServings: "यह रेसिपी कितनी सर्विंग देती है",
  rcTargetFoodCost: "लक्षित फ़ूड कॉस्ट %",
  rcTotalCost: "कुल रेसिपी लागत (सभी सर्विंग)",
  rcCostPerServing: "प्रति सर्विंग लागत",
  rcSuggestedPrice: "प्रति सर्विंग सुझाई कीमत",
  rcIngredient: "सामग्री",
  rcCostUsed: "उपयोग की लागत",
  rcIngredientPlaceholder: "उदा. पनीर",
  rcAddIngredient: "सामग्री जोड़ें",
  srDailySales: "औसत दैनिक बिक्री",
  srLeadTime: "आपूर्तिकर्ता लीड टाइम",
  srSafetyStock: "सुरक्षा स्टॉक",
  srReorderAt: "पुनः ऑर्डर करें",
  srLeadDemand: "लीड-टाइम माँग",
  ttCovers: "परोसे गए कवर",
  ttTables: "टेबल की संख्या",
  ttServiceLength: "सेवा अवधि",
  ttRate: "टेबल टर्नओवर दर",
  ttAvgTurn: "औसत टर्न समय",
  thCtc: "वार्षिक CTC",
  thBasic: "मूल वेतन (CTC का %)",
  thProfTax: "मासिक व्यावसायिक कर",
  thMonthly: "मासिक टेक-होम",
  thPf: "कर्मचारी PF कटौती",
  thAnnual: "वार्षिक टेक-होम",
  thNote:
    "सामान्य PF और व्यावसायिक कर मान्यताओं पर आधारित अनुमान — वास्तविक टेक-होम आपके सटीक वेतन ढाँचे और काटे गए आयकर TDS पर निर्भर करता है।",
  tsEqual: "समान बँटवारा",
  tsWeighted: "घंटे / शेयर के अनुसार",
  tsPool: "कुल टिप पूल",
  tsAddStaff: "स्टाफ़ सदस्य जोड़ें",
  tsHoursShares: "घंटे / शेयर",
  tsStaff: "स्टाफ़",
  tsNamePlaceholder: "उदा. रिया",
  unitYrs: "वर्ष",
  unitDays: "दिन",
  unitMl: "ml",
  unitUnits: "इकाई",
  unitHrs: "घंटे",
  unitMin: "मिनट",
};

export const CALC_BASE = en;

export const CALC_DICTIONARIES: Record<LanguageCode, Partial<CalcDict>> = {
  en,
  hi,
  bn: {},
  ta: {},
  te: {},
  mr: {},
  gu: {},
  kn: {},
  ml: {},
  pa: {},
  es: {},
  fr: {},
  ar: {},
  pt: {},
  id: {},
  de: {},
  zh: {},
};
