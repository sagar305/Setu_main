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

const bn: Partial<CalcDict> = {
  aovTotalRevenue: "মোট আয় (সময়কাল)",
  aovNumOrders: "অর্ডারের সংখ্যা",
  aovTargetIncrease: "লক্ষ্যমাত্রা AOV বৃদ্ধি",
  aovCurrent: "বর্তমান AOV",
  aovAtTarget: "লক্ষ্যমাত্রা বৃদ্ধিতে AOV",
  aovExtraRevenue: "একই অর্ডারে অতিরিক্ত আয়",
  beFixedCosts: "স্থির খরচ (প্রতি মাস)",
  beVarCost: "প্রতি একক পরিবর্তনশীল খরচ",
  beSellPrice: "প্রতি একক বিক্রয়মূল্য",
  beUnits: "ব্রেক-ইভেন একক",
  beRevenue: "ব্রেক-ইভেন আয়",
  beContribution: "কন্ট্রিবিউশন মার্জিন",
  beNote:
    "আপনার বিক্রয়মূল্য প্রতি এককের পরিবর্তনশীল খরচ কভার করে না, তাই কোনো ব্রেক-ইভেন পয়েন্ট নেই — বিক্রি হওয়া প্রতিটি এককে লোকসান হয়। ব্রেক-ইভেন সম্ভব করতে দাম বাড়ান বা পরিবর্তনশীল খরচ কমান।",
  cacSpend: "মার্কেটিং ও বিক্রয় খরচ",
  cacNewCustomers: "নতুন গ্রাহক অর্জিত",
  cacAvgRevenue: "প্রতি গ্রাহক গড় আয় (ঐচ্ছিক)",
  cacCost: "গ্রাহক অধিগ্রহণ খরচ",
  cacRatio: "আয়-থেকে-CAC অনুপাত",
  discOriginalPrice: "মূল দাম",
  discDiscount: "ছাড়",
  discYouSave: "আপনি সাশ্রয় করেন",
  discFinalPrice: "চূড়ান্ত দাম",
  fcIngredientCost: "প্রতি পদের উপকরণ খরচ",
  fcMenuPrice: "মেনু বিক্রয়মূল্য",
  fcFoodCostPct: "ফুড কস্ট %",
  fcGrossProfit: "প্রতি পদে মোট লাভ",
  fcNoteWithin: "এটি বেশিরভাগ রেস্তোরাঁর লক্ষ্যমাত্রা সাধারণ 28-35% পরিসরের মধ্যে।",
  fcNoteAbove:
    "এটি সাধারণ 28-35% পরিসরের উপরে — পোরশনিং, অপচয় যাচাই করুন বা দাম বদলানো দরকার কিনা দেখুন।",
  gratSalary: "সর্বশেষ মাসিক বেতন (মূল + DA)",
  gratYears: "চাকরির বছর",
  gratPayable: "আনুমানিক প্রদেয় গ্র্যাচুইটি",
  gratNote:
    "আপনার সীমাহীন হিসাব দাঁড়ায় {amount}, যা ₹20,00,000 এর বিধিবদ্ধ কর-মুক্ত সীমার উপরে। এই সীমা সরকার সময়ে সময়ে সংশোধন করে — এটিকে চূড়ান্ত হিসাব ধরার আগে বর্তমান সীমা নিশ্চিত করুন।",
  gstAdd: "GST যোগ করুন",
  gstRemove: "GST বাদ দিন",
  gstAmountBefore: "পরিমাণ (GST এর আগে)",
  gstAmountIncl: "পরিমাণ (GST সহ)",
  gstRate: "GST হার",
  gstBaseAmount: "ভিত্তি পরিমাণ",
  gstAmountLabel: "GST পরিমাণ",
  gstTotalAmount: "মোট পরিমাণ",
  itGrossIncome: "বার্ষিক মোট আয়",
  itDeductions: "দাবিকৃত ছাড় (পুরনো ব্যবস্থা — 80C, HRA, ইত্যাদি)",
  itOldRegime: "পুরনো ব্যবস্থার কর (সেস সহ)",
  itNewRegime: "নতুন ব্যবস্থার কর (সেস সহ)",
  itNewSaves: "নতুন ব্যবস্থায় আপনার সাশ্রয়",
  itOldSaves: "পুরনো ব্যবস্থায় আপনার সাশ্রয়",
  itDisclaimer:
    "শুধুমাত্র আনুমানিক, FY 2025-26 (AY 2026-27) স্ল্যাব এবং সরলীকৃত ধারা 87A রিবেট ব্যবহার করে — এতে সারচার্জ ও বেশ কিছু আইটেমাইজড ছাড় বাদ। কর স্ল্যাব সাধারণত প্রতিটি কেন্দ্রীয় বাজেটে বদলায়, তাই ফাইল করার বা ব্যবস্থা বাছার আগে সর্বশেষ সরকারি স্ল্যাব বা একজন চার্টার্ড অ্যাকাউন্ট্যান্টের সঙ্গে যাচাই করুন।",
  invCogs: "বিক্রীত পণ্যের খরচ (সময়কাল)",
  invAvgValue: "গড় ইনভেন্টরি মূল্য",
  invDaysPeriod: "সময়কালের দিন",
  invRatio: "ইনভেন্টরি টার্নওভার অনুপাত",
  invDio: "দিন ইনভেন্টরি বকেয়া",
  lcBottleCost: "বোতলের খরচ",
  lcBottleSize: "বোতলের আকার",
  lcPourSize: "পোর আকার",
  lcSellPrice: "প্রতি পোর বিক্রয়মূল্য",
  lcPourCostPct: "পোর কস্ট %",
  lcProfitPerPour: "প্রতি পোরে লাভ",
  lcCostPerPour: "প্রতি পোরে খরচ",
  lcPoursPerBottle: "প্রতি বোতলে পোর",
  emiLoanAmount: "ঋণের পরিমাণ",
  emiInterestRate: "বার্ষিক সুদের হার",
  emiTenure: "মেয়াদ",
  emiMonths: "মাস",
  emiYears: "বছর",
  emiMonthly: "মাসিক EMI",
  emiTotalInterest: "মোট সুদ",
  emiTotalPayment: "মোট পরিশোধ",
  mkCostPrice: "ক্রয়মূল্য",
  mkTargetMarkup: "লক্ষ্যমাত্রা মার্কআপ",
  mkSellingPrice: "বিক্রয়মূল্য",
  mkProfitPerUnit: "প্রতি এককে লাভ",
  mkResultingMargin: "ফলিত মার্জিন",
  pmProfit: "লাভ",
  pmMargin: "লাভ মার্জিন",
  pmMarkup: "মার্কআপ",
  meMenuItems: "মেনু আইটেম",
  meItemNo: "আইটেম",
  meItemName: "আইটেমের নাম",
  mePrice: "দাম",
  meCost: "খরচ",
  meUnitsSold: "বিক্রীত একক",
  meAddItem: "মেনু আইটেম যোগ করুন",
  meItemNamePlaceholder: "আইটেমের নাম",
  mePricePlaceholder: "যেমন 100.50",
  meCostPlaceholder: "যেমন 50.25",
  meUnitsPlaceholder: "যেমন 100",
  meTotalRevenue: "মোট আয়",
  meTotalCost: "মোট খরচ",
  meTotalContribution: "মোট কন্ট্রিবিউশন",
  meAvgMargin: "গড় মার্জিন %",
  meStars: "স্টার",
  meCashCows: "ক্যাশ কাউ",
  mePuzzles: "পাজল",
  meDogs: "ডগ",
  meStarsDesc: "উচ্চ মার্জিন + উচ্চ জনপ্রিয়তা",
  meCashCowsDesc: "উচ্চ মার্জিন + কম জনপ্রিয়তা",
  mePuzzlesDesc: "কম মার্জিন + উচ্চ জনপ্রিয়তা",
  meDogsDesc: "কম মার্জিন + কম জনপ্রিয়তা",
  meExportExcel: "Excel-এ এক্সপোর্ট",
  meExportPdf: "PDF-এ এক্সপোর্ট",
  meMargin: "মার্জিন",
  meMarginPct: "মার্জিন %",
  meClassification: "শ্রেণিবিভাগ",
  meHowToUse: "কীভাবে ব্যবহার করবেন",
  meStarBadge: "স্টার",
  meCashCowBadge: "ক্যাশ কাউ",
  mePuzzleBadge: "পাজল",
  meDogBadge: "ডগ",
  meStarsTip: "উচ্চ মার্জিন + উচ্চ জনপ্রিয়তা। এই আইটেমগুলো প্রচার করুন।",
  meCashCowsTip: "উচ্চ মার্জিন + কম জনপ্রিয়তা। দৃশ্যমানতা বাড়ান।",
  mePuzzlesTip: "কম মার্জিন + উচ্চ জনপ্রিয়তা। দাম বাড়ান বা খরচ কমান।",
  meDogsTip: "কম মার্জিন + কম জনপ্রিয়তা। সরান বা পুনঃস্থাপন করুন।",
  ompTakeHome: "যে দাম আপনি ঘরে নিতে চান",
  ompCommission: "প্ল্যাটফর্ম কমিশন",
  ompGstOnComm: "কমিশনের উপর GST",
  ompGatewayFee: "পেমেন্ট গেটওয়ে ফি",
  ompPackaging: "প্যাকেজিং খরচ",
  ompGstCharge: "এই আইটেমে আপনি যে GST ধার্য করেন",
  ompListPrice: "প্ল্যাটফর্মে তালিকাভুক্ত করার দাম",
  ompMarkup: "আপনার লক্ষ্য দামের উপর মার্কআপ",
  ompGstRemit: "যে GST আপনি জমা দেবেন",
  ompCommPlusGst: "কমিশন + তার উপর GST",
  ompGatewayPackaging: "গেটওয়ে ফি + প্যাকেজিং",
  ompInfeasible:
    "কমিশন, GST ও ফি মিলে তালিকাভুক্ত দামের 100% বা বেশি হয়ে যায়, তাই কোনো মেনু দাম এই আইটেমে আপনার লক্ষ্য টেক-হোম ফিরিয়ে দিতে পারে না। কমিশন বা ফি কমিয়ে দেখুন, বা এই মার্জিনে এই আইটেম অনলাইনে তালিকাভুক্ত করা পুনর্বিবেচনা করুন।",
  ompAssumption:
    "ধরে নেওয়া হয়েছে কমিশন ও গেটওয়ে ফি তালিকাভুক্ত দামের উপর ধার্য হয়, এবং তালিকাভুক্ত দামে আপনার আইটেমে ধার্য GST ইতিমধ্যে অন্তর্ভুক্ত। অ্যাগ্রিগেটর চুক্তি ভিন্ন হয় — নতুন দাম চালুর আগে প্রকৃত পেআউট রিপোর্টের সঙ্গে যাচাই করুন।",
  oocOrderValue: "অর্ডার মূল্য",
  oocTotalDeductions: "মোট কর্তন",
  oocRealPayout: "আপনার প্রকৃত পেআউট",
  oocTakeHomePct: "টেক-হোম %",
  rcServings: "এই রেসিপি যত সার্ভিং দেয়",
  rcTargetFoodCost: "লক্ষ্যমাত্রা ফুড কস্ট %",
  rcTotalCost: "মোট রেসিপি খরচ (সব সার্ভিং)",
  rcCostPerServing: "প্রতি সার্ভিং খরচ",
  rcSuggestedPrice: "প্রতি সার্ভিং প্রস্তাবিত দাম",
  rcIngredient: "উপকরণ",
  rcCostUsed: "ব্যবহৃত খরচ",
  rcIngredientPlaceholder: "যেমন পনির",
  rcAddIngredient: "উপকরণ যোগ করুন",
  srDailySales: "গড় দৈনিক বিক্রয়",
  srLeadTime: "সরবরাহকারী লিড টাইম",
  srSafetyStock: "সেফটি স্টক",
  srReorderAt: "পুনরায় অর্ডার করুন",
  srLeadDemand: "লিড-টাইম চাহিদা",
  ttCovers: "পরিবেশিত কভার",
  ttTables: "টেবিলের সংখ্যা",
  ttServiceLength: "সেবার সময়কাল",
  ttRate: "টেবিল টার্নওভার হার",
  ttAvgTurn: "গড় টার্ন সময়",
  thCtc: "বার্ষিক CTC",
  thBasic: "মূল বেতন (CTC-এর %)",
  thProfTax: "মাসিক পেশাদার কর",
  thMonthly: "মাসিক টেক-হোম",
  thPf: "কর্মচারী PF কর্তন",
  thAnnual: "বার্ষিক টেক-হোম",
  thNote:
    "সাধারণ PF ও পেশাদার কর ধারণার উপর ভিত্তি করে আনুমানিক — প্রকৃত টেক-হোম আপনার সঠিক বেতন কাঠামো ও কর্তিত আয়কর TDS-এর উপর নির্ভর করে।",
  tsEqual: "সমান ভাগ",
  tsWeighted: "ঘণ্টা / শেয়ার অনুযায়ী",
  tsPool: "মোট টিপ পুল",
  tsAddStaff: "কর্মী সদস্য যোগ করুন",
  tsHoursShares: "ঘণ্টা / শেয়ার",
  tsStaff: "কর্মী",
  tsNamePlaceholder: "যেমন রিয়া",
  unitYrs: "বছর",
  unitDays: "দিন",
  unitMl: "ml",
  unitUnits: "একক",
  unitHrs: "ঘণ্টা",
  unitMin: "মিনিট",
};

const ta: Partial<CalcDict> = {
  aovTotalRevenue: "மொத்த வருவாய் (காலம்)",
  aovNumOrders: "ஆர்டர்களின் எண்ணிக்கை",
  aovTargetIncrease: "இலக்கு AOV அதிகரிப்பு",
  aovCurrent: "தற்போதைய AOV",
  aovAtTarget: "இலக்கு அதிகரிப்பில் AOV",
  aovExtraRevenue: "அதே ஆர்டரில் கூடுதல் வருவாய்",
  beFixedCosts: "நிலையான செலவுகள் (மாதம்)",
  beVarCost: "ஒரு அலகுக்கு மாறும் செலவு",
  beSellPrice: "ஒரு அலகுக்கு விற்பனை விலை",
  beUnits: "பிரேக்-ஈவன் அலகுகள்",
  beRevenue: "பிரேக்-ஈவன் வருவாய்",
  beContribution: "கண்ட்ரிபியூஷன் மார்ஜின்",
  beNote:
    "உங்கள் விற்பனை விலை ஒரு அலகின் மாறும் செலவை ஈடுசெய்யவில்லை, எனவே பிரேக்-ஈவன் புள்ளி இல்லை — விற்கப்படும் ஒவ்வொரு அலகிலும் நஷ்டம். பிரேக்-ஈவனை சாத்தியமாக்க விலையை உயர்த்துங்கள் அல்லது மாறும் செலவைக் குறையுங்கள்.",
  cacSpend: "மார்க்கெட்டிங் & விற்பனை செலவு",
  cacNewCustomers: "பெறப்பட்ட புதிய வாடிக்கையாளர்கள்",
  cacAvgRevenue: "ஒரு வாடிக்கையாளருக்கு சராசரி வருவாய் (விருப்பம்)",
  cacCost: "வாடிக்கையாளர் கையகப்படுத்தல் செலவு",
  cacRatio: "வருவாய்-முதல்-CAC விகிதம்",
  discOriginalPrice: "அசல் விலை",
  discDiscount: "தள்ளுபடி",
  discYouSave: "நீங்கள் சேமிப்பது",
  discFinalPrice: "இறுதி விலை",
  fcIngredientCost: "ஒரு உணவுக்கு பொருட்கள் செலவு",
  fcMenuPrice: "மெனு விற்பனை விலை",
  fcFoodCostPct: "ஃபுட் காஸ்ட் %",
  fcGrossProfit: "ஒரு உணவுக்கு மொத்த லாபம்",
  fcNoteWithin: "இது பெரும்பாலான உணவகங்கள் இலக்காகக் கொள்ளும் வழக்கமான 28-35% வரம்பிற்குள் உள்ளது.",
  fcNoteAbove:
    "இது வழக்கமான 28-35% வரம்பை விட அதிகம் — பரிமாணம், வீணாதல் சரிபார்க்கவும் அல்லது விலை மாற வேண்டுமா என்று பாருங்கள்.",
  gratSalary: "கடைசி மாத ஊதியம் (அடிப்படை + DA)",
  gratYears: "பணி ஆண்டுகள்",
  gratPayable: "மதிப்பிடப்பட்ட செலுத்தத்தக்க கிராஜுவிட்டி",
  gratNote:
    "உங்கள் வரம்பற்ற கணக்கீடு {amount} ஆகும், இது ₹20,00,000 என்ற சட்டப்பூர்வ வரி விலக்கு வரம்பை விட அதிகம். இந்த வரம்பு அரசால் அவ்வப்போது திருத்தப்படுகிறது — இதை இறுதி எண்ணிக்கையாக எடுக்கும் முன் தற்போதைய வரம்பை உறுதிசெய்யவும்.",
  gstAdd: "GST சேர்",
  gstRemove: "GST நீக்கு",
  gstAmountBefore: "தொகை (GST முன்)",
  gstAmountIncl: "தொகை (GST உட்பட)",
  gstRate: "GST விகிதம்",
  gstBaseAmount: "அடிப்படை தொகை",
  gstAmountLabel: "GST தொகை",
  gstTotalAmount: "மொத்த தொகை",
  itGrossIncome: "ஆண்டு மொத்த வருமானம்",
  itDeductions: "கோரப்பட்ட விலக்குகள் (பழைய முறை — 80C, HRA, முதலியன)",
  itOldRegime: "பழைய முறை வரி (செஸ் உட்பட)",
  itNewRegime: "புதிய முறை வரி (செஸ் உட்பட)",
  itNewSaves: "புதிய முறை உங்களுக்கு சேமிப்பது",
  itOldSaves: "பழைய முறை உங்களுக்கு சேமிப்பது",
  itDisclaimer:
    "மதிப்பீடு மட்டுமே, FY 2025-26 (AY 2026-27) ஸ்லாப்கள் மற்றும் எளிமையாக்கப்பட்ட பிரிவு 87A தள்ளுபடியைப் பயன்படுத்தி — இதில் சர்சார்ஜ் மற்றும் பல விலக்குகள் இல்லை. வரி ஸ்லாப்கள் பொதுவாக ஒவ்வொரு பட்ஜெட்டிலும் மாறும், எனவே தாக்கல் செய்யும் முன் சமீபத்திய அதிகாரப்பூர்வ ஸ்லாப்கள் அல்லது சார்ட்டர்டு அக்கவுண்டண்டிடம் சரிபார்க்கவும்.",
  invCogs: "விற்கப்பட்ட பொருட்களின் செலவு (காலம்)",
  invAvgValue: "சராசரி சரக்கு மதிப்பு",
  invDaysPeriod: "காலத்தின் நாட்கள்",
  invRatio: "சரக்கு டர்ன்ஓவர் விகிதம்",
  invDio: "நாட்கள் சரக்கு நிலுவை",
  lcBottleCost: "பாட்டில் செலவு",
  lcBottleSize: "பாட்டில் அளவு",
  lcPourSize: "போர் அளவு",
  lcSellPrice: "ஒரு போருக்கு விற்பனை விலை",
  lcPourCostPct: "போர் காஸ்ட் %",
  lcProfitPerPour: "ஒரு போருக்கு லாபம்",
  lcCostPerPour: "ஒரு போருக்கு செலவு",
  lcPoursPerBottle: "ஒரு பாட்டிலுக்கு போர்கள்",
  emiLoanAmount: "கடன் தொகை",
  emiInterestRate: "ஆண்டு வட்டி விகிதம்",
  emiTenure: "காலம்",
  emiMonths: "மாதங்கள்",
  emiYears: "ஆண்டுகள்",
  emiMonthly: "மாதாந்திர EMI",
  emiTotalInterest: "மொத்த வட்டி",
  emiTotalPayment: "மொத்த செலுத்துதல்",
  mkCostPrice: "செலவு விலை",
  mkTargetMarkup: "இலக்கு மார்க்அப்",
  mkSellingPrice: "விற்பனை விலை",
  mkProfitPerUnit: "ஒரு அலகுக்கு லாபம்",
  mkResultingMargin: "விளைவான மார்ஜின்",
  pmProfit: "லாபம்",
  pmMargin: "லாப மார்ஜின்",
  pmMarkup: "மார்க்அப்",
  meMenuItems: "மெனு உருப்படிகள்",
  meItemNo: "உருப்படி",
  meItemName: "உருப்படி பெயர்",
  mePrice: "விலை",
  meCost: "செலவு",
  meUnitsSold: "விற்ற அலகுகள்",
  meAddItem: "மெனு உருப்படி சேர்",
  meItemNamePlaceholder: "உருப்படி பெயர்",
  mePricePlaceholder: "எ.கா. 100.50",
  meCostPlaceholder: "எ.கா. 50.25",
  meUnitsPlaceholder: "எ.கா. 100",
  meTotalRevenue: "மொத்த வருவாய்",
  meTotalCost: "மொத்த செலவு",
  meTotalContribution: "மொத்த கண்ட்ரிபியூஷன்",
  meAvgMargin: "சராசரி மார்ஜின் %",
  meStars: "ஸ்டார்கள்",
  meCashCows: "கேஷ் கவ்ஸ்",
  mePuzzles: "பஸில்கள்",
  meDogs: "டாக்ஸ்",
  meStarsDesc: "அதிக மார்ஜின் + அதிக பிரபலம்",
  meCashCowsDesc: "அதிக மார்ஜின் + குறைந்த பிரபலம்",
  mePuzzlesDesc: "குறைந்த மார்ஜின் + அதிக பிரபலம்",
  meDogsDesc: "குறைந்த மார்ஜின் + குறைந்த பிரபலம்",
  meExportExcel: "Excel-க்கு ஏற்றுமதி",
  meExportPdf: "PDF-க்கு ஏற்றுமதி",
  meMargin: "மார்ஜின்",
  meMarginPct: "மார்ஜின் %",
  meClassification: "வகைப்பாடு",
  meHowToUse: "எப்படி பயன்படுத்துவது",
  meStarBadge: "ஸ்டார்",
  meCashCowBadge: "கேஷ் கவ்",
  mePuzzleBadge: "பஸில்",
  meDogBadge: "டாக்",
  meStarsTip: "அதிக மார்ஜின் + அதிக பிரபலம். இந்த உருப்படிகளை விளம்பரப்படுத்துங்கள்.",
  meCashCowsTip: "அதிக மார்ஜின் + குறைந்த பிரபலம். தெரிவுநிலையை அதிகரியுங்கள்.",
  mePuzzlesTip: "குறைந்த மார்ஜின் + அதிக பிரபலம். விலையை உயர்த்துங்கள் அல்லது செலவைக் குறையுங்கள்.",
  meDogsTip: "குறைந்த மார்ஜின் + குறைந்த பிரபலம். அகற்றுங்கள் அல்லது மறுஅமைப்பு செய்யுங்கள்.",
  ompTakeHome: "நீங்கள் வீட்டிற்கு எடுக்க விரும்பும் விலை",
  ompCommission: "பிளாட்ஃபார்ம் கமிஷன்",
  ompGstOnComm: "கமிஷனுக்கு GST",
  ompGatewayFee: "பேமெண்ட் கேட்வே கட்டணம்",
  ompPackaging: "பேக்கேஜிங் செலவு",
  ompGstCharge: "இந்த உருப்படிக்கு நீங்கள் விதிக்கும் GST",
  ompListPrice: "பிளாட்ஃபார்மில் பட்டியலிட வேண்டிய விலை",
  ompMarkup: "உங்கள் இலக்கு விலைக்கு மேல் மார்க்அப்",
  ompGstRemit: "நீங்கள் செலுத்தப்போகும் GST",
  ompCommPlusGst: "கமிஷன் + அதற்கு GST",
  ompGatewayPackaging: "கேட்வே கட்டணம் + பேக்கேஜிங்",
  ompInfeasible:
    "கமிஷன், GST மற்றும் கட்டணங்கள் சேர்ந்து பட்டியல் விலையின் 100% அல்லது அதற்கு மேல் ஆகிவிடுகின்றன, எனவே எந்த மெனு விலையும் இந்த உருப்படியில் உங்கள் இலக்கு டேக்-ஹோமை மீட்க முடியாது. கமிஷன் அல்லது கட்டணத்தைக் குறைத்து முயற்சிக்கவும், அல்லது இந்த மார்ஜினில் இதை ஆன்லைனில் பட்டியலிடுவதை மறுபரிசீலனை செய்யுங்கள்.",
  ompAssumption:
    "கமிஷன் மற்றும் கேட்வே கட்டணங்கள் பட்டியல் விலையில் விதிக்கப்படுகின்றன என்றும், பட்டியல் விலையில் உருப்படிக்கு நீங்கள் விதிக்கும் GST ஏற்கனவே சேர்ந்துள்ளது என்றும் கருதப்படுகிறது. அக்ரிகேட்டர் ஒப்பந்தங்கள் மாறுபடும் — புதிய விலைகளை அறிமுகப்படுத்தும் முன் உண்மையான பேஅவுட் அறிக்கையுடன் சரிபார்க்கவும்.",
  oocOrderValue: "ஆர்டர் மதிப்பு",
  oocTotalDeductions: "மொத்த கழிவுகள்",
  oocRealPayout: "உங்கள் உண்மையான பேஅவுட்",
  oocTakeHomePct: "டேக்-ஹோம் %",
  rcServings: "இந்த ரெசிபி தரும் சர்விங்ஸ்",
  rcTargetFoodCost: "இலக்கு ஃபுட் காஸ்ட் %",
  rcTotalCost: "மொத்த ரெசிபி செலவு (அனைத்து சர்விங்ஸ்)",
  rcCostPerServing: "ஒரு சர்விங்குக்கு செலவு",
  rcSuggestedPrice: "ஒரு சர்விங்குக்கு பரிந்துரைக்கப்பட்ட விலை",
  rcIngredient: "பொருள்",
  rcCostUsed: "பயன்படுத்திய செலவு",
  rcIngredientPlaceholder: "எ.கா. பன்னீர்",
  rcAddIngredient: "பொருள் சேர்",
  srDailySales: "சராசரி தினசரி விற்பனை",
  srLeadTime: "சப்ளையர் லீட் டைம்",
  srSafetyStock: "சேஃப்டி ஸ்டாக்",
  srReorderAt: "மறு ஆர்டர்",
  srLeadDemand: "லீட்-டைம் தேவை",
  ttCovers: "பரிமாறிய கவர்கள்",
  ttTables: "மேசைகளின் எண்ணிக்கை",
  ttServiceLength: "சேவை காலம்",
  ttRate: "மேசை டர்ன்ஓவர் விகிதம்",
  ttAvgTurn: "சராசரி டர்ன் நேரம்",
  thCtc: "ஆண்டு CTC",
  thBasic: "அடிப்படை ஊதியம் (CTC-இன் %)",
  thProfTax: "மாதாந்திர தொழில்முறை வரி",
  thMonthly: "மாதாந்திர டேக்-ஹோம்",
  thPf: "ஊழியர் PF கழிக்கப்பட்டது",
  thAnnual: "ஆண்டு டேக்-ஹோம்",
  thNote:
    "வழக்கமான PF மற்றும் தொழில்முறை வரி அனுமானங்களின் அடிப்படையில் மதிப்பீடு — உண்மையான டேக்-ஹோம் உங்கள் சரியான ஊதிய கட்டமைப்பு மற்றும் கழிக்கப்பட்ட வருமான வரி TDS-ஐப் பொறுத்தது.",
  tsEqual: "சம பங்கீடு",
  tsWeighted: "மணிநேரம் / பங்குகள் படி",
  tsPool: "மொத்த டிப் பூல்",
  tsAddStaff: "பணியாளர் சேர்",
  tsHoursShares: "மணிநேரம் / பங்குகள்",
  tsStaff: "பணியாளர்",
  tsNamePlaceholder: "எ.கா. ரியா",
  unitYrs: "ஆண்டு",
  unitDays: "நாட்கள்",
  unitMl: "ml",
  unitUnits: "அலகுகள்",
  unitHrs: "மணி",
  unitMin: "நிமிடம்",
};

const te: Partial<CalcDict> = {
  aovTotalRevenue: "మొత్తం ఆదాయం (కాలం)",
  aovNumOrders: "ఆర్డర్ల సంఖ్య",
  aovTargetIncrease: "లక్ష్య AOV పెంపు",
  aovCurrent: "ప్రస్తుత AOV",
  aovAtTarget: "లక్ష్య పెంపు వద్ద AOV",
  aovExtraRevenue: "అదే ఆర్డర్లలో అదనపు ఆదాయం",
  beFixedCosts: "స్థిర ఖర్చులు (నెలకు)",
  beVarCost: "ఒక్కో యూనిట్‌కు చర ఖర్చు",
  beSellPrice: "ఒక్కో యూనిట్‌కు అమ్మకపు ధర",
  beUnits: "బ్రేక్-ఈవెన్ యూనిట్లు",
  beRevenue: "బ్రేక్-ఈవెన్ ఆదాయం",
  beContribution: "కంట్రిబ్యూషన్ మార్జిన్",
  beNote:
    "మీ అమ్మకపు ధర ఒక్కో యూనిట్ చర ఖర్చును కవర్ చేయదు, కాబట్టి బ్రేక్-ఈవెన్ పాయింట్ లేదు — అమ్మిన ప్రతి యూనిట్‌లో నష్టం. బ్రేక్-ఈవెన్ సాధ్యం చేయడానికి ధరను పెంచండి లేదా చర ఖర్చును తగ్గించండి.",
  cacSpend: "మార్కెటింగ్ & సేల్స్ ఖర్చు",
  cacNewCustomers: "పొందిన కొత్త కస్టమర్లు",
  cacAvgRevenue: "ఒక్కో కస్టమర్‌కు సగటు ఆదాయం (ఐచ్ఛికం)",
  cacCost: "కస్టమర్ అక్విజిషన్ ఖర్చు",
  cacRatio: "ఆదాయం-నుండి-CAC నిష్పత్తి",
  discOriginalPrice: "అసలు ధర",
  discDiscount: "డిస్కౌంట్",
  discYouSave: "మీరు ఆదా చేసేది",
  discFinalPrice: "చివరి ధర",
  fcIngredientCost: "ఒక్కో వంటకానికి పదార్థాల ఖర్చు",
  fcMenuPrice: "మెనూ అమ్మకపు ధర",
  fcFoodCostPct: "ఫుడ్ కాస్ట్ %",
  fcGrossProfit: "ఒక్కో వంటకానికి స్థూల లాభం",
  fcNoteWithin: "ఇది చాలా రెస్టారెంట్లు లక్ష్యంగా పెట్టుకునే సాధారణ 28-35% పరిధిలో ఉంది.",
  fcNoteAbove:
    "ఇది సాధారణ 28-35% పరిధి కంటే ఎక్కువ — పోర్షనింగ్, వృథా తనిఖీ చేయండి లేదా ధర మారాలా చూడండి.",
  gratSalary: "చివరి నెలవారీ జీతం (మూల + DA)",
  gratYears: "సేవా సంవత్సరాలు",
  gratPayable: "అంచనా చెల్లించదగిన గ్రాట్యుటీ",
  gratNote:
    "మీ పరిమితి లేని లెక్కింపు {amount} అవుతుంది, ఇది ₹20,00,000 చట్టబద్ధ పన్ను-మినహాయింపు పరిమితి కంటే ఎక్కువ. ఈ పరిమితిని ప్రభుత్వం ఎప్పటికప్పుడు సవరిస్తుంది — దీన్ని చివరి సంఖ్యగా భావించే ముందు ప్రస్తుత పరిమితిని నిర్ధారించండి.",
  gstAdd: "GST జోడించు",
  gstRemove: "GST తీసివేయి",
  gstAmountBefore: "మొత్తం (GST ముందు)",
  gstAmountIncl: "మొత్తం (GST తో)",
  gstRate: "GST రేటు",
  gstBaseAmount: "ఆధార మొత్తం",
  gstAmountLabel: "GST మొత్తం",
  gstTotalAmount: "మొత్తం విలువ",
  itGrossIncome: "వార్షిక స్థూల ఆదాయం",
  itDeductions: "క్లెయిమ్ చేసిన మినహాయింపులు (పాత విధానం — 80C, HRA, మొదలైనవి)",
  itOldRegime: "పాత విధానం పన్ను (సెస్ తో)",
  itNewRegime: "కొత్త విధానం పన్ను (సెస్ తో)",
  itNewSaves: "కొత్త విధానం మీకు ఆదా చేసేది",
  itOldSaves: "పాత విధానం మీకు ఆదా చేసేది",
  itDisclaimer:
    "అంచనా మాత్రమే, FY 2025-26 (AY 2026-27) స్లాబ్‌లు మరియు సరళీకృత సెక్షన్ 87A రిబేట్‌ను ఉపయోగించి — ఇందులో సర్‌చార్జ్ మరియు అనేక మినహాయింపులు లేవు. పన్ను స్లాబ్‌లు సాధారణంగా ప్రతి బడ్జెట్‌లో మారతాయి, కాబట్టి ఫైల్ చేసే ముందు తాజా అధికారిక స్లాబ్‌లు లేదా చార్టర్డ్ అకౌంటెంట్‌తో నిర్ధారించండి.",
  invCogs: "అమ్మిన వస్తువుల ఖర్చు (కాలం)",
  invAvgValue: "సగటు ఇన్వెంటరీ విలువ",
  invDaysPeriod: "కాలంలోని రోజులు",
  invRatio: "ఇన్వెంటరీ టర్నోవర్ నిష్పత్తి",
  invDio: "రోజులు ఇన్వెంటరీ బకాయి",
  lcBottleCost: "బాటిల్ ఖర్చు",
  lcBottleSize: "బాటిల్ పరిమాణం",
  lcPourSize: "పోర్ పరిమాణం",
  lcSellPrice: "ఒక్కో పోర్‌కు అమ్మకపు ధర",
  lcPourCostPct: "పోర్ కాస్ట్ %",
  lcProfitPerPour: "ఒక్కో పోర్‌కు లాభం",
  lcCostPerPour: "ఒక్కో పోర్‌కు ఖర్చు",
  lcPoursPerBottle: "ఒక్కో బాటిల్‌కు పోర్లు",
  emiLoanAmount: "రుణ మొత్తం",
  emiInterestRate: "వార్షిక వడ్డీ రేటు",
  emiTenure: "కాలవ్యవధి",
  emiMonths: "నెలలు",
  emiYears: "సంవత్సరాలు",
  emiMonthly: "నెలవారీ EMI",
  emiTotalInterest: "మొత్తం వడ్డీ",
  emiTotalPayment: "మొత్తం చెల్లింపు",
  mkCostPrice: "ఖర్చు ధర",
  mkTargetMarkup: "లక్ష్య మార్కప్",
  mkSellingPrice: "అమ్మకపు ధర",
  mkProfitPerUnit: "ఒక్కో యూనిట్‌కు లాభం",
  mkResultingMargin: "ఫలిత మార్జిన్",
  pmProfit: "లాభం",
  pmMargin: "లాభ మార్జిన్",
  pmMarkup: "మార్కప్",
  meMenuItems: "మెనూ ఐటమ్‌లు",
  meItemNo: "ఐటమ్",
  meItemName: "ఐటమ్ పేరు",
  mePrice: "ధర",
  meCost: "ఖర్చు",
  meUnitsSold: "అమ్మిన యూనిట్లు",
  meAddItem: "మెనూ ఐటమ్ జోడించు",
  meItemNamePlaceholder: "ఐటమ్ పేరు",
  mePricePlaceholder: "ఉదా. 100.50",
  meCostPlaceholder: "ఉదా. 50.25",
  meUnitsPlaceholder: "ఉదా. 100",
  meTotalRevenue: "మొత్తం ఆదాయం",
  meTotalCost: "మొత్తం ఖర్చు",
  meTotalContribution: "మొత్తం కంట్రిబ్యూషన్",
  meAvgMargin: "సగటు మార్జిన్ %",
  meStars: "స్టార్స్",
  meCashCows: "క్యాష్ కౌస్",
  mePuzzles: "పజిల్స్",
  meDogs: "డాగ్స్",
  meStarsDesc: "అధిక మార్జిన్ + అధిక ప్రజాదరణ",
  meCashCowsDesc: "అధిక మార్జిన్ + తక్కువ ప్రజాదరణ",
  mePuzzlesDesc: "తక్కువ మార్జిన్ + అధిక ప్రజాదరణ",
  meDogsDesc: "తక్కువ మార్జిన్ + తక్కువ ప్రజాదరణ",
  meExportExcel: "Excel కి ఎగుమతి",
  meExportPdf: "PDF కి ఎగుమతి",
  meMargin: "మార్జిన్",
  meMarginPct: "మార్జిన్ %",
  meClassification: "వర్గీకరణ",
  meHowToUse: "ఎలా ఉపయోగించాలి",
  meStarBadge: "స్టార్",
  meCashCowBadge: "క్యాష్ కౌ",
  mePuzzleBadge: "పజిల్",
  meDogBadge: "డాగ్",
  meStarsTip: "అధిక మార్జిన్ + అధిక ప్రజాదరణ. ఈ ఐటమ్‌లను ప్రచారం చేయండి.",
  meCashCowsTip: "అధిక మార్జిన్ + తక్కువ ప్రజాదరణ. కనిపించడాన్ని పెంచండి.",
  mePuzzlesTip: "తక్కువ మార్జిన్ + అధిక ప్రజాదరణ. ధరలు పెంచండి లేదా ఖర్చులు తగ్గించండి.",
  meDogsTip: "తక్కువ మార్జిన్ + తక్కువ ప్రజాదరణ. తీసివేయండి లేదా పునఃస్థాపించండి.",
  ompTakeHome: "మీరు ఇంటికి తీసుకెళ్లాలనుకునే ధర",
  ompCommission: "ప్లాట్‌ఫారమ్ కమిషన్",
  ompGstOnComm: "కమిషన్‌పై GST",
  ompGatewayFee: "పేమెంట్ గేట్‌వే ఫీజు",
  ompPackaging: "ప్యాకేజింగ్ ఖర్చు",
  ompGstCharge: "ఈ ఐటమ్‌పై మీరు వసూలు చేసే GST",
  ompListPrice: "ప్లాట్‌ఫారమ్‌లో జాబితా చేయాల్సిన ధర",
  ompMarkup: "మీ లక్ష్య ధరపై మార్కప్",
  ompGstRemit: "మీరు చెల్లించే GST",
  ompCommPlusGst: "కమిషన్ + దానిపై GST",
  ompGatewayPackaging: "గేట్‌వే ఫీజు + ప్యాకేజింగ్",
  ompInfeasible:
    "కమిషన్, GST మరియు ఫీజులు కలిపి జాబితా ధరలో 100% లేదా అంతకంటే ఎక్కువ అవుతాయి, కాబట్టి ఏ మెనూ ధర కూడా ఈ ఐటమ్‌పై మీ లక్ష్య టేక్-హోమ్‌ను తిరిగి ఇవ్వలేదు. కమిషన్ లేదా ఫీజు తగ్గించి ప్రయత్నించండి, లేదా ఈ మార్జిన్‌లో దీన్ని ఆన్‌లైన్‌లో జాబితా చేయడాన్ని పునఃపరిశీలించండి.",
  ompAssumption:
    "కమిషన్ మరియు గేట్‌వే ఫీజులు జాబితా ధరపై వసూలు చేయబడతాయని, మరియు జాబితా ధరలో మీరు ఐటమ్‌పై వసూలు చేసే GST ఇప్పటికే ఉందని భావించబడింది. అగ్రిగేటర్ ఒప్పందాలు మారుతూ ఉంటాయి — కొత్త ధరలు అమలు చేసే ముందు వాస్తవ పేఅవుట్ నివేదికతో నిర్ధారించండి.",
  oocOrderValue: "ఆర్డర్ విలువ",
  oocTotalDeductions: "మొత్తం మినహాయింపులు",
  oocRealPayout: "మీ వాస్తవ పేఅవుట్",
  oocTakeHomePct: "టేక్-హోమ్ %",
  rcServings: "ఈ రెసిపీ ఇచ్చే సర్వింగ్‌లు",
  rcTargetFoodCost: "లక్ష్య ఫుడ్ కాస్ట్ %",
  rcTotalCost: "మొత్తం రెసిపీ ఖర్చు (అన్ని సర్వింగ్‌లు)",
  rcCostPerServing: "ఒక్కో సర్వింగ్‌కు ఖర్చు",
  rcSuggestedPrice: "ఒక్కో సర్వింగ్‌కు సూచించిన ధర",
  rcIngredient: "పదార్థం",
  rcCostUsed: "ఉపయోగించిన ఖర్చు",
  rcIngredientPlaceholder: "ఉదా. పనీర్",
  rcAddIngredient: "పదార్థం జోడించు",
  srDailySales: "సగటు రోజువారీ అమ్మకాలు",
  srLeadTime: "సప్లయర్ లీడ్ టైమ్",
  srSafetyStock: "సేఫ్టీ స్టాక్",
  srReorderAt: "మళ్లీ ఆర్డర్",
  srLeadDemand: "లీడ్-టైమ్ డిమాండ్",
  ttCovers: "వడ్డించిన కవర్లు",
  ttTables: "టేబుళ్ల సంఖ్య",
  ttServiceLength: "సేవా వ్యవధి",
  ttRate: "టేబుల్ టర్నోవర్ రేటు",
  ttAvgTurn: "సగటు టర్న్ సమయం",
  thCtc: "వార్షిక CTC",
  thBasic: "మూల జీతం (CTC లో %)",
  thProfTax: "నెలవారీ వృత్తి పన్ను",
  thMonthly: "నెలవారీ టేక్-హోమ్",
  thPf: "ఉద్యోగి PF మినహాయింపు",
  thAnnual: "వార్షిక టేక్-హోమ్",
  thNote:
    "సాధారణ PF మరియు వృత్తి పన్ను అంచనాల ఆధారంగా అంచనా — వాస్తవ టేక్-హోమ్ మీ ఖచ్చితమైన జీత నిర్మాణం మరియు మినహాయించిన ఆదాయపు పన్ను TDS పై ఆధారపడి ఉంటుంది.",
  tsEqual: "సమాన విభజన",
  tsWeighted: "గంటలు / షేర్ల ప్రకారం",
  tsPool: "మొత్తం టిప్ పూల్",
  tsAddStaff: "సిబ్బంది సభ్యుడిని జోడించు",
  tsHoursShares: "గంటలు / షేర్లు",
  tsStaff: "సిబ్బంది",
  tsNamePlaceholder: "ఉదా. రియా",
  unitYrs: "సం.",
  unitDays: "రోజులు",
  unitMl: "ml",
  unitUnits: "యూనిట్లు",
  unitHrs: "గం.",
  unitMin: "నిమి.",
};

export const CALC_BASE = en;

export const CALC_DICTIONARIES: Record<LanguageCode, Partial<CalcDict>> = {
  en,
  hi,
  bn,
  ta,
  te,
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
