export const wordHuntVersion = 1;

export const wordHuntCases = [
  {
    "id": "hunt-01",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which hormone is deficient in type 1 diabetes?",
    "answer": "INSULIN",
    "decoys": [
      "GLUCAGON",
      "CORTISOL",
      "THYROXINE"
    ],
    "explanation": "Type 1 diabetes destroys pancreatic beta cells, so insulin production falls and glucose accumulates in the blood."
  },
  {
    "id": "hunt-02",
    "category": "Labs",
    "difficulty": 2,
    "question": "Which electrolyte abnormality causes peaked T waves on an ECG?",
    "answer": "POTASSIUM",
    "decoys": [
      "CALCIUM",
      "SODIUM",
      "MAGNESIUM"
    ],
    "explanation": "Hyperkalemia peaks and widens the T wave and can progress to a sine wave pattern and cardiac arrest."
  },
  {
    "id": "hunt-03",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which antidote reverses opioid-induced respiratory depression?",
    "answer": "NALOXONE",
    "decoys": [
      "FLUMAZENIL",
      "ATROPINE",
      "MIDAZOLAM"
    ],
    "explanation": "Naloxone is a short acting opioid antagonist; repeat doses may be needed because it wears off before many opioids do."
  },
  {
    "id": "hunt-04",
    "category": "Labs",
    "difficulty": 2,
    "question": "Which vitamin is deficient in pernicious anemia?",
    "answer": "COBALAMIN",
    "decoys": [
      "FOLATE",
      "THIAMINE",
      "PYRIDOXINE"
    ],
    "explanation": "Pernicious anemia is autoimmune loss of intrinsic factor, so cobalamin cannot be absorbed in the terminal ileum."
  },
  {
    "id": "hunt-05",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which antidote reverses benzodiazepine sedation?",
    "answer": "FLUMAZENIL",
    "decoys": [
      "NALOXONE",
      "ATROPINE",
      "PROTAMINE"
    ],
    "explanation": "Flumazenil blocks the benzodiazepine site on the GABA-A receptor and can provoke seizures in chronic benzodiazepine users."
  },
  {
    "id": "hunt-06",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which anticoagulant is monitored with the aPTT?",
    "answer": "HEPARIN",
    "decoys": [
      "WARFARIN",
      "ASPIRIN",
      "DIGOXIN"
    ],
    "explanation": "Unfractionated heparin prolongs the aPTT, while warfarin is monitored with the INR."
  },
  {
    "id": "hunt-07",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which anticoagulant is monitored with the INR?",
    "answer": "WARFARIN",
    "decoys": [
      "HEPARIN",
      "ENOXAPARIN",
      "ASPIRIN"
    ],
    "explanation": "Warfarin blocks vitamin K dependent clotting factors, and the INR reflects that effect."
  },
  {
    "id": "hunt-08",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which drug can cause yellow-green visual halos in toxicity?",
    "answer": "DIGOXIN",
    "decoys": [
      "AMIODARONE",
      "LITHIUM",
      "PHENYTOIN"
    ],
    "explanation": "Digoxin toxicity causes nausea, bradycardia and classically yellow-green visual disturbances."
  },
  {
    "id": "hunt-09",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which drug is first-line for symptomatic bradycardia?",
    "answer": "ATROPINE",
    "decoys": [
      "ADENOSINE",
      "AMIODARONE",
      "LIDOCAINE"
    ],
    "explanation": "Atropine blocks vagal tone at the SA node; transcutaneous pacing is next if it fails."
  },
  {
    "id": "hunt-10",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which drug is first-line for stable supraventricular tachycardia?",
    "answer": "ADENOSINE",
    "decoys": [
      "ATROPINE",
      "DIGOXIN",
      "MORPHINE"
    ],
    "explanation": "Adenosine briefly blocks the AV node and can terminate AV nodal re-entrant tachycardia."
  },
  {
    "id": "hunt-11",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which antiarrhythmic is given for shock-refractory ventricular fibrillation?",
    "answer": "AMIODARONE",
    "decoys": [
      "ATROPINE",
      "ADENOSINE",
      "LIDOCAINE"
    ],
    "explanation": "Amiodarone is given after defibrillation and epinephrine in refractory VF or pulseless VT."
  },
  {
    "id": "hunt-12",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which loop diuretic is used for acute pulmonary edema?",
    "answer": "FUROSEMIDE",
    "decoys": [
      "MANNITOL",
      "GLIPIZIDE",
      "ALBUMIN"
    ],
    "explanation": "Furosemide blocks the sodium-potassium-chloride cotransporter in the loop of Henle and produces rapid diuresis."
  },
  {
    "id": "hunt-13",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which drug is first-line for type 2 diabetes?",
    "answer": "METFORMIN",
    "decoys": [
      "INSULIN",
      "GLIPIZIDE",
      "THYROXINE"
    ],
    "explanation": "Metformin lowers hepatic glucose output; hold it when renal function falls or before iodinated contrast."
  },
  {
    "id": "hunt-14",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which hormone is replaced in hypothyroidism?",
    "answer": "THYROXINE",
    "decoys": [
      "INSULIN",
      "CORTISOL",
      "MELATONIN"
    ],
    "explanation": "Levothyroxine replaces thyroxine and is titrated against the TSH level."
  },
  {
    "id": "hunt-15",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which steroid is commonly used for an asthma exacerbation?",
    "answer": "PREDNISONE",
    "decoys": [
      "ALBUTEROL",
      "TIOTROPIUM",
      "BUDESONIDE"
    ],
    "explanation": "Systemic steroids reduce airway inflammation, while albuterol relieves the bronchospasm."
  },
  {
    "id": "hunt-16",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which inhaled drug relieves acute bronchospasm?",
    "answer": "ALBUTEROL",
    "decoys": [
      "PREDNISONE",
      "TIOTROPIUM",
      "BUDESONIDE"
    ],
    "explanation": "Albuterol is a short acting beta-2 agonist used as a rescue inhaler, not as a controller."
  },
  {
    "id": "hunt-17",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which antibiotic requires trough monitoring for MRSA?",
    "answer": "VANCOMYCIN",
    "decoys": [
      "GENTAMICIN",
      "PENICILLIN",
      "MORPHINE"
    ],
    "explanation": "Vancomycin is nephrotoxic, so troughs or an AUC estimate keep levels in the therapeutic window."
  },
  {
    "id": "hunt-18",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which antibiotic is classically nephrotoxic and ototoxic?",
    "answer": "GENTAMICIN",
    "decoys": [
      "VANCOMYCIN",
      "PENICILLIN",
      "ASPIRIN"
    ],
    "explanation": "Aminoglycosides such as gentamicin damage the proximal tubule and the eighth cranial nerve."
  },
  {
    "id": "hunt-19",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which opioid is the classic analgesic for severe pain?",
    "answer": "MORPHINE",
    "decoys": [
      "NALOXONE",
      "KETAMINE",
      "LIDOCAINE"
    ],
    "explanation": "Morphine is a mu-opioid agonist; watch for respiratory depression, constipation and hypotension."
  },
  {
    "id": "hunt-20",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which opioid is often used for rapid procedural analgesia?",
    "answer": "FENTANYL",
    "decoys": [
      "MORPHINE",
      "NALOXONE",
      "KETOROLAC"
    ],
    "explanation": "Fentanyl is fast and short acting, which suits brief painful procedures."
  },
  {
    "id": "hunt-21",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which benzodiazepine is used for procedural sedation?",
    "answer": "MIDAZOLAM",
    "decoys": [
      "LORAZEPAM",
      "PHENYTOIN",
      "PROPOFOL"
    ],
    "explanation": "Midazolam provides anxiolysis and amnesia, and flumazenil reverses it."
  },
  {
    "id": "hunt-22",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which induction agent is a white emulsion that can cause hypotension?",
    "answer": "PROPOFOL",
    "decoys": [
      "KETAMINE",
      "ETOMIDATE",
      "MORPHINE"
    ],
    "explanation": "Propofol causes vasodilation and hypotension; the emulsion contains egg lecithin and soybean oil."
  },
  {
    "id": "hunt-23",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which induction agent preserves blood pressure and causes dissociation?",
    "answer": "KETAMINE",
    "decoys": [
      "PROPOFOL",
      "MIDAZOLAM",
      "ROCURONIUM"
    ],
    "explanation": "Ketamine is a dissociative agent with sympathomimetic effects; it can cause emergence reactions."
  },
  {
    "id": "hunt-24",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which paralytic is a non-depolarizing neuromuscular blocker?",
    "answer": "ROCURONIUM",
    "decoys": [
      "KETAMINE",
      "PROPOFOL",
      "FENTANYL"
    ],
    "explanation": "Rocuronium blocks acetylcholine at the motor end plate, and sugammadex can reverse it."
  },
  {
    "id": "hunt-25",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which H1 antihistamine is used for motion sickness?",
    "answer": "MECLIZINE",
    "decoys": [
      "DOXYLAMINE",
      "CYCLIZINE",
      "HYOSCINE"
    ],
    "explanation": "Meclizine is a first generation H1 antihistamine with anticholinergic effects; it eases motion sickness but causes sedation."
  },
  {
    "id": "hunt-26",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which drug is a sodium channel blocker used for focal seizures?",
    "answer": "PHENYTOIN",
    "decoys": [
      "VALPROATE",
      "GABAPENTIN",
      "LORAZEPAM"
    ],
    "explanation": "Phenytoin blocks voltage gated sodium channels; monitor levels and watch for gingival hyperplasia."
  },
  {
    "id": "hunt-27",
    "category": "Pharmacology",
    "difficulty": 3,
    "question": "Which osmotic agent lowers intracranial pressure?",
    "answer": "MANNITOL",
    "decoys": [
      "FUROSEMIDE",
      "DOPAMINE",
      "ALBUMIN"
    ],
    "explanation": "Mannitol draws water out of brain tissue; it is filtered by the kidneys and can cause rebound edema."
  },
  {
    "id": "hunt-28",
    "category": "Pharmacology",
    "difficulty": 2,
    "question": "Which drug is an NSAID that irreversibly inhibits platelets?",
    "answer": "ASPIRIN",
    "decoys": [
      "IBUPROFEN",
      "WARFARIN",
      "HEPARIN"
    ],
    "explanation": "Aspirin irreversibly acetylates platelet COX-1, so the effect lasts for the life of the platelet."
  },
  {
    "id": "hunt-29",
    "category": "Pharmacology",
    "difficulty": 1,
    "question": "Which NSAID is commonly used for fever and mild pain?",
    "answer": "IBUPROFEN",
    "decoys": [
      "ASPIRIN",
      "MORPHINE",
      "PREDNISONE"
    ],
    "explanation": "Ibuprofen inhibits COX enzymes; avoid it in renal impairment and late pregnancy."
  },
  {
    "id": "hunt-30",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which term means a life-threatening response to infection?",
    "answer": "SEPSIS",
    "decoys": [
      "SHOCK",
      "STROKE",
      "EDEMA"
    ],
    "explanation": "Sepsis is organ dysfunction from a dysregulated host response to infection; lactate and vitals guide resuscitation."
  },
  {
    "id": "hunt-31",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which infection causes fever, cough and a lobar infiltrate?",
    "answer": "PNEUMONIA",
    "decoys": [
      "BRONCHITIS",
      "ASTHMA",
      "PLEURISY"
    ],
    "explanation": "Pneumonia fills the alveoli with exudate, producing consolidation on imaging."
  },
  {
    "id": "hunt-32",
    "category": "Respiratory",
    "difficulty": 1,
    "question": "Which condition causes reversible wheeze and airway inflammation?",
    "answer": "ASTHMA",
    "decoys": [
      "EMPHYSEMA",
      "BRONCHITIS",
      "PNEUMONIA"
    ],
    "explanation": "Asthma is chronic airway inflammation with bronchoconstriction; albuterol and steroids are the mainstays."
  },
  {
    "id": "hunt-33",
    "category": "Emergency",
    "difficulty": 1,
    "question": "Which emergency causes sudden focal neurological deficit?",
    "answer": "STROKE",
    "decoys": [
      "SYNCOPE",
      "SEIZURE",
      "MIGRAINE"
    ],
    "explanation": "Stroke is sudden loss of perfusion or bleeding in the brain; record the last known well time for thrombolysis."
  },
  {
    "id": "hunt-34",
    "category": "Emergency",
    "difficulty": 2,
    "question": "Which state is inadequate tissue perfusion with low blood pressure?",
    "answer": "SHOCK",
    "decoys": [
      "SEPSIS",
      "SYNCOPE",
      "EDEMA"
    ],
    "explanation": "Shock is a failure of perfusion; mean arterial pressure, lactate and mentation guide treatment."
  },
  {
    "id": "hunt-35",
    "category": "Labs",
    "difficulty": 1,
    "question": "Which condition is a low hemoglobin or hematocrit?",
    "answer": "ANEMIA",
    "decoys": [
      "LEUKEMIA",
      "JAUNDICE",
      "EDEMA"
    ],
    "explanation": "Anemia reduces oxygen carrying capacity; iron studies and reticulocytes point to the cause."
  },
  {
    "id": "hunt-36",
    "category": "Terminology",
    "difficulty": 1,
    "question": "Which finding is yellowing of skin and sclera?",
    "answer": "JAUNDICE",
    "decoys": [
      "CYANOSIS",
      "PALLOR",
      "ERYTHEMA"
    ],
    "explanation": "Jaundice reflects hyperbilirubinemia; the direct versus indirect pattern narrows the cause."
  },
  {
    "id": "hunt-37",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which symptom is coughing up blood?",
    "answer": "HEMOPTYSIS",
    "decoys": [
      "EPISTAXIS",
      "HEMATURIA",
      "MELENA"
    ],
    "explanation": "Hemoptysis comes from the airway or lungs; massive bleeding threatens the airway."
  },
  {
    "id": "hunt-38",
    "category": "Terminology",
    "difficulty": 1,
    "question": "Which term means a nosebleed?",
    "answer": "EPISTAXIS",
    "decoys": [
      "HEMOPTYSIS",
      "HEMATURIA",
      "MELENA"
    ],
    "explanation": "Epistaxis is usually anterior bleeding from Kiesselbach plexus; lean forward and pinch the soft nose."
  },
  {
    "id": "hunt-39",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which term means low urine output?",
    "answer": "OLIGURIA",
    "decoys": [
      "POLYURIA",
      "NOCTURIA",
      "DYSURIA"
    ],
    "explanation": "Oliguria is typically under 400 mL per day in adults; check volume status and obstruction."
  },
  {
    "id": "hunt-40",
    "category": "Terminology",
    "difficulty": 1,
    "question": "Which term means shortness of breath?",
    "answer": "DYSPNEA",
    "decoys": [
      "ORTHOPNEA",
      "APNEA",
      "CYANOSIS"
    ],
    "explanation": "Dyspnea is the subjective sensation of breathlessness; orthopnea is dyspnea when lying flat."
  },
  {
    "id": "hunt-41",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which term means breathlessness when lying flat?",
    "answer": "ORTHOPNEA",
    "decoys": [
      "DYSPNEA",
      "APNEA",
      "BRADYPNEA"
    ],
    "explanation": "Orthopnea suggests pulmonary congestion or diaphragmatic weakness; count how many pillows are needed."
  },
  {
    "id": "hunt-42",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which finding is a blue tint from low oxygen?",
    "answer": "CYANOSIS",
    "decoys": [
      "JAUNDICE",
      "PALLOR",
      "ERYTHEMA"
    ],
    "explanation": "Cyanosis appears when deoxygenated hemoglobin rises; it is a late and unreliable sign."
  },
  {
    "id": "hunt-43",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which rash is raised and itchy with wheals?",
    "answer": "URTICARIA",
    "decoys": [
      "ECZEMA",
      "PSORIASIS",
      "ERYTHEMA"
    ],
    "explanation": "Urticaria is mast cell histamine release; remove the trigger and use antihistamines."
  },
  {
    "id": "hunt-44",
    "category": "Terminology",
    "difficulty": 1,
    "question": "Which term means itching?",
    "answer": "PRURITUS",
    "decoys": [
      "ERYTHEMA",
      "EDEMA",
      "PALLOR"
    ],
    "explanation": "Pruritus is itching and accompanies cholestasis, uremia and dry skin."
  },
  {
    "id": "hunt-45",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which finding is fluid in the peritoneal cavity?",
    "answer": "ASCITES",
    "decoys": [
      "EDEMA",
      "ANASARCA",
      "JAUNDICE"
    ],
    "explanation": "Ascites is peritoneal fluid, often from portal hypertension; paracentesis can relieve pressure."
  },
  {
    "id": "hunt-46",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which process is clot formation inside a vessel?",
    "answer": "THROMBOSIS",
    "decoys": [
      "EMBOLISM",
      "ISCHEMIA",
      "EDEMA"
    ],
    "explanation": "Thrombosis is an in situ clot, while an embolus travels and lodges downstream."
  },
  {
    "id": "hunt-47",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which term is a clot that travels to another site?",
    "answer": "EMBOLISM",
    "decoys": [
      "THROMBOSIS",
      "ISCHEMIA",
      "ANEURYSM"
    ],
    "explanation": "Emboli lodge downstream; pulmonary embolism and stroke are common examples."
  },
  {
    "id": "hunt-48",
    "category": "Terminology",
    "difficulty": 2,
    "question": "Which term is reduced blood flow to tissue?",
    "answer": "ISCHEMIA",
    "decoys": [
      "NECROSIS",
      "INFARCTION",
      "EDEMA"
    ],
    "explanation": "Ischemia is inadequate perfusion; prolonged ischemia becomes infarction."
  },
  {
    "id": "hunt-49",
    "category": "Terminology",
    "difficulty": 3,
    "question": "Which term is irreversible cell death?",
    "answer": "NECROSIS",
    "decoys": [
      "ISCHEMIA",
      "APOPTOSIS",
      "EDEMA"
    ],
    "explanation": "Necrosis is uncontrolled cell death with inflammation, while apoptosis is programmed."
  },
  {
    "id": "hunt-50",
    "category": "Terminology",
    "difficulty": 1,
    "question": "Which finding is excess fluid in tissue?",
    "answer": "EDEMA",
    "decoys": [
      "ASCITES",
      "ERYTHEMA",
      "PALLOR"
    ],
    "explanation": "Edema is interstitial fluid; pitting edema is graded from one to four."
  }
];
