// A starter medicine master for the Free Clinic Manager.
//
// WHAT THIS IS: roughly two hundred generics commonly stocked in Indian
// practice, with their salt and a usual marketed strength, so a doctor can
// prescribe on day one instead of typing a master list before seeing anyone.
//
// WHAT THIS IS NOT: a formulary, a dosing reference, or clinical advice. Every
// entry deliberately ships with an EMPTY default frequency and duration. The
// app auto-computes a dispense quantity from whatever the doctor types, and
// seeding a default dose would put a number on the prescription that no doctor
// chose. Doses are the prescriber's, always.
//
// Seeding is opt-in — Settings → Medicines → "Add starter list". Nothing is
// written until the doctor asks for it, and every row is editable and
// deletable afterwards.

import { generateId, nowIso } from "@/lib/pos/types";
import type { Medicine, MedicineForm } from "./types";

/** [name, strength, form, composition] */
type SeedRow = [string, string, MedicineForm, string];

const SEED_ROWS: SeedRow[] = [
  // --- Analgesics, antipyretics, NSAIDs ---
  ["Paracetamol", "500 mg", "tablet", "Paracetamol"],
  ["Paracetamol", "650 mg", "tablet", "Paracetamol"],
  ["Paracetamol", "125 mg/5 ml", "syrup", "Paracetamol"],
  ["Paracetamol", "250 mg/5 ml", "syrup", "Paracetamol"],
  ["Paracetamol Drops", "100 mg/ml", "drops", "Paracetamol"],
  ["Ibuprofen", "400 mg", "tablet", "Ibuprofen"],
  ["Ibuprofen", "100 mg/5 ml", "syrup", "Ibuprofen"],
  ["Ibuprofen + Paracetamol", "400 mg + 325 mg", "tablet", "Ibuprofen + Paracetamol"],
  ["Diclofenac Sodium", "50 mg", "tablet", "Diclofenac Sodium"],
  ["Diclofenac Gel", "1% w/w", "ointment", "Diclofenac Diethylamine"],
  ["Aceclofenac", "100 mg", "tablet", "Aceclofenac"],
  ["Aceclofenac + Paracetamol", "100 mg + 325 mg", "tablet", "Aceclofenac + Paracetamol"],
  ["Naproxen", "250 mg", "tablet", "Naproxen"],
  ["Mefenamic Acid", "500 mg", "tablet", "Mefenamic Acid"],
  ["Nimesulide", "100 mg", "tablet", "Nimesulide"],
  ["Etoricoxib", "90 mg", "tablet", "Etoricoxib"],
  ["Tramadol", "50 mg", "capsule", "Tramadol Hydrochloride"],
  ["Aspirin", "75 mg", "tablet", "Acetylsalicylic Acid"],
  ["Serratiopeptidase", "10 mg", "tablet", "Serratiopeptidase"],
  ["Trypsin + Chymotrypsin", "50000 AU", "tablet", "Trypsin + Chymotrypsin"],

  // --- Antibiotics ---
  ["Amoxicillin", "500 mg", "capsule", "Amoxicillin"],
  ["Amoxicillin", "250 mg", "capsule", "Amoxicillin"],
  ["Amoxicillin + Clavulanic Acid", "625 mg", "tablet", "Amoxicillin + Clavulanic Acid"],
  ["Amoxicillin + Clavulanic Acid", "228.5 mg/5 ml", "syrup", "Amoxicillin + Clavulanic Acid"],
  ["Azithromycin", "500 mg", "tablet", "Azithromycin"],
  ["Azithromycin", "250 mg", "tablet", "Azithromycin"],
  ["Azithromycin", "200 mg/5 ml", "syrup", "Azithromycin"],
  ["Cefixime", "200 mg", "tablet", "Cefixime"],
  ["Cefixime", "50 mg/5 ml", "syrup", "Cefixime"],
  ["Cefuroxime", "500 mg", "tablet", "Cefuroxime Axetil"],
  ["Cephalexin", "500 mg", "capsule", "Cephalexin"],
  ["Cefpodoxime", "200 mg", "tablet", "Cefpodoxime Proxetil"],
  ["Ceftriaxone", "1 g", "injection", "Ceftriaxone Sodium"],
  ["Ciprofloxacin", "500 mg", "tablet", "Ciprofloxacin"],
  ["Levofloxacin", "500 mg", "tablet", "Levofloxacin"],
  ["Ofloxacin", "200 mg", "tablet", "Ofloxacin"],
  ["Ofloxacin + Ornidazole", "200 mg + 500 mg", "tablet", "Ofloxacin + Ornidazole"],
  ["Norfloxacin", "400 mg", "tablet", "Norfloxacin"],
  ["Doxycycline", "100 mg", "capsule", "Doxycycline Hyclate"],
  ["Metronidazole", "400 mg", "tablet", "Metronidazole"],
  ["Metronidazole", "200 mg/5 ml", "syrup", "Metronidazole"],
  ["Ornidazole", "500 mg", "tablet", "Ornidazole"],
  ["Clarithromycin", "500 mg", "tablet", "Clarithromycin"],
  ["Clindamycin", "300 mg", "capsule", "Clindamycin"],
  ["Linezolid", "600 mg", "tablet", "Linezolid"],
  ["Nitrofurantoin", "100 mg", "capsule", "Nitrofurantoin"],
  ["Rifaximin", "400 mg", "tablet", "Rifaximin"],
  ["Cotrimoxazole", "800 mg + 160 mg", "tablet", "Sulfamethoxazole + Trimethoprim"],
  ["Amikacin", "500 mg", "injection", "Amikacin Sulphate"],
  ["Gentamicin", "80 mg", "injection", "Gentamicin Sulphate"],

  // --- Acidity, GI ---
  ["Pantoprazole", "40 mg", "tablet", "Pantoprazole Sodium"],
  ["Pantoprazole + Domperidone", "40 mg + 30 mg", "capsule", "Pantoprazole + Domperidone"],
  ["Omeprazole", "20 mg", "capsule", "Omeprazole"],
  ["Esomeprazole", "40 mg", "tablet", "Esomeprazole"],
  ["Rabeprazole", "20 mg", "tablet", "Rabeprazole Sodium"],
  ["Rabeprazole + Domperidone", "20 mg + 30 mg", "capsule", "Rabeprazole + Domperidone"],
  ["Ranitidine", "150 mg", "tablet", "Ranitidine"],
  ["Famotidine", "40 mg", "tablet", "Famotidine"],
  ["Antacid Gel", "170 ml", "syrup", "Magnesium Hydroxide + Aluminium Hydroxide + Simethicone"],
  ["Sucralfate", "1 g/10 ml", "syrup", "Sucralfate"],
  ["Domperidone", "10 mg", "tablet", "Domperidone"],
  ["Ondansetron", "4 mg", "tablet", "Ondansetron"],
  ["Ondansetron", "2 mg/5 ml", "syrup", "Ondansetron"],
  ["Metoclopramide", "10 mg", "tablet", "Metoclopramide"],
  ["Dicyclomine", "20 mg", "tablet", "Dicyclomine Hydrochloride"],
  ["Drotaverine", "40 mg", "tablet", "Drotaverine Hydrochloride"],
  ["Mebeverine", "135 mg", "tablet", "Mebeverine Hydrochloride"],
  ["Hyoscine Butylbromide", "10 mg", "tablet", "Hyoscine Butylbromide"],
  ["Lactulose", "10 g/15 ml", "syrup", "Lactulose"],
  ["Bisacodyl", "5 mg", "tablet", "Bisacodyl"],
  ["Ispaghula Husk", "3.5 g", "sachet", "Ispaghula Husk"],
  ["Sodium Picosulfate", "10 mg/5 ml", "syrup", "Sodium Picosulfate"],
  ["Racecadotril", "100 mg", "capsule", "Racecadotril"],
  ["ORS Powder", "21.8 g", "sachet", "Oral Rehydration Salts"],
  ["Zinc Sulphate", "20 mg", "tablet", "Zinc Sulphate"],
  ["Probiotic Sachet", "1 g", "sachet", "Lactobacillus / Saccharomyces boulardii"],
  ["Ursodeoxycholic Acid", "300 mg", "tablet", "Ursodeoxycholic Acid"],
  ["Albendazole", "400 mg", "tablet", "Albendazole"],
  ["Albendazole", "200 mg/5 ml", "syrup", "Albendazole"],
  ["Ivermectin", "12 mg", "tablet", "Ivermectin"],

  // --- Antihistamines, cough & cold ---
  ["Cetirizine", "10 mg", "tablet", "Cetirizine Hydrochloride"],
  ["Cetirizine", "5 mg/5 ml", "syrup", "Cetirizine Hydrochloride"],
  ["Levocetirizine", "5 mg", "tablet", "Levocetirizine"],
  ["Levocetirizine + Montelukast", "5 mg + 10 mg", "tablet", "Levocetirizine + Montelukast"],
  ["Fexofenadine", "120 mg", "tablet", "Fexofenadine Hydrochloride"],
  ["Loratadine", "10 mg", "tablet", "Loratadine"],
  ["Chlorpheniramine Maleate", "4 mg", "tablet", "Chlorpheniramine Maleate"],
  ["Hydroxyzine", "25 mg", "tablet", "Hydroxyzine Hydrochloride"],
  ["Montelukast", "10 mg", "tablet", "Montelukast Sodium"],
  ["Ambroxol", "30 mg", "tablet", "Ambroxol Hydrochloride"],
  ["Ambroxol + Guaiphenesin + Terbutaline", "Syrup", "syrup", "Ambroxol + Guaiphenesin + Terbutaline"],
  ["Dextromethorphan Syrup", "100 ml", "syrup", "Dextromethorphan Hydrobromide"],
  ["Bromhexine", "8 mg", "tablet", "Bromhexine Hydrochloride"],
  ["Acetylcysteine", "600 mg", "sachet", "Acetylcysteine"],
  ["Xylometazoline Nasal Drops", "0.1%", "drops", "Xylometazoline Hydrochloride"],
  ["Saline Nasal Drops", "0.65%", "drops", "Sodium Chloride"],
  ["Steam Inhalant Capsule", "—", "inhaler", "Menthol + Eucalyptus Oil"],

  // --- Respiratory ---
  ["Salbutamol", "2 mg", "tablet", "Salbutamol Sulphate"],
  ["Salbutamol Inhaler", "100 mcg/dose", "inhaler", "Salbutamol Sulphate"],
  ["Salbutamol Respules", "2.5 mg/2.5 ml", "injection", "Salbutamol Sulphate"],
  ["Budesonide Inhaler", "200 mcg/dose", "inhaler", "Budesonide"],
  ["Budesonide Respules", "0.5 mg/2 ml", "injection", "Budesonide"],
  ["Formoterol + Budesonide Inhaler", "6 mcg + 200 mcg", "inhaler", "Formoterol + Budesonide"],
  ["Ipratropium Respules", "500 mcg/2 ml", "injection", "Ipratropium Bromide"],
  ["Theophylline", "400 mg", "tablet", "Theophylline"],
  ["Doxofylline", "400 mg", "tablet", "Doxofylline"],
  ["Deriphyllin", "150 mg", "tablet", "Etofylline + Theophylline"],

  // --- Cardiovascular ---
  ["Amlodipine", "5 mg", "tablet", "Amlodipine Besylate"],
  ["Amlodipine", "10 mg", "tablet", "Amlodipine Besylate"],
  ["Telmisartan", "40 mg", "tablet", "Telmisartan"],
  ["Telmisartan + Hydrochlorothiazide", "40 mg + 12.5 mg", "tablet", "Telmisartan + Hydrochlorothiazide"],
  ["Telmisartan + Amlodipine", "40 mg + 5 mg", "tablet", "Telmisartan + Amlodipine"],
  ["Losartan Potassium", "50 mg", "tablet", "Losartan Potassium"],
  ["Olmesartan", "20 mg", "tablet", "Olmesartan Medoxomil"],
  ["Ramipril", "5 mg", "tablet", "Ramipril"],
  ["Enalapril", "5 mg", "tablet", "Enalapril Maleate"],
  ["Metoprolol", "25 mg", "tablet", "Metoprolol Succinate"],
  ["Atenolol", "50 mg", "tablet", "Atenolol"],
  ["Bisoprolol", "5 mg", "tablet", "Bisoprolol Fumarate"],
  ["Carvedilol", "6.25 mg", "tablet", "Carvedilol"],
  ["Nebivolol", "5 mg", "tablet", "Nebivolol"],
  ["Hydrochlorothiazide", "12.5 mg", "tablet", "Hydrochlorothiazide"],
  ["Furosemide", "40 mg", "tablet", "Furosemide"],
  ["Torsemide", "10 mg", "tablet", "Torsemide"],
  ["Spironolactone", "25 mg", "tablet", "Spironolactone"],
  ["Clopidogrel", "75 mg", "tablet", "Clopidogrel Bisulphate"],
  ["Atorvastatin", "10 mg", "tablet", "Atorvastatin Calcium"],
  ["Atorvastatin", "20 mg", "tablet", "Atorvastatin Calcium"],
  ["Rosuvastatin", "10 mg", "tablet", "Rosuvastatin Calcium"],
  ["Isosorbide Mononitrate", "20 mg", "tablet", "Isosorbide Mononitrate"],
  ["Nitroglycerin", "2.6 mg", "tablet", "Nitroglycerin"],
  ["Digoxin", "0.25 mg", "tablet", "Digoxin"],
  ["Warfarin", "5 mg", "tablet", "Warfarin Sodium"],

  // --- Diabetes ---
  ["Metformin", "500 mg", "tablet", "Metformin Hydrochloride"],
  ["Metformin SR", "1000 mg", "tablet", "Metformin Hydrochloride"],
  ["Glimepiride", "1 mg", "tablet", "Glimepiride"],
  ["Glimepiride + Metformin", "1 mg + 500 mg", "tablet", "Glimepiride + Metformin"],
  ["Gliclazide", "80 mg", "tablet", "Gliclazide"],
  ["Sitagliptin", "100 mg", "tablet", "Sitagliptin Phosphate"],
  ["Vildagliptin", "50 mg", "tablet", "Vildagliptin"],
  ["Teneligliptin", "20 mg", "tablet", "Teneligliptin"],
  ["Dapagliflozin", "10 mg", "tablet", "Dapagliflozin"],
  ["Empagliflozin", "10 mg", "tablet", "Empagliflozin"],
  ["Pioglitazone", "15 mg", "tablet", "Pioglitazone"],
  ["Voglibose", "0.3 mg", "tablet", "Voglibose"],
  ["Insulin Human (Regular)", "100 IU/ml", "injection", "Human Insulin"],
  ["Insulin Glargine", "100 IU/ml", "injection", "Insulin Glargine"],

  // --- Thyroid, steroids, hormones ---
  ["Levothyroxine", "50 mcg", "tablet", "Levothyroxine Sodium"],
  ["Levothyroxine", "25 mcg", "tablet", "Levothyroxine Sodium"],
  ["Carbimazole", "5 mg", "tablet", "Carbimazole"],
  ["Prednisolone", "10 mg", "tablet", "Prednisolone"],
  ["Prednisolone", "5 mg", "tablet", "Prednisolone"],
  ["Deflazacort", "6 mg", "tablet", "Deflazacort"],
  ["Dexamethasone", "0.5 mg", "tablet", "Dexamethasone"],
  ["Hydrocortisone", "100 mg", "injection", "Hydrocortisone Sodium Succinate"],
  ["Methylprednisolone", "4 mg", "tablet", "Methylprednisolone"],

  // --- Vitamins & supplements ---
  ["Vitamin D3", "60000 IU", "sachet", "Cholecalciferol"],
  ["Vitamin B Complex", "—", "tablet", "B-Complex Vitamins"],
  ["Vitamin B12", "1500 mcg", "tablet", "Methylcobalamin"],
  ["Vitamin C", "500 mg", "tablet", "Ascorbic Acid"],
  ["Calcium + Vitamin D3", "500 mg + 250 IU", "tablet", "Calcium Carbonate + Cholecalciferol"],
  ["Ferrous Ascorbate + Folic Acid", "100 mg + 1.5 mg", "tablet", "Ferrous Ascorbate + Folic Acid"],
  ["Ferrous Sulphate", "200 mg", "tablet", "Ferrous Sulphate"],
  ["Folic Acid", "5 mg", "tablet", "Folic Acid"],
  ["Iron Syrup", "100 ml", "syrup", "Iron + Folic Acid"],
  ["Multivitamin", "—", "capsule", "Multivitamin + Multimineral"],
  ["Zinc + Multivitamin Syrup", "100 ml", "syrup", "Zinc + Multivitamin"],
  ["Protein Powder", "200 g", "sachet", "Protein Supplement"],
  ["Shelcal", "500 mg", "tablet", "Calcium Carbonate + Vitamin D3"],
  ["Methylcobalamin + Pregabalin", "750 mcg + 75 mg", "capsule", "Methylcobalamin + Pregabalin"],

  // --- Neuro & psych ---
  ["Pregabalin", "75 mg", "capsule", "Pregabalin"],
  ["Gabapentin", "300 mg", "capsule", "Gabapentin"],
  ["Amitriptyline", "10 mg", "tablet", "Amitriptyline"],
  ["Sertraline", "50 mg", "tablet", "Sertraline"],
  ["Escitalopram", "10 mg", "tablet", "Escitalopram"],
  ["Fluoxetine", "20 mg", "capsule", "Fluoxetine"],
  ["Alprazolam", "0.25 mg", "tablet", "Alprazolam"],
  ["Clonazepam", "0.5 mg", "tablet", "Clonazepam"],
  ["Etizolam", "0.25 mg", "tablet", "Etizolam"],
  ["Sodium Valproate", "500 mg", "tablet", "Sodium Valproate"],
  ["Levetiracetam", "500 mg", "tablet", "Levetiracetam"],
  ["Phenytoin", "100 mg", "capsule", "Phenytoin Sodium"],
  ["Carbamazepine", "200 mg", "tablet", "Carbamazepine"],
  ["Betahistine", "16 mg", "tablet", "Betahistine Dihydrochloride"],
  ["Cinnarizine", "25 mg", "tablet", "Cinnarizine"],
  ["Flunarizine", "10 mg", "tablet", "Flunarizine"],
  ["Sumatriptan", "50 mg", "tablet", "Sumatriptan"],
  ["Donepezil", "5 mg", "tablet", "Donepezil"],

  // --- Skin ---
  ["Clotrimazole Cream", "1% w/w", "ointment", "Clotrimazole"],
  ["Ketoconazole Cream", "2% w/w", "ointment", "Ketoconazole"],
  ["Terbinafine Cream", "1% w/w", "ointment", "Terbinafine Hydrochloride"],
  ["Terbinafine", "250 mg", "tablet", "Terbinafine Hydrochloride"],
  ["Fluconazole", "150 mg", "tablet", "Fluconazole"],
  ["Itraconazole", "100 mg", "capsule", "Itraconazole"],
  ["Griseofulvin", "250 mg", "tablet", "Griseofulvin"],
  ["Mupirocin Ointment", "2% w/w", "ointment", "Mupirocin"],
  ["Fusidic Acid Cream", "2% w/w", "ointment", "Fusidic Acid"],
  ["Silver Sulfadiazine Cream", "1% w/w", "ointment", "Silver Sulfadiazine"],
  ["Betamethasone Cream", "0.05% w/w", "ointment", "Betamethasone Valerate"],
  ["Hydrocortisone Cream", "1% w/w", "ointment", "Hydrocortisone Acetate"],
  ["Calamine Lotion", "100 ml", "ointment", "Calamine"],
  ["Permethrin Cream", "5% w/w", "ointment", "Permethrin"],
  ["Benzoyl Peroxide Gel", "2.5% w/w", "ointment", "Benzoyl Peroxide"],
  ["Adapalene Gel", "0.1% w/w", "ointment", "Adapalene"],
  ["Acyclovir", "400 mg", "tablet", "Acyclovir"],
  ["Acyclovir Cream", "5% w/w", "ointment", "Acyclovir"],
  ["Valacyclovir", "500 mg", "tablet", "Valacyclovir"],

  // --- Eye & ENT ---
  ["Moxifloxacin Eye Drops", "0.5% w/v", "drops", "Moxifloxacin"],
  ["Ciprofloxacin Eye Drops", "0.3% w/v", "drops", "Ciprofloxacin"],
  ["Tobramycin Eye Drops", "0.3% w/v", "drops", "Tobramycin"],
  ["Carboxymethylcellulose Eye Drops", "0.5% w/v", "drops", "Carboxymethylcellulose Sodium"],
  ["Olopatadine Eye Drops", "0.1% w/v", "drops", "Olopatadine"],
  ["Timolol Eye Drops", "0.5% w/v", "drops", "Timolol Maleate"],
  ["Clotrimazole Ear Drops", "1% w/v", "drops", "Clotrimazole"],
  ["Ofloxacin Ear Drops", "0.3% w/v", "drops", "Ofloxacin"],
  ["Povidone Iodine Gargle", "2% w/v", "syrup", "Povidone Iodine"],
  ["Chlorhexidine Mouthwash", "0.2% w/v", "syrup", "Chlorhexidine Gluconate"],

  // --- Urology & gynaecology ---
  ["Tamsulosin", "0.4 mg", "capsule", "Tamsulosin Hydrochloride"],
  ["Finasteride", "5 mg", "tablet", "Finasteride"],
  ["Sildenafil", "50 mg", "tablet", "Sildenafil Citrate"],
  ["Potassium Citrate Syrup", "100 ml", "syrup", "Potassium Citrate"],
  ["Tranexamic Acid", "500 mg", "tablet", "Tranexamic Acid"],
  ["Norethisterone", "5 mg", "tablet", "Norethisterone"],
  ["Medroxyprogesterone", "10 mg", "tablet", "Medroxyprogesterone Acetate"],
  ["Clotrimazole Pessary", "500 mg", "other", "Clotrimazole"],
  ["Misoprostol", "200 mcg", "tablet", "Misoprostol"],

  // --- Musculoskeletal ---
  ["Thiocolchicoside + Aceclofenac", "4 mg + 100 mg", "tablet", "Thiocolchicoside + Aceclofenac"],
  ["Chlorzoxazone + Paracetamol", "250 mg + 325 mg", "tablet", "Chlorzoxazone + Paracetamol"],
  ["Tizanidine", "2 mg", "tablet", "Tizanidine"],
  ["Baclofen", "10 mg", "tablet", "Baclofen"],
  ["Allopurinol", "100 mg", "tablet", "Allopurinol"],
  ["Febuxostat", "40 mg", "tablet", "Febuxostat"],
  ["Colchicine", "0.5 mg", "tablet", "Colchicine"],
  ["Glucosamine + Chondroitin", "750 mg + 250 mg", "tablet", "Glucosamine + Chondroitin"],
  ["Alendronate", "70 mg", "tablet", "Alendronate Sodium"],

  // --- Misc & emergency tray ---
  ["Adrenaline", "1 mg/ml", "injection", "Adrenaline (Epinephrine)"],
  ["Atropine", "0.6 mg/ml", "injection", "Atropine Sulphate"],
  ["Pheniramine Maleate", "22.75 mg/ml", "injection", "Pheniramine Maleate"],
  ["Diclofenac Injection", "75 mg/ml", "injection", "Diclofenac Sodium"],
  ["Tetanus Toxoid", "0.5 ml", "injection", "Tetanus Toxoid"],
  ["Normal Saline", "500 ml", "injection", "Sodium Chloride 0.9%"],
  ["Ringer Lactate", "500 ml", "injection", "Compound Sodium Lactate"],
  ["Dextrose", "5% 500 ml", "injection", "Dextrose"],
  ["Lignocaine", "2% w/v", "injection", "Lignocaine Hydrochloride"],
  ["Povidone Iodine Ointment", "5% w/w", "ointment", "Povidone Iodine"],
];

/** How many rows the starter list holds — shown on the Settings button. */
export const SEED_MEDICINE_COUNT = SEED_ROWS.length;

/**
 * Build the seed records. Defaults are intentionally blank: the doctor decides
 * the dose, and the app computes the quantity from what they type.
 */
export function buildSeedMedicines(): Medicine[] {
  const createdAt = nowIso();
  return SEED_ROWS.map(([name, strength, form, composition]) => ({
    id: generateId(),
    name,
    strength,
    form,
    composition,
    defaultFrequency: "",
    defaultDurationDays: null,
    defaultTiming: "" as const,
    timesUsed: 0,
    createdAt,
  }));
}

/** Key used to skip rows the clinic already has, so seeding twice is harmless. */
export function medicineKey(medicine: { name: string; strength: string }): string {
  return `${medicine.name.trim().toLowerCase()}|${medicine.strength.trim().toLowerCase()}`;
}
