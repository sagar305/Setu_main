// ---------------------------------------------------------------------------
// The Google review banner along the top of the tool, calculator, glossary,
// product and blog pages.
//
// Unlike the in-page prompt (lib/review.ts), which waits for finished work and
// remembers an answer, this one is a standing ask: it is on every page load in
// those sections, and closing it only hides it until the next reload.
//
//   NEXT_PUBLIC_REVIEW_BANNER_ENABLED   on unless explicitly "false"
//
// NEXT_PUBLIC_* values are inlined at build time, so changing it needs a
// rebuild, not just a restart.
// ---------------------------------------------------------------------------

import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";

/** Off only when explicitly disabled, so the banner works with no config. */
export const REVIEW_BANNER_ENABLED = process.env.NEXT_PUBLIC_REVIEW_BANNER_ENABLED !== "false";

/** The sections it asks on, in English and under every language prefix. */
const SECTIONS = new Set(["tools", "calculators", "glossary", "products", "blog"]);

/**
 * Screens inside those sections that are an app on a counter or a wall, not a
 * page someone reads: a token display on a TV, the kitchen screen, a customer's
 * own token view, and the payment hand-off. A banner there would sit on top of
 * the thing the screen is for.
 */
const APP_SCREENS = [
  "/products/free-token-system/display",
  "/products/free-token-system/view",
  "/products/free-restaurant-pos/kitchen",
  "/products/qr-menu/payment",
];

/**
 * Whether the banner belongs on `pathname`, and if so the language the URL
 * itself declares (`/hi/tools/…` is Hindi). `lang` is null on an English path,
 * where the reader's chosen language applies instead.
 */
export function reviewBannerRoute(
  pathname: string | null | undefined,
): { lang: LanguageCode | null } | null {
  if (!pathname) return null;

  const segments = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  let lang: LanguageCode | null = null;
  if (segments.length > 0 && segments[0] !== "en" && isLanguageCode(segments[0])) {
    lang = segments[0];
    segments.shift();
  }

  if (segments.length === 0 || !SECTIONS.has(segments[0])) return null;

  const path = `/${segments.join("/")}`;
  if (APP_SCREENS.some((screen) => path === screen || path.startsWith(`${screen}/`))) return null;

  return { lang };
}

export type ReviewBannerCopy = {
  /** Short question, in bold. The only line shown beside the link on a phone. */
  lead: string;
  /** The ask itself; from the small breakpoint up. */
  body: string;
  /** The link to the Google review form. */
  cta: string;
  /** Accessible name for the banner landmark. */
  label: string;
  /** Accessible name for the close button. */
  dismiss: string;
};

/** Every language the site is published in, so the ask is never left in English. */
export const REVIEW_BANNER_COPY: Record<LanguageCode, ReviewBannerCopy> = {
  en: {
    lead: "Is Setu helping you?",
    body: "If our free tools and guides make your work easier, please leave us a Google review. It takes a minute and helps other businesses find us.",
    cta: "Leave a review",
    label: "Review Setu on Google",
    dismiss: "Close",
  },
  hi: {
    lead: "क्या Setu से आपको मदद मिल रही है?",
    body: "अगर हमारे मुफ़्त टूल और गाइड से आपका काम आसान हो रहा है, तो कृपया Google पर हमें एक रिव्यू दीजिए। बस एक मिनट लगता है, और इससे दूसरे कारोबारियों को हम तक पहुँचने में मदद मिलती है।",
    cta: "रिव्यू दीजिए",
    label: "Google पर Setu का रिव्यू कीजिए",
    dismiss: "बंद करें",
  },
  bn: {
    lead: "Setu কি আপনার কাজে আসছে?",
    body: "আমাদের বিনামূল্যের টুল আর গাইড যদি আপনার কাজ সহজ করে, অনুগ্রহ করে Google-এ আমাদের একটি রিভিউ দিন। এক মিনিটের ব্যাপার, আর এতে অন্য ব্যবসায়ীরা আমাদের খুঁজে পান।",
    cta: "রিভিউ দিন",
    label: "Google-এ Setu-র রিভিউ দিন",
    dismiss: "বন্ধ করুন",
  },
  ta: {
    lead: "Setu உங்களுக்கு உதவுகிறதா?",
    body: "எங்கள் இலவச கருவிகளும் வழிகாட்டிகளும் உங்கள் வேலையை எளிதாக்கினால், தயவுசெய்து Google-இல் எங்களைப் பற்றி ஒரு மதிப்புரை எழுதுங்கள். ஒரு நிமிடம்தான் ஆகும்; மற்ற வணிகர்கள் எங்களைக் கண்டறிய இது உதவும்.",
    cta: "மதிப்புரை எழுதுங்கள்",
    label: "Google-இல் Setu பற்றி மதிப்புரை எழுதுங்கள்",
    dismiss: "மூடு",
  },
  te: {
    lead: "Setu మీకు ఉపయోగపడుతోందా?",
    body: "మా ఉచిత టూల్స్, గైడ్‌లు మీ పనిని సులభం చేస్తుంటే, దయచేసి Googleలో మాకు ఒక రివ్యూ ఇవ్వండి. ఒక్క నిమిషం చాలు, ఇతర వ్యాపారులు మమ్మల్ని కనుగొనడానికి ఇది సహాయపడుతుంది.",
    cta: "రివ్యూ ఇవ్వండి",
    label: "Googleలో Setuకి రివ్యూ ఇవ్వండి",
    dismiss: "మూసివేయండి",
  },
  mr: {
    lead: "Setu तुमच्या कामी येत आहे का?",
    body: "आमची मोफत साधने आणि मार्गदर्शक लेख तुमचे काम सोपे करत असतील, तर कृपया Google वर आम्हाला एक रिव्ह्यू द्या. फक्त एक मिनिट लागते, आणि त्यामुळे इतर व्यावसायिकांना आम्ही सापडायला मदत होते.",
    cta: "रिव्ह्यू द्या",
    label: "Google वर Setu ला रिव्ह्यू द्या",
    dismiss: "बंद करा",
  },
  gu: {
    lead: "શું Setu તમને મદદરૂપ થાય છે?",
    body: "જો અમારાં મફત ટૂલ્સ અને માર્ગદર્શિકાઓ તમારું કામ સરળ બનાવે છે, તો કૃપા કરીને Google પર અમને એક રિવ્યૂ આપો. માત્ર એક મિનિટ લાગે છે, અને બીજા વેપારીઓને અમને શોધવામાં મદદ મળે છે.",
    cta: "રિવ્યૂ આપો",
    label: "Google પર Setuને રિવ્યૂ આપો",
    dismiss: "બંધ કરો",
  },
  kn: {
    lead: "Setu ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತಿದೆಯೇ?",
    body: "ನಮ್ಮ ಉಚಿತ ಸಾಧನಗಳು ಮತ್ತು ಮಾರ್ಗದರ್ಶಿಗಳು ನಿಮ್ಮ ಕೆಲಸವನ್ನು ಸುಲಭಗೊಳಿಸಿದ್ದರೆ, ದಯವಿಟ್ಟು Google ನಲ್ಲಿ ನಮಗೆ ಒಂದು ವಿಮರ್ಶೆ ನೀಡಿ. ಒಂದು ನಿಮಿಷ ಸಾಕು, ಇದರಿಂದ ಇತರ ವ್ಯಾಪಾರಿಗಳಿಗೆ ನಮ್ಮನ್ನು ಕಂಡುಕೊಳ್ಳಲು ನೆರವಾಗುತ್ತದೆ.",
    cta: "ವಿಮರ್ಶೆ ನೀಡಿ",
    label: "Google ನಲ್ಲಿ Setu ಗೆ ವಿಮರ್ಶೆ ನೀಡಿ",
    dismiss: "ಮುಚ್ಚಿ",
  },
  ml: {
    lead: "Setu നിങ്ങൾക്ക് സഹായകരമാണോ?",
    body: "ഞങ്ങളുടെ സൗജന്യ ടൂളുകളും ഗൈഡുകളും നിങ്ങളുടെ ജോലി എളുപ്പമാക്കുന്നുണ്ടെങ്കിൽ, ദയവായി Google-ൽ ഞങ്ങൾക്ക് ഒരു റിവ്യൂ നൽകൂ. ഒരു മിനിറ്റ് മതി; മറ്റ് സംരംഭകർക്ക് ഞങ്ങളെ കണ്ടെത്താൻ ഇത് സഹായിക്കും.",
    cta: "റിവ്യൂ നൽകൂ",
    label: "Google-ൽ Setu-വിന് റിവ്യൂ നൽകൂ",
    dismiss: "അടയ്ക്കുക",
  },
  pa: {
    lead: "ਕੀ Setu ਤੁਹਾਡੇ ਕੰਮ ਆ ਰਿਹਾ ਹੈ?",
    body: "ਜੇ ਸਾਡੇ ਮੁਫ਼ਤ ਟੂਲ ਅਤੇ ਗਾਈਡਾਂ ਤੁਹਾਡਾ ਕੰਮ ਸੌਖਾ ਕਰ ਰਹੇ ਹਨ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ Google 'ਤੇ ਸਾਨੂੰ ਇੱਕ ਰਿਵਿਊ ਦਿਓ। ਬੱਸ ਇੱਕ ਮਿੰਟ ਲੱਗਦਾ ਹੈ, ਅਤੇ ਹੋਰ ਕਾਰੋਬਾਰੀਆਂ ਨੂੰ ਸਾਨੂੰ ਲੱਭਣ ਵਿੱਚ ਮਦਦ ਮਿਲਦੀ ਹੈ।",
    cta: "ਰਿਵਿਊ ਦਿਓ",
    label: "Google 'ਤੇ Setu ਨੂੰ ਰਿਵਿਊ ਦਿਓ",
    dismiss: "ਬੰਦ ਕਰੋ",
  },
  es: {
    lead: "¿Te está ayudando Setu?",
    body: "Si nuestras herramientas y guías gratuitas te facilitan el trabajo, déjanos una reseña en Google. Solo te llevará un minuto y ayuda a otros negocios a encontrarnos.",
    cta: "Dejar una reseña",
    label: "Reseña de Setu en Google",
    dismiss: "Cerrar",
  },
  fr: {
    lead: "Setu vous est utile ?",
    body: "Si nos outils et guides gratuits vous facilitent le travail, laissez-nous un avis sur Google. Cela ne prend qu'une minute et aide d'autres entreprises à nous trouver.",
    cta: "Laisser un avis",
    label: "Évaluer Setu sur Google",
    dismiss: "Fermer",
  },
  ar: {
    lead: "هل يساعدك Setu؟",
    body: "إذا كانت أدواتنا وأدلّتنا المجانية تسهّل عملك، فنرجو أن تترك لنا تقييمًا على Google. لن يستغرق ذلك سوى دقيقة، ويساعد أصحاب الأعمال الآخرين على الوصول إلينا.",
    cta: "اكتب تقييمًا",
    label: "قيّم Setu على Google",
    dismiss: "إغلاق",
  },
  pt: {
    lead: "O Setu está ajudando você?",
    body: "Se nossas ferramentas e guias gratuitos facilitam o seu trabalho, deixe uma avaliação no Google. Leva só um minuto e ajuda outros negócios a nos encontrar.",
    cta: "Deixar uma avaliação",
    label: "Avaliar o Setu no Google",
    dismiss: "Fechar",
  },
  id: {
    lead: "Apakah Setu membantu Anda?",
    body: "Jika alat dan panduan gratis kami memudahkan pekerjaan Anda, mohon beri kami ulasan di Google. Hanya butuh satu menit, dan ulasan Anda membantu pelaku usaha lain menemukan kami.",
    cta: "Beri ulasan",
    label: "Ulas Setu di Google",
    dismiss: "Tutup",
  },
  de: {
    lead: "Hilft Ihnen Setu?",
    body: "Wenn unsere kostenlosen Tools und Ratgeber Ihnen die Arbeit erleichtern, hinterlassen Sie uns bitte eine Google-Bewertung. Das dauert nur eine Minute und hilft anderen Unternehmen, uns zu finden.",
    cta: "Bewertung schreiben",
    label: "Setu auf Google bewerten",
    dismiss: "Schließen",
  },
  zh: {
    lead: "Setu 对你有帮助吗？",
    body: "如果我们的免费工具和指南让你的工作更轻松，请在 Google 上给我们留个评价。只需一分钟，就能帮助更多商家找到我们。",
    cta: "写评价",
    label: "在 Google 上评价 Setu",
    dismiss: "关闭",
  },
};
