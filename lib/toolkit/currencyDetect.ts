// Default currency for a new business, guessed from where the browser is.
//
// Order of evidence:
//   1. The device time zone. It follows the clock the shop actually runs on,
//      and it is the reliable signal for India — many Indian browsers report
//      an "en-US" language, but the time zone is still Asia/Kolkata.
//   2. The region in the browser's language list ("en-PK", "fr-CA"…).
//   3. Nothing usable: INR inside India's time zone, otherwise US dollars.
//
// Everything runs in the browser and nothing is sent anywhere. The owner can
// always change the currency in setup or settings; this only picks the first
// value shown.

import { allCurrencies } from "@/lib/toolkit/preferences";

/** ISO 3166-1 country → ISO 4217 currency. */
const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries(
  (
    "AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN " +
    "BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:BGN BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD " +
    "CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:ANG CX:AUD CY:EUR CZ:CZK " +
    "DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR " +
    "GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GT:GTQ GU:USD GW:XOF GY:GYD " +
    "HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IO:USD IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY " +
    "KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD " +
    "MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN " +
    "NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PN:NZD PR:USD PS:ILS PT:EUR PW:USD PY:PYG " +
    "QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:ANG SY:SYP SZ:SZL " +
    "TC:USD TD:XAF TG:XOF TH:THB TJ:TJS TK:NZD TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX UM:USD US:USD UY:UYU UZ:UZS " +
    "VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:USD"
  )
    .split(" ")
    .map((pair) => pair.split(":") as [string, string])
);

/** IANA time zone → country, for the zones shops most often run on. */
const ZONE_COUNTRY: Record<string, string> = Object.fromEntries(
  (
    "Asia/Kolkata:IN Asia/Calcutta:IN Asia/Karachi:PK Asia/Dhaka:BD Asia/Kathmandu:NP Asia/Katmandu:NP Asia/Colombo:LK Asia/Thimphu:BT " +
    "Indian/Maldives:MV Asia/Kabul:AF Asia/Dubai:AE Asia/Muscat:OM Asia/Qatar:QA Asia/Bahrain:BH Asia/Kuwait:KW Asia/Riyadh:SA " +
    "Asia/Baghdad:IQ Asia/Tehran:IR Asia/Jerusalem:IL Asia/Tel_Aviv:IL Asia/Amman:JO Asia/Beirut:LB Asia/Damascus:SY Asia/Aden:YE " +
    "Asia/Singapore:SG Asia/Kuala_Lumpur:MY Asia/Jakarta:ID Asia/Makassar:ID Asia/Jayapura:ID Asia/Bangkok:TH Asia/Ho_Chi_Minh:VN Asia/Saigon:VN " +
    "Asia/Manila:PH Asia/Hong_Kong:HK Asia/Macau:MO Asia/Shanghai:CN Asia/Taipei:TW Asia/Seoul:KR Asia/Tokyo:JP Asia/Yangon:MM Asia/Rangoon:MM " +
    "Asia/Phnom_Penh:KH Asia/Vientiane:LA Asia/Tashkent:UZ Asia/Almaty:KZ Asia/Bishkek:KG Asia/Dushanbe:TJ Asia/Ashgabat:TM Asia/Baku:AZ " +
    "Asia/Tbilisi:GE Asia/Yerevan:AM Asia/Ulaanbaatar:MN Asia/Brunei:BN " +
    "Europe/London:GB Europe/Dublin:IE Europe/Lisbon:PT Europe/Madrid:ES Europe/Paris:FR Europe/Brussels:BE Europe/Amsterdam:NL " +
    "Europe/Luxembourg:LU Europe/Berlin:DE Europe/Zurich:CH Europe/Vienna:AT Europe/Rome:IT Europe/Malta:MT Europe/Prague:CZ " +
    "Europe/Warsaw:PL Europe/Budapest:HU Europe/Bratislava:SK Europe/Ljubljana:SI Europe/Zagreb:HR Europe/Belgrade:RS Europe/Sarajevo:BA " +
    "Europe/Skopje:MK Europe/Tirane:AL Europe/Athens:GR Europe/Sofia:BG Europe/Bucharest:RO Europe/Chisinau:MD Europe/Kiev:UA Europe/Kyiv:UA " +
    "Europe/Minsk:BY Europe/Moscow:RU Europe/Istanbul:TR Europe/Helsinki:FI Europe/Tallinn:EE Europe/Riga:LV Europe/Vilnius:LT " +
    "Europe/Stockholm:SE Europe/Oslo:NO Europe/Copenhagen:DK Atlantic/Reykjavik:IS Asia/Nicosia:CY Europe/Monaco:MC " +
    "America/New_York:US America/Chicago:US America/Denver:US America/Phoenix:US America/Los_Angeles:US America/Anchorage:US " +
    "America/Detroit:US America/Indiana/Indianapolis:US America/Boise:US Pacific/Honolulu:US America/Puerto_Rico:PR " +
    "America/Toronto:CA America/Vancouver:CA America/Edmonton:CA America/Winnipeg:CA America/Halifax:CA America/St_Johns:CA America/Regina:CA " +
    "America/Mexico_City:MX America/Monterrey:MX America/Cancun:MX America/Tijuana:MX America/Guatemala:GT America/El_Salvador:SV " +
    "America/Tegucigalpa:HN America/Managua:NI America/Costa_Rica:CR America/Panama:PA America/Havana:CU America/Jamaica:JM " +
    "America/Santo_Domingo:DO America/Port_of_Spain:TT America/Barbados:BB America/Bogota:CO America/Caracas:VE America/Lima:PE " +
    "America/Guayaquil:EC America/La_Paz:BO America/Santiago:CL America/Argentina/Buenos_Aires:AR America/Buenos_Aires:AR " +
    "America/Montevideo:UY America/Asuncion:PY America/Sao_Paulo:BR America/Manaus:BR America/Fortaleza:BR America/Guyana:GY " +
    "Africa/Cairo:EG Africa/Lagos:NG Africa/Accra:GH Africa/Nairobi:KE Africa/Kampala:UG Africa/Dar_es_Salaam:TZ Africa/Kigali:RW " +
    "Africa/Addis_Ababa:ET Africa/Johannesburg:ZA Africa/Harare:ZW Africa/Lusaka:ZM Africa/Maputo:MZ Africa/Windhoek:NA " +
    "Africa/Gaborone:BW Africa/Casablanca:MA Africa/Algiers:DZ Africa/Tunis:TN Africa/Tripoli:LY Africa/Khartoum:SD Africa/Dakar:SN " +
    "Africa/Abidjan:CI Africa/Douala:CM Africa/Kinshasa:CD Africa/Luanda:AO Indian/Mauritius:MU Indian/Mahe:SC Indian/Antananarivo:MG " +
    "Australia/Sydney:AU Australia/Melbourne:AU Australia/Brisbane:AU Australia/Perth:AU Australia/Adelaide:AU Australia/Hobart:AU " +
    "Australia/Darwin:AU Pacific/Auckland:NZ Pacific/Fiji:FJ Pacific/Port_Moresby:PG Pacific/Guam:GU"
  )
    .split(" ")
    .map((pair) => {
      const i = pair.lastIndexOf(":");
      return [pair.slice(0, i), pair.slice(i + 1)] as [string, string];
    })
);

const INDIA_ZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

export type DetectInput = { timeZone?: string; languages?: readonly string[] };

function browserInput(): DetectInput {
  if (typeof window === "undefined") return {};
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  const languages = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  return { timeZone, languages };
}

/** The country in a language tag such as "en-PK" or "zh-Hant-TW", if any. */
function regionOf(tag: string): string | null {
  try {
    const region = new Intl.Locale(tag).region;
    return region && /^[A-Z]{2}$/.test(region) ? region : null;
  } catch {
    const match = /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(tag);
    return match ? match[1].toUpperCase() : null;
  }
}

/**
 * Best-guess currency for this browser. India → INR, Pakistan → PKR, and so
 * on; anything it cannot place outside India falls back to USD.
 */
export function detectCurrency(input: DetectInput = browserInput()): string {
  const zone = input.timeZone ?? "";
  if (INDIA_ZONES.has(zone)) return "INR";

  const zoneCountry = ZONE_COUNTRY[zone];
  if (zoneCountry && COUNTRY_CURRENCY[zoneCountry]) return COUNTRY_CURRENCY[zoneCountry];

  for (const tag of input.languages ?? []) {
    const region = regionOf(tag);
    if (region && COUNTRY_CURRENCY[region]) return COUNTRY_CURRENCY[region];
  }

  return "USD";
}

/** Currencies that are not money a shop prices in (gold, test codes, funds…). */
const NOT_SHOP_CURRENCIES = /^(X(AG|AU|BA|BB|BC|BD|DR|PD|PT|SU|TS|UA|XX)|BOV|CHE|CHW|CLF|COU|MXV|USN|UYI|UYW)$/;

/**
 * Every currency for a setup or settings picker, labelled "Name (symbol)".
 * `pin` (the current or detected currency) is listed first after INR.
 */
export function currencyOptions(pin?: string): { code: string; label: string }[] {
  const list = allCurrencies().filter((c) => !NOT_SHOP_CURRENCIES.test(c.code));
  const label = (c: { code: string; name: string; symbol: string }) =>
    c.symbol && c.symbol !== c.code ? `${c.name} (${c.symbol})` : `${c.name} (${c.code})`;
  const options = list.map((c) => ({ code: c.code, label: label(c) }));
  if (pin && pin !== "INR") {
    const i = options.findIndex((o) => o.code === pin);
    if (i > 0) {
      const [picked] = options.splice(i, 1);
      const afterInr = options[0]?.code === "INR" ? 1 : 0;
      options.splice(afterInr, 0, picked);
    }
  }
  // A saved currency the browser does not list still has to show.
  if (pin && !options.some((o) => o.code === pin)) options.unshift({ code: pin, label: pin });
  return options;
}
