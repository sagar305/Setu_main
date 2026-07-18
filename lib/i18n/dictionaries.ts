// Translation dictionaries for the shared toolkit UI. English is the base;
// any missing key in another language falls back to English automatically
// (see lib/i18n/index.tsx). Keys cover the chrome every tool shares — buttons,
// the workspace consent banner, and common field labels. Tool-specific copy
// is translated per tool as the rollout continues.

import type { LanguageCode } from "./config";

export type DictKey =
  | "workspaceFound"
  | "useWorkspace"
  | "notNow"
  | "save"
  | "saveChanges"
  | "cancel"
  | "delete"
  | "edit"
  | "add"
  | "exportCsv"
  | "print"
  | "download"
  | "search"
  | "loading"
  | "confirm"
  | "name"
  | "phone"
  | "date"
  | "amount"
  | "total"
  | "notes"
  | "language"
  | "currency"
  | "timezone"
  | "customer"
  | "supplier"
  // Tool vocabulary — complete in en + hi; other languages fall back to
  // English until their dictionaries are extended.
  | "category"
  | "description"
  | "paymentMode"
  | "quantity"
  | "rate"
  | "price"
  | "stock"
  | "unit"
  | "product"
  | "products"
  | "customersLabel"
  | "suppliersLabel"
  | "expensesLabel"
  | "balance"
  | "opening"
  | "closing"
  | "cashIn"
  | "cashOut"
  | "creditGiven"
  | "paymentReceived"
  | "service"
  | "durationMins"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "noShow"
  | "settled"
  | "due"
  | "advance"
  | "addItem"
  | "addEntry"
  | "addExpense"
  | "addCustomer"
  | "addSupplier"
  | "remove"
  | "viewTable"
  | "viewChart"
  | "today"
  | "last7Days"
  | "last30Days"
  | "customRange"
  | "revenue"
  | "costOfGoods"
  | "grossProfit"
  | "netProfit"
  | "noEntries"
  | "saved"
  | "validUntil"
  | "billNumber"
  | "markCompleted"
  | "reopen"
  | "address";

type Dict = Record<DictKey, string>;

const en: Dict = {
  workspaceFound: "Workspace found on this device.",
  useWorkspace: "Use workspace",
  notNow: "Not now",
  save: "Save",
  saveChanges: "Save changes",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  exportCsv: "Export CSV",
  print: "Print",
  download: "Download",
  search: "Search…",
  loading: "Loading…",
  confirm: "Confirm",
  name: "Name",
  phone: "Phone",
  date: "Date",
  amount: "Amount",
  total: "Total",
  notes: "Notes",
  language: "Language",
  currency: "Currency",
  timezone: "Timezone",
  customer: "Customer",
  supplier: "Supplier",
  category: "Category",
  description: "Description",
  paymentMode: "Payment mode",
  quantity: "Qty",
  rate: "Rate",
  price: "Price",
  stock: "Stock",
  unit: "Unit",
  product: "Product",
  products: "Products",
  customersLabel: "Customers",
  suppliersLabel: "Suppliers",
  expensesLabel: "Expenses",
  balance: "Balance",
  opening: "Opening",
  closing: "Closing",
  cashIn: "Cash in",
  cashOut: "Cash out",
  creditGiven: "Credit given",
  paymentReceived: "Payment received",
  service: "Service",
  durationMins: "Duration (minutes)",
  scheduled: "scheduled",
  completed: "completed",
  cancelled: "cancelled",
  noShow: "no-show",
  settled: "settled",
  due: "due",
  advance: "advance",
  addItem: "+ Add item",
  addEntry: "Add entry",
  addExpense: "Add expense",
  addCustomer: "Add customer",
  addSupplier: "Add supplier",
  remove: "Remove",
  viewTable: "View table",
  viewChart: "View chart",
  today: "Today",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  customRange: "Custom",
  revenue: "Revenue",
  costOfGoods: "Cost of goods",
  grossProfit: "Gross profit",
  netProfit: "Net profit",
  noEntries: "No entries yet",
  saved: "Saved",
  validUntil: "Valid until",
  billNumber: "Bill number",
  markCompleted: "Mark completed",
  reopen: "Re-open",
  address: "Address",
};

const hi: Dict = {
  workspaceFound: "इस डिवाइस पर वर्कस्पेस मिला।",
  useWorkspace: "वर्कस्पेस उपयोग करें",
  notNow: "अभी नहीं",
  save: "सहेजें",
  saveChanges: "बदलाव सहेजें",
  cancel: "रद्द करें",
  delete: "हटाएँ",
  edit: "संपादित करें",
  add: "जोड़ें",
  exportCsv: "CSV निर्यात करें",
  print: "प्रिंट करें",
  download: "डाउनलोड करें",
  search: "खोजें…",
  loading: "लोड हो रहा है…",
  confirm: "पुष्टि करें",
  name: "नाम",
  phone: "फ़ोन",
  date: "तारीख़",
  amount: "राशि",
  total: "कुल",
  notes: "नोट्स",
  language: "भाषा",
  currency: "मुद्रा",
  timezone: "समय क्षेत्र",
  customer: "ग्राहक",
  supplier: "आपूर्तिकर्ता",
  category: "श्रेणी",
  description: "विवरण",
  paymentMode: "भुगतान का तरीका",
  quantity: "मात्रा",
  rate: "दर",
  price: "कीमत",
  stock: "स्टॉक",
  unit: "इकाई",
  product: "उत्पाद",
  products: "उत्पाद",
  customersLabel: "ग्राहक",
  suppliersLabel: "आपूर्तिकर्ता",
  expensesLabel: "खर्च",
  balance: "शेष",
  opening: "प्रारंभिक",
  closing: "समापन",
  cashIn: "नकद आया",
  cashOut: "नकद गया",
  creditGiven: "उधार दिया",
  paymentReceived: "भुगतान मिला",
  service: "सेवा",
  durationMins: "अवधि (मिनट)",
  scheduled: "निर्धारित",
  completed: "पूर्ण",
  cancelled: "रद्द",
  noShow: "नहीं आए",
  settled: "चुकता",
  due: "बकाया",
  advance: "अग्रिम",
  addItem: "+ आइटम जोड़ें",
  addEntry: "एंट्री जोड़ें",
  addExpense: "खर्च जोड़ें",
  addCustomer: "ग्राहक जोड़ें",
  addSupplier: "आपूर्तिकर्ता जोड़ें",
  remove: "हटाएँ",
  viewTable: "तालिका देखें",
  viewChart: "चार्ट देखें",
  today: "आज",
  last7Days: "पिछले 7 दिन",
  last30Days: "पिछले 30 दिन",
  customRange: "कस्टम",
  revenue: "आमदनी",
  costOfGoods: "माल की लागत",
  grossProfit: "सकल लाभ",
  netProfit: "शुद्ध लाभ",
  noEntries: "अभी कोई एंट्री नहीं",
  saved: "सहेजा गया",
  validUntil: "मान्य तिथि",
  billNumber: "बिल नंबर",
  markCompleted: "पूर्ण करें",
  reopen: "फिर से खोलें",
  address: "पता",
};

const bn: Partial<Dict> = {
  workspaceFound: "এই ডিভাইসে ওয়ার্কস্পেস পাওয়া গেছে।",
  useWorkspace: "ওয়ার্কস্পেস ব্যবহার করুন",
  notNow: "এখন নয়",
  save: "সংরক্ষণ করুন",
  saveChanges: "পরিবর্তন সংরক্ষণ করুন",
  cancel: "বাতিল",
  delete: "মুছুন",
  edit: "সম্পাদনা",
  add: "যোগ করুন",
  exportCsv: "CSV এক্সপোর্ট",
  print: "প্রিন্ট",
  download: "ডাউনলোড",
  search: "খুঁজুন…",
  loading: "লোড হচ্ছে…",
  confirm: "নিশ্চিত করুন",
  name: "নাম",
  phone: "ফোন",
  date: "তারিখ",
  amount: "পরিমাণ",
  total: "মোট",
  notes: "নোট",
  language: "ভাষা",
  currency: "মুদ্রা",
  timezone: "সময় অঞ্চল",
  customer: "গ্রাহক",
  supplier: "সরবরাহকারী",
};

const ta: Partial<Dict> = {
  workspaceFound: "இந்த சாதனத்தில் பணியிடம் கண்டறியப்பட்டது.",
  useWorkspace: "பணியிடத்தைப் பயன்படுத்து",
  notNow: "இப்போது வேண்டாம்",
  save: "சேமி",
  saveChanges: "மாற்றங்களைச் சேமி",
  cancel: "ரத்து",
  delete: "நீக்கு",
  edit: "திருத்து",
  add: "சேர்",
  exportCsv: "CSV ஏற்றுமதி",
  print: "அச்சிடு",
  download: "பதிவிறக்கு",
  search: "தேடு…",
  loading: "ஏற்றப்படுகிறது…",
  confirm: "உறுதிப்படுத்து",
  name: "பெயர்",
  phone: "தொலைபேசி",
  date: "தேதி",
  amount: "தொகை",
  total: "மொத்தம்",
  notes: "குறிப்புகள்",
  language: "மொழி",
  currency: "நாணயம்",
  timezone: "நேர மண்டலம்",
  customer: "வாடிக்கையாளர்",
  supplier: "சப்ளையர்",
};

const te: Partial<Dict> = {
  workspaceFound: "ఈ పరికరంలో వర్క్‌స్పేస్ కనుగొనబడింది.",
  useWorkspace: "వర్క్‌స్పేస్ ఉపయోగించండి",
  notNow: "ఇప్పుడు కాదు",
  save: "సేవ్ చేయండి",
  saveChanges: "మార్పులను సేవ్ చేయండి",
  cancel: "రద్దు",
  delete: "తొలగించండి",
  edit: "సవరించండి",
  add: "జోడించండి",
  exportCsv: "CSV ఎగుమతి",
  print: "ప్రింట్",
  download: "డౌన్‌లోడ్",
  search: "వెతకండి…",
  loading: "లోడ్ అవుతోంది…",
  confirm: "నిర్ధారించండి",
  name: "పేరు",
  phone: "ఫోన్",
  date: "తేదీ",
  amount: "మొత్తం",
  total: "మొత్తం విలువ",
  notes: "గమనికలు",
  language: "భాష",
  currency: "కరెన్సీ",
  timezone: "సమయ మండలి",
  customer: "కస్టమర్",
  supplier: "సరఫరాదారు",
};

const mr: Partial<Dict> = {
  workspaceFound: "या डिव्हाइसवर वर्कस्पेस सापडले.",
  useWorkspace: "वर्कस्पेस वापरा",
  notNow: "आत्ता नाही",
  save: "जतन करा",
  saveChanges: "बदल जतन करा",
  cancel: "रद्द करा",
  delete: "हटवा",
  edit: "संपादित करा",
  add: "जोडा",
  exportCsv: "CSV निर्यात",
  print: "प्रिंट",
  download: "डाउनलोड",
  search: "शोधा…",
  loading: "लोड होत आहे…",
  confirm: "पुष्टी करा",
  name: "नाव",
  phone: "फोन",
  date: "तारीख",
  amount: "रक्कम",
  total: "एकूण",
  notes: "टिपा",
  language: "भाषा",
  currency: "चलन",
  timezone: "वेळ क्षेत्र",
  customer: "ग्राहक",
  supplier: "पुरवठादार",
};

const gu: Partial<Dict> = {
  workspaceFound: "આ ડિવાઇસ પર વર્કસ્પેસ મળ્યું.",
  useWorkspace: "વર્કસ્પેસ વાપરો",
  notNow: "હમણાં નહીં",
  save: "સાચવો",
  saveChanges: "ફેરફારો સાચવો",
  cancel: "રદ કરો",
  delete: "કાઢી નાખો",
  edit: "સંપાદિત કરો",
  add: "ઉમેરો",
  exportCsv: "CSV નિકાસ",
  print: "પ્રિન્ટ",
  download: "ડાઉનલોડ",
  search: "શોધો…",
  loading: "લોડ થઈ રહ્યું છે…",
  confirm: "પુષ્ટિ કરો",
  name: "નામ",
  phone: "ફોન",
  date: "તારીખ",
  amount: "રકમ",
  total: "કુલ",
  notes: "નોંધ",
  language: "ભાષા",
  currency: "ચલણ",
  timezone: "સમય ઝોન",
  customer: "ગ્રાહક",
  supplier: "સપ્લાયર",
};

const kn: Partial<Dict> = {
  workspaceFound: "ಈ ಸಾಧನದಲ್ಲಿ ವರ್ಕ್‌ಸ್ಪೇಸ್ ಕಂಡುಬಂದಿದೆ.",
  useWorkspace: "ವರ್ಕ್‌ಸ್ಪೇಸ್ ಬಳಸಿ",
  notNow: "ಈಗ ಬೇಡ",
  save: "ಉಳಿಸಿ",
  saveChanges: "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ",
  cancel: "ರದ್ದುಮಾಡಿ",
  delete: "ಅಳಿಸಿ",
  edit: "ಸಂಪಾದಿಸಿ",
  add: "ಸೇರಿಸಿ",
  exportCsv: "CSV ರಫ್ತು",
  print: "ಮುದ್ರಿಸಿ",
  download: "ಡೌನ್‌ಲೋಡ್",
  search: "ಹುಡುಕಿ…",
  loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
  confirm: "ದೃಢೀಕರಿಸಿ",
  name: "ಹೆಸರು",
  phone: "ಫೋನ್",
  date: "ದಿನಾಂಕ",
  amount: "ಮೊತ್ತ",
  total: "ಒಟ್ಟು",
  notes: "ಟಿಪ್ಪಣಿಗಳು",
  language: "ಭಾಷೆ",
  currency: "ಕರೆನ್ಸಿ",
  timezone: "ಸಮಯ ವಲಯ",
  customer: "ಗ್ರಾಹಕ",
  supplier: "ಪೂರೈಕೆದಾರ",
};

const ml: Partial<Dict> = {
  workspaceFound: "ഈ ഉപകരണത്തിൽ വർക്ക്സ്പേസ് കണ്ടെത്തി.",
  useWorkspace: "വർക്ക്സ്പേസ് ഉപയോഗിക്കുക",
  notNow: "ഇപ്പോൾ വേണ്ട",
  save: "സേവ് ചെയ്യുക",
  saveChanges: "മാറ്റങ്ങൾ സേവ് ചെയ്യുക",
  cancel: "റദ്ദാക്കുക",
  delete: "ഇല്ലാതാക്കുക",
  edit: "എഡിറ്റ് ചെയ്യുക",
  add: "ചേർക്കുക",
  exportCsv: "CSV എക്സ്പോർട്ട്",
  print: "പ്രിന്റ്",
  download: "ഡൗൺലോഡ്",
  search: "തിരയുക…",
  loading: "ലോഡ് ചെയ്യുന്നു…",
  confirm: "സ്ഥിരീകരിക്കുക",
  name: "പേര്",
  phone: "ഫോൺ",
  date: "തീയതി",
  amount: "തുക",
  total: "ആകെ",
  notes: "കുറിപ്പുകൾ",
  language: "ഭാഷ",
  currency: "കറൻസി",
  timezone: "സമയ മേഖല",
  customer: "ഉപഭോക്താവ്",
  supplier: "വിതരണക്കാരൻ",
};

const pa: Partial<Dict> = {
  workspaceFound: "ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਵਰਕਸਪੇਸ ਮਿਲਿਆ।",
  useWorkspace: "ਵਰਕਸਪੇਸ ਵਰਤੋ",
  notNow: "ਹੁਣ ਨਹੀਂ",
  save: "ਸੰਭਾਲੋ",
  saveChanges: "ਬਦਲਾਅ ਸੰਭਾਲੋ",
  cancel: "ਰੱਦ ਕਰੋ",
  delete: "ਮਿਟਾਓ",
  edit: "ਸੋਧੋ",
  add: "ਜੋੜੋ",
  exportCsv: "CSV ਨਿਰਯਾਤ",
  print: "ਪ੍ਰਿੰਟ",
  download: "ਡਾਊਨਲੋਡ",
  search: "ਖੋਜੋ…",
  loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
  confirm: "ਪੁਸ਼ਟੀ ਕਰੋ",
  name: "ਨਾਮ",
  phone: "ਫ਼ੋਨ",
  date: "ਤਾਰੀਖ਼",
  amount: "ਰਕਮ",
  total: "ਕੁੱਲ",
  notes: "ਨੋਟ",
  language: "ਭਾਸ਼ਾ",
  currency: "ਮੁਦਰਾ",
  timezone: "ਸਮਾਂ ਖੇਤਰ",
  customer: "ਗਾਹਕ",
  supplier: "ਸਪਲਾਇਰ",
};

const es: Partial<Dict> = {
  workspaceFound: "Espacio de trabajo encontrado en este dispositivo.",
  useWorkspace: "Usar espacio de trabajo",
  notNow: "Ahora no",
  save: "Guardar",
  saveChanges: "Guardar cambios",
  cancel: "Cancelar",
  delete: "Eliminar",
  edit: "Editar",
  add: "Añadir",
  exportCsv: "Exportar CSV",
  print: "Imprimir",
  download: "Descargar",
  search: "Buscar…",
  loading: "Cargando…",
  confirm: "Confirmar",
  name: "Nombre",
  phone: "Teléfono",
  date: "Fecha",
  amount: "Importe",
  total: "Total",
  notes: "Notas",
  language: "Idioma",
  currency: "Moneda",
  timezone: "Zona horaria",
  customer: "Cliente",
  supplier: "Proveedor",
};

const fr: Partial<Dict> = {
  workspaceFound: "Espace de travail trouvé sur cet appareil.",
  useWorkspace: "Utiliser l'espace de travail",
  notNow: "Pas maintenant",
  save: "Enregistrer",
  saveChanges: "Enregistrer les modifications",
  cancel: "Annuler",
  delete: "Supprimer",
  edit: "Modifier",
  add: "Ajouter",
  exportCsv: "Exporter en CSV",
  print: "Imprimer",
  download: "Télécharger",
  search: "Rechercher…",
  loading: "Chargement…",
  confirm: "Confirmer",
  name: "Nom",
  phone: "Téléphone",
  date: "Date",
  amount: "Montant",
  total: "Total",
  notes: "Notes",
  language: "Langue",
  currency: "Devise",
  timezone: "Fuseau horaire",
  customer: "Client",
  supplier: "Fournisseur",
};

const ar: Partial<Dict> = {
  workspaceFound: "تم العثور على مساحة عمل على هذا الجهاز.",
  useWorkspace: "استخدام مساحة العمل",
  notNow: "ليس الآن",
  save: "حفظ",
  saveChanges: "حفظ التغييرات",
  cancel: "إلغاء",
  delete: "حذف",
  edit: "تعديل",
  add: "إضافة",
  exportCsv: "تصدير CSV",
  print: "طباعة",
  download: "تنزيل",
  search: "بحث…",
  loading: "جارٍ التحميل…",
  confirm: "تأكيد",
  name: "الاسم",
  phone: "الهاتف",
  date: "التاريخ",
  amount: "المبلغ",
  total: "الإجمالي",
  notes: "ملاحظات",
  language: "اللغة",
  currency: "العملة",
  timezone: "المنطقة الزمنية",
  customer: "العميل",
  supplier: "المورّد",
};

const pt: Partial<Dict> = {
  workspaceFound: "Espaço de trabalho encontrado neste dispositivo.",
  useWorkspace: "Usar espaço de trabalho",
  notNow: "Agora não",
  save: "Salvar",
  saveChanges: "Salvar alterações",
  cancel: "Cancelar",
  delete: "Excluir",
  edit: "Editar",
  add: "Adicionar",
  exportCsv: "Exportar CSV",
  print: "Imprimir",
  download: "Baixar",
  search: "Pesquisar…",
  loading: "Carregando…",
  confirm: "Confirmar",
  name: "Nome",
  phone: "Telefone",
  date: "Data",
  amount: "Valor",
  total: "Total",
  notes: "Notas",
  language: "Idioma",
  currency: "Moeda",
  timezone: "Fuso horário",
  customer: "Cliente",
  supplier: "Fornecedor",
};

const id: Partial<Dict> = {
  workspaceFound: "Ruang kerja ditemukan di perangkat ini.",
  useWorkspace: "Gunakan ruang kerja",
  notNow: "Nanti saja",
  save: "Simpan",
  saveChanges: "Simpan perubahan",
  cancel: "Batal",
  delete: "Hapus",
  edit: "Edit",
  add: "Tambah",
  exportCsv: "Ekspor CSV",
  print: "Cetak",
  download: "Unduh",
  search: "Cari…",
  loading: "Memuat…",
  confirm: "Konfirmasi",
  name: "Nama",
  phone: "Telepon",
  date: "Tanggal",
  amount: "Jumlah",
  total: "Total",
  notes: "Catatan",
  language: "Bahasa",
  currency: "Mata uang",
  timezone: "Zona waktu",
  customer: "Pelanggan",
  supplier: "Pemasok",
};

const de: Partial<Dict> = {
  workspaceFound: "Arbeitsbereich auf diesem Gerät gefunden.",
  useWorkspace: "Arbeitsbereich verwenden",
  notNow: "Nicht jetzt",
  save: "Speichern",
  saveChanges: "Änderungen speichern",
  cancel: "Abbrechen",
  delete: "Löschen",
  edit: "Bearbeiten",
  add: "Hinzufügen",
  exportCsv: "CSV exportieren",
  print: "Drucken",
  download: "Herunterladen",
  search: "Suchen…",
  loading: "Wird geladen…",
  confirm: "Bestätigen",
  name: "Name",
  phone: "Telefon",
  date: "Datum",
  amount: "Betrag",
  total: "Gesamt",
  notes: "Notizen",
  language: "Sprache",
  currency: "Währung",
  timezone: "Zeitzone",
  customer: "Kunde",
  supplier: "Lieferant",
};

const zh: Partial<Dict> = {
  workspaceFound: "在此设备上找到工作区。",
  useWorkspace: "使用工作区",
  notNow: "暂不",
  save: "保存",
  saveChanges: "保存更改",
  cancel: "取消",
  delete: "删除",
  edit: "编辑",
  add: "添加",
  exportCsv: "导出 CSV",
  print: "打印",
  download: "下载",
  search: "搜索…",
  loading: "加载中…",
  confirm: "确认",
  name: "名称",
  phone: "电话",
  date: "日期",
  amount: "金额",
  total: "合计",
  notes: "备注",
  language: "语言",
  currency: "货币",
  timezone: "时区",
  customer: "客户",
  supplier: "供应商",
};

export const DICTIONARIES: Record<LanguageCode, Partial<Dict>> = {
  en,
  hi,
  bn,
  ta,
  te,
  mr,
  gu,
  kn,
  ml,
  pa,
  es,
  fr,
  ar,
  pt,
  id,
  de,
  zh,
};

export const BASE_DICT = en;
