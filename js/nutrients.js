/* Fuel — nutrient definitions, evidence-based targets and info sheets.
   Units are display units. `dbMult` converts the USDA DB unit (per 100 g) to the display unit.
   Baseline = NASEM Dietary Reference Intakes (RDA or AI) for the profile's age & sex (driFor; default male 19–30), which Health Canada adopts.
              driFor() below swaps in the NASEM values for other age/sex groups (reviewed v1.3, see README 'Target review').
   Peak    = higher target ONLY where research supports it; otherwise identical to baseline (peakNote explains).
   UL      = Tolerable Upper Intake Level (NASEM) unless noted.                                      */
(function (G) {
  const SRC = {
    DRI: 'NASEM Dietary Reference Intakes for your age & sex (default: males 19–30), adopted by Health Canada',
    DRI_E: 'NASEM DRI: Energy (2023) & Macronutrients (2005) — AMDR',
    DRI_NAK: 'NASEM DRI for Sodium and Potassium (2019)',
    DRI_W: 'NASEM DRI for Water, Potassium, Sodium, Chloride & Sulfate (2005)',
    ISSN_P: 'ISSN Position Stand: Protein and Exercise (Jäger et al., 2017)',
    HELMS: 'Helms et al. 2014, JISSN — protein 2.3–3.1 g/kg lean mass in energy deficit',
    MORTON: 'Morton et al. 2018, Br J Sports Med meta-analysis (protein & resistance training)',
    MSJ: 'Mifflin–St Jeor equation (Mifflin et al., 1990)',
    GARTHE: 'Garthe et al. 2011 — slower weight loss (~0.7%/wk) preserved lean mass in athletes',
    ACSM_NUT: 'ACSM/AND/DC Joint Position: Nutrition & Athletic Performance (Thomas et al., 2016)',
    ACSM_FLUID: 'ACSM Position Stand: Exercise and Fluid Replacement (Sawka et al., 2007)',
    DGA: 'Dietary Guidelines for Americans 2020–2025',
    WHO_SFA: 'WHO guideline: saturated & trans fatty acid intake (2023)',
    WHO_SUG: 'WHO guideline: sugars intake for adults (2015)',
    CFG: "Canada's Food Guide (2019) / Health Canada",
    HC_CAF: 'Health Canada — caffeine in food (max 400 mg/day for healthy adults)',
    CCSA: "Canada's Guidance on Alcohol and Health (CCSA, 2023)",
    REYNOLDS: 'Reynolds et al. 2019, The Lancet — carbohydrate quality & health',
    EFSA_O3: 'EFSA Dietary Reference Values for fats (2010) — EPA+DHA AI 250 mg/d',
    FAO_O3: 'FAO/WHO Expert Consultation on Fats & Fatty Acids (2010)',
    AHA_O3: 'American Heart Association (Kris-Etherton et al., 2002; Siscovick et al., 2017)',
    FDA_O3: 'US FDA — up to 3 g/day EPA+DHA considered safe',
    PHILPOTT: 'Philpott et al. 2019 — omega-3 & sports performance/recovery review',
    LEVINE: 'Levine et al. 1996, PNAS — vitamin C tissue saturation near 200 mg/day',
    ENDO11: 'Endocrine Society guideline (Holick et al., 2011) — 1500–2000 IU/d to keep 25(OH)D > 75 nmol/L',
    ENDO24: 'Endocrine Society guideline (Demay et al., 2024) — no routine high-dose D for healthy adults < 75 y',
    NIELSEN: 'Nielsen & Lukaski 2006, Magnesium Research — strenuous exercise may raise Mg needs 10–20%',
    IOM_K05: 'IOM 2005 potassium AI (4700 mg) & DASH trials; WHO 2012 recommends ≥ 3510 mg/day',
    ISSN_LEU: 'ISSN Position Stand (Jäger et al., 2017) — 700–3000 mg leucine per meal',
    PAULSEN: 'Paulsen et al. 2014 — high-dose vitamins C & E blunted training adaptations',
    IOM_CAD: 'IOM/NASEM 2011 DRI for Calcium & Vitamin D — RDA 15 µg (600 IU) set assuming minimal sun exposure',
    ISSN_CR: 'ISSN Position Stand: safety and efficacy of creatine supplementation (Kreider et al., 2017, JISSN)',
    AVG_CR: 'Avgerinos et al. 2018, Experimental Gerontology — creatine and cognitive function (systematic review)',
    ACSM_CHO: 'ACSM/AND/DC 2016 (Thomas et al.) — carbs 3–5 g/kg/day light training, 5–7 g/kg moderate (~1 h/day), 6–10 g/kg high volume',
  };

  // helper: kg from lb
  const kg = lb => lb * 0.45359237;

  const N = [
    // ---------- Energy & macros ----------
    { key:'kcal', name:'Calories', short:'Cal', unit:'kcal', group:'macro', dp:0, color:'#ff7a59', type:'energy',
      why:'Energy balance drives fat loss. A moderate deficit strips fat while protein + lifting protect muscle. Too aggressive a cut costs strength, mood, sleep and muscle.',
      src:[SRC.MSJ, SRC.GARTHE, SRC.HELMS], foods:'—', peakNote:'Your energy goal is calculated from your profile: Mifflin–St Jeor BMR × activity, minus a deficit sized to your chosen weekly loss rate (capped at 25% of TDEE).' },
    { key:'protein', name:'Protein', short:'Protein', unit:'g', group:'macro', dp:0, color:'#4fd1c5', type:'target',
      why:'Builds and repairs muscle. During a cut, high protein is the #1 dietary lever for keeping (even building) muscle while losing fat, and it keeps you full.',
      src:[SRC.DRI, SRC.ISSN_P, SRC.HELMS, SRC.MORTON], foods:'Chicken breast, Greek yogurt, eggs & egg whites, lean beef, fish, cottage cheese, whey, tofu/tempeh, lentils',
      peakNote:'Baseline = RDA 0.8 g/kg. Peak = your 170 g goal (≈2.2 g/kg at 170 lb), inside the ISSN 1.4–2.0+ g/kg range and Helms 2.3–3.1 g/kg lean mass for lean athletes in a deficit.' },
    { key:'carbs', name:'Carbohydrates', short:'Carbs', unit:'g', group:'macro', dp:0, color:'#f6ad55', type:'target',
      why:'Primary fuel for hard training. Enough carbs keeps workouts strong, glycogen stocked and muscles looking full. Fibre-rich carb sources also support gut and heart health.',
      src:[SRC.DRI, SRC.ACSM_CHO, SRC.REYNOLDS], foods:'Oats, rice, potatoes, fruit, beans & lentils, whole-grain bread & pasta, quinoa',
      peakNote:'Baseline = RDA 130 g (brain glucose). Peak = whatever energy remains after protein and fat. For reference, ACSM suggests 3–5 g/kg/day for light or skill-based training and 5–7 g/kg/day for ~1 h/day of moderate training; during a fat-loss phase carbs usually land below that, so put them around workouts.' },
    { key:'fibre', name:'Fibre', short:'Fibre', unit:'g', group:'macro', dp:0, color:'#68d391', type:'target', ul:null,
      why:'Feeds your gut microbiome, steadies blood sugar, lowers LDL cholesterol, keeps you full on a cut. Higher intakes are linked to lower mortality, heart disease and colorectal cancer.',
      src:[SRC.DRI, SRC.REYNOLDS], foods:'Beans & lentils, chia & flax, raspberries, pears, oats, broccoli, artichoke, whole grains, avocado',
      peakNote:'No evidence-based higher target: the AI of 38 g (14 g/1000 kcal) already exceeds the 25–29 g/day where Reynolds 2019 found the biggest risk reductions. Increase gradually with fluids.' },
    { key:'sugars', name:'Total sugars', short:'Sugars', unit:'g', group:'macro', dp:0, color:'#f687b3', type:'track',
      why:'Includes natural sugars in fruit and dairy, which are fine. There is no DRI for total sugars — watch added sugar instead.',
      src:[SRC.DRI], foods:'Fruit, milk, yogurt, juice, sweets', peakNote:'No target — tracked for information only.' },
    { key:'addedSugar', name:'Added sugar', short:'Added sug.', unit:'g', group:'macro', dp:0, color:'#fc8181', type:'limit', lowData:true,
      why:'Added sugars add calories without nutrients and displace better foods. Keep them low, especially while cutting.',
      src:[SRC.DGA, SRC.WHO_SUG], foods:'Soft drinks, candy, desserts, sweetened yogurt, sauces',
      peakNote:'Limit: < 10% of calories (DGA, WHO); WHO adds a conditional < 5% for further benefit. USDA reference foods do not report added sugar — only scanned/custom foods supply it.' },
    { key:'fat', name:'Fat', short:'Fat', unit:'g', group:'macro', dp:0, color:'#b794f4', type:'target',
      why:'Essential for hormones (incl. testosterone), vitamin absorption and cell membranes. Going too low during a cut hurts hormones and wellbeing.',
      src:[SRC.DRI_E, SRC.HELMS], foods:'Olive oil, avocado, nuts & seeds, salmon, eggs',
      peakNote:'Baseline = 20% of calories (AMDR floor). Goal = max(0.35 g/lb goal weight, 25% of calories). Upper AMDR = 35% of calories.' },
    // ---------- Fats ----------
    { key:'satFat', name:'Saturated fat', short:'Sat fat', unit:'g', group:'fat', dp:1, color:'#e9d8fd', type:'limit',
      why:'Replacing saturated fat with unsaturated fat lowers LDL cholesterol and heart-disease risk.',
      src:[SRC.DGA, SRC.WHO_SFA], foods:'Butter, cheese, fatty red meat, coconut oil, pastries', peakNote:'Limit: < 10% of calories.' },
    { key:'monoFat', name:'Monounsaturated fat', short:'MUFA', unit:'g', group:'fat', dp:1, color:'#d6bcfa', type:'track',
      why:'Heart-healthy fat (olive oil, avocado, nuts). No separate DRI.', src:[SRC.DRI_E], foods:'Olive oil, avocado, almonds, cashews', peakNote:'No target — tracked for information.' },
    { key:'polyFat', name:'Polyunsaturated fat', short:'PUFA', unit:'g', group:'fat', dp:1, color:'#b794f4', type:'track',
      why:'Includes essential omega-3 and omega-6 fats. Replacing saturated fat with PUFA lowers cardiovascular risk.', src:[SRC.DRI_E], foods:'Walnuts, sunflower seeds, fish, canola & soybean oil', peakNote:'No target beyond its omega-3/omega-6 parts.' },
    { key:'transFat', name:'Trans fat', short:'Trans', unit:'g', group:'fat', dp:1, color:'#feb2b2', type:'limit',
      why:'Industrial trans fat raises LDL and lowers HDL — the most harmful dietary fat. Small natural amounts occur in dairy and beef.',
      src:[SRC.DRI_E, SRC.WHO_SFA], foods:'Old-style shortening & fried foods (banned in Canada since 2018)', peakNote:'Limit: as low as possible; WHO < 1% of calories.' },
    { key:'ala', name:'Omega-3 ALA', short:'ALA', unit:'g', group:'fat', dp:2, color:'#63b3ed', type:'target', ul:null,
      why:'The essential plant omega-3. Your body converts only a little to EPA/DHA, so aim for both.',
      src:[SRC.DRI], foods:'Flaxseed, chia, walnuts, hemp seeds, canola oil', peakNote:'No evidence for a higher athletic target; AI = 1.6 g/day.' },
    { key:'epaDha', name:'Omega-3 EPA + DHA', short:'Omega-3', unit:'mg', group:'fat', dp:0, color:'#4299e1', type:'target', derived:true,
      why:'Marine omega-3s support heart, brain and eye health, may reduce exercise soreness and inflammation, and may help muscle protein synthesis.',
      src:[SRC.EFSA_O3, SRC.FAO_O3, SRC.AHA_O3, SRC.PHILPOTT, SRC.FDA_O3], foods:'Salmon, sardines, mackerel, trout, herring, anchovies, fish/algae oil',
      peakNote:'No NASEM DRI. Baseline 250 mg (EFSA/FAO-WHO ≈ 2 fatty-fish meals/week). Peak 1000 mg: AHA cardioprotective dose and the low end used in sports-recovery studies (moderate evidence). Up to 3 g/day considered safe (FDA).' },
    { key:'epa', name:'EPA', short:'EPA', unit:'mg', group:'fat', dp:0, color:'#4299e1', type:'track', dbMult:1000, src:[SRC.FAO_O3], why:'Marine omega-3 (see EPA + DHA).', foods:'Fatty fish, fish oil', peakNote:'Tracked as part of EPA + DHA.' },
    { key:'dha', name:'DHA', short:'DHA', unit:'mg', group:'fat', dp:0, color:'#3182ce', type:'track', dbMult:1000, src:[SRC.FAO_O3], why:'Marine omega-3, concentrated in brain and retina (see EPA + DHA).', foods:'Fatty fish, algae oil', peakNote:'Tracked as part of EPA + DHA.' },
    { key:'dpa', name:'DPA', short:'DPA', unit:'mg', group:'fat', dp:0, color:'#2b6cb0', type:'track', dbMult:1000, src:[SRC.FAO_O3], why:'Minor marine omega-3; not counted toward the EPA + DHA target.', foods:'Fatty fish, seal (Arctic foods)', peakNote:'No target.' },
    { key:'omega6', name:'Omega-6 (linoleic acid)', short:'Omega-6', unit:'g', group:'fat', dp:1, color:'#9f7aea', type:'target', ul:null,
      why:'Essential fat; replacing saturated fat with linoleic acid is linked to lower heart-disease risk.', src:[SRC.DRI], foods:'Sunflower & soybean oil, walnuts, sunflower/pumpkin seeds, chicken', peakNote:'No evidence for a higher target; AI = 17 g/day (AMDR 5–10% of calories).' },
    { key:'cholesterol', name:'Cholesterol', short:'Chol.', unit:'mg', group:'fat', dp:0, color:'#fbd38d', type:'track',
      why:'Dietary cholesterol has a modest effect on blood cholesterol for most people. The old 300 mg cap was dropped; eggs fit a healthy diet.', src:[SRC.DRI_E, SRC.DGA], foods:'Eggs, shellfish, organ meats', peakNote:'No DRI or UL — "as low as practical within a healthy pattern" (NASEM). Tracked only.' },
    // ---------- Vitamins ----------
    { key:'vitA', name:'Vitamin A', short:'Vit A', unit:'µg', group:'vitamin', dp:0, color:'#f6e05e', type:'target', base:900, ul:3000, ulNote:'UL 3000 µg applies to preformed vitamin A (retinol: liver, fish-liver oil, supplements), not to beta-carotene, so food totals in RAE are not compared with it.',
      why:'Vision, immunity, skin and cell growth.', src:[SRC.DRI], foods:'Sweet potato, carrots, spinach, kale, liver, eggs, cantaloupe',
      peakNote:'No evidence for a higher target. RAE. UL 3000 µg applies to preformed retinol (liver, supplements), not beta-carotene.' },
    { key:'vitC', name:'Vitamin C', short:'Vit C', unit:'mg', group:'vitamin', dp:0, color:'#fbd38d', type:'target', base:90, peak:200, ul:2000,
      why:'Collagen for tendons & skin, immunity, iron absorption, antioxidant.', src:[SRC.DRI, SRC.LEVINE, SRC.PAULSEN], foods:'Red peppers, kiwi, oranges, strawberries, broccoli, Brussels sprouts',
      peakNote:'Peak 200 mg ≈ intake where plasma & tissue levels saturate (Levine 1996); easy from food. Avoid mega-dose (≥1 g) supplements around training — may blunt adaptations.' },
    { key:'vitD', name:'Vitamin D', short:'Vit D', unit:'µg', group:'vitamin', dp:1, color:'#f6ad55', type:'target', base:15, peak:250, ul:100, lowData:false,
      userGoal:true, ulInfo:true, iu:40, baseLbl:'RDA (600 IU)', peakLbl:'your goal',
      ulInfoNote:'Your goal is above the NASEM upper limit (4,000 IU); consider monitoring blood 25(OH)D with a doctor.',
      why:'Bone health, muscle function and immunity. In PEI (~46°N) the sun is too weak to make vitamin D from about October to March.',
      src:[SRC.DRI, SRC.IOM_CAD, SRC.ENDO24, SRC.ENDO11], foods:'Salmon, trout, sardines, fortified milk & plant milks (Canadian milk is fortified), egg yolks, UV-exposed mushrooms; supplements',
      peakNote:'Your goal: 250 µg (10,000 IU) a day — your own setting (change it under Customise below). Baseline = RDA 15 µg (600 IU), which NASEM set assuming minimal sun, and it is what the daily score and "micros at baseline" use. The NASEM Tolerable Upper Intake Level of 100 µg (4,000 IU) is shown for information only: going above it does not trigger a warning or lower your score. For context, the Endocrine Society 2024 guideline does not recommend routine doses above the DRI for healthy adults under 75. 1 µg = 40 IU.' },
    { key:'vitE', name:'Vitamin E', short:'Vit E', unit:'mg', group:'vitamin', dp:1, color:'#f6e05e', type:'target', base:15, ul:1000, ulNote:'UL 1000 mg applies to supplemental α-tocopherol only.',
      why:'Antioxidant protecting cell membranes.', src:[SRC.DRI, SRC.PAULSEN], foods:'Sunflower seeds, almonds, hazelnuts, avocado, spinach, olive oil',
      peakNote:'No evidence for higher; high-dose supplements may blunt training adaptations. UL applies to supplements (α-tocopherol).' },
    { key:'vitK', name:'Vitamin K', short:'Vit K', unit:'µg', group:'vitamin', dp:0, color:'#9ae6b4', type:'target', base:120,
      why:'Blood clotting and bone health.', src:[SRC.DRI], foods:'Kale, spinach, collards, broccoli, Brussels sprouts, natto', peakNote:'No evidence for a higher target; no UL set.' },
    { key:'thiamin', name:'Thiamin (B1)', short:'B1', unit:'mg', group:'vitamin', dp:2, color:'#90cdf4', type:'target', base:1.2,
      why:'Turns carbohydrate into energy; nerve function.', src:[SRC.DRI], foods:'Pork, whole grains, fortified cereals, beans, sunflower seeds', peakNote:'No evidence for a higher target; no UL.' },
    { key:'riboflavin', name:'Riboflavin (B2)', short:'B2', unit:'mg', group:'vitamin', dp:2, color:'#90cdf4', type:'target', base:1.3,
      why:'Energy metabolism and antioxidant recycling.', src:[SRC.DRI], foods:'Milk, yogurt, eggs, lean meat, almonds, mushrooms', peakNote:'No evidence for a higher target; no UL.' },
    { key:'niacin', name:'Niacin (B3)', short:'B3', unit:'mg', group:'vitamin', dp:1, color:'#90cdf4', type:'target', base:16, ul:35, ulNote:'UL 35 mg applies to niacin from supplements & fortified foods only — food niacin (meat, fish) routinely exceeds it safely.',
      why:'Energy metabolism, DNA repair.', src:[SRC.DRI], foods:'Chicken, tuna, salmon, turkey, peanuts, fortified grains',
      peakNote:'No evidence for higher. Target is niacin equivalents; food data lists preformed niacin only, so true intake is higher (protein tryptophan adds more). UL applies to supplements/fortificants.' },
    { key:'pantothenic', name:'Pantothenic acid (B5)', short:'B5', unit:'mg', group:'vitamin', dp:1, color:'#90cdf4', type:'target', base:5,
      why:'Part of coenzyme A — energy and fat metabolism.', src:[SRC.DRI], foods:'Chicken, beef, mushrooms, avocado, eggs, sunflower seeds', peakNote:'No evidence for a higher target (AI).' },
    { key:'b6', name:'Vitamin B6', short:'B6', unit:'mg', group:'vitamin', dp:2, color:'#90cdf4', type:'target', base:1.3, ul:100,
      why:'Protein metabolism, red blood cells, neurotransmitters.', src:[SRC.DRI], foods:'Chickpeas, tuna, salmon, chicken, potatoes, bananas', peakNote:'No evidence for higher. (Health Canada caps supplement products lower due to neuropathy reports.)' },
    { key:'biotin', name:'Biotin (B7)', short:'B7', unit:'µg', group:'vitamin', dp:0, color:'#90cdf4', type:'target', base:30, lowData:true,
      why:'Fat, carbohydrate and amino-acid metabolism.', src:[SRC.DRI], foods:'Eggs, liver, salmon, sunflower seeds, sweet potato',
      peakNote:'No evidence for higher (AI). USDA reports biotin for very few foods, so totals will read low.' },
    { key:'folate', name:'Folate (B9)', short:'Folate', unit:'µg', group:'vitamin', dp:0, color:'#90cdf4', type:'target', base:400, ul:1000, ulNote:'UL 1000 µg applies to folic acid from supplements & fortified foods only, not natural food folate.',
      why:'DNA synthesis, red blood cells, homocysteine control.', src:[SRC.DRI], foods:'Lentils, chickpeas, spinach, asparagus, avocado, fortified grains',
      peakNote:'No evidence for higher. DFE. UL 1000 µg applies to folic acid from supplements/fortified foods.' },
    { key:'b12', name:'Vitamin B12', short:'B12', unit:'µg', group:'vitamin', dp:1, color:'#90cdf4', type:'target', base:2.4,
      why:'Nerves, red blood cells, DNA. Found almost only in animal foods.', src:[SRC.DRI], foods:'Clams, salmon, tuna, beef, dairy, eggs, fortified plant milks', peakNote:'No evidence for higher; no UL.' },
    { key:'choline', name:'Choline', short:'Choline', unit:'mg', group:'vitamin', dp:0, color:'#a3bffa', type:'target', base:550, ul:3500,
      why:'Cell membranes, liver function, and acetylcholine for muscle control and memory.', src:[SRC.DRI], foods:'Eggs (yolks), beef, chicken, fish, soybeans, Brussels sprouts', peakNote:'No evidence for higher (AI).' },
    // ---------- Minerals ----------
    { key:'calcium', name:'Calcium', short:'Calcium', unit:'mg', group:'mineral', dp:0, color:'#e2e8f0', type:'target', base:1000, ul:2500,
      why:'Bones, muscle contraction, nerve signalling.', src:[SRC.DRI], foods:'Milk, yogurt, cheese, fortified plant milk, tofu (set with calcium), sardines, kale', peakNote:'No evidence for a higher target.' },
    { key:'iron', name:'Iron', short:'Iron', unit:'mg', group:'mineral', dp:1, color:'#feb2b2', type:'target', base:8, ul:45,
      why:'Carries oxygen in blood and muscle — key for endurance.', src:[SRC.DRI], foods:'Beef, mussels, oysters, lentils, spinach, fortified cereal (pair plants with vitamin C)',
      peakNote:'No evidence for higher in men; excess iron can be harmful, so don\'t supplement unless blood work shows low ferritin.' },
    { key:'magnesium', name:'Magnesium', short:'Magnesium', unit:'mg', group:'mineral', dp:0, color:'#81e6d9', type:'target', base:400, peak:450, peakRel:1.125, ul:350, ulNote:'UL 350 mg applies to supplements only (not food).',
      why:'300+ enzyme reactions: energy production, muscle contraction & relaxation, sleep, blood sugar.', src:[SRC.DRI, SRC.NIELSEN], foods:'Pumpkin seeds, chia, almonds, spinach, black beans, dark chocolate, quinoa',
      peakNote:'Baseline = RDA (400 mg men 19–30, 420 mg 31+). Peak ≈ +12% (450 mg at 19–30): strenuous training increases losses in sweat & urine (Nielsen & Lukaski 2006; moderate evidence). UL is for supplemental magnesium only.' },
    { key:'phosphorus', name:'Phosphorus', short:'Phos.', unit:'mg', group:'mineral', dp:0, color:'#e2e8f0', type:'target', base:700, ul:4000,
      why:'Bones, ATP energy, cell membranes.', src:[SRC.DRI], foods:'Dairy, meat, fish, beans, nuts', peakNote:'No evidence for a higher target.' },
    { key:'potassium', name:'Potassium', short:'Potassium', unit:'mg', group:'mineral', dp:0, color:'#76e4f7', type:'target', base:3400, peak:4700,
      why:'Muscle and nerve function, fluid balance; higher intakes lower blood pressure and blunt the effects of sodium.',
      src:[SRC.DRI_NAK, SRC.IOM_K05], foods:'Potatoes, beans, lentils, bananas, avocado, spinach, yogurt, salmon, squash',
      peakNote:'Baseline = NASEM 2019 AI 3400 mg (men). Peak 4700 mg = the older IOM 2005 AI, which NASEM 2019 replaced for lack of evidence, kept here only as a stretch goal because DASH-style intakes lower blood pressure; WHO recommends ≥ 3510 mg. Moderate evidence; food sources only (no UL from food).' },
    { key:'sodium', name:'Sodium', short:'Sodium', unit:'mg', group:'mineral', dp:0, color:'#fbb6ce', type:'limit', base:1500,
      why:'Needed for fluid balance and muscle contraction (and lost in sweat), but excess raises blood pressure.',
      src:[SRC.DRI_NAK, SRC.ACSM_FLUID], foods:'Salt, processed meats, cheese, bread, sauces, restaurant food',
      peakNote:'Baseline AI 1500 mg. Limit 2300 mg = Chronic Disease Risk Reduction intake. On training days the cap rises by ~500 mg per hour of sweaty training to cover sweat losses (ACSM).' },
    { key:'zinc', name:'Zinc', short:'Zinc', unit:'mg', group:'mineral', dp:1, color:'#cbd5e0', type:'target', base:11, ul:40,
      why:'Immunity, testosterone production, wound healing, protein synthesis.', src:[SRC.DRI], foods:'Oysters, beef, crab, pumpkin seeds, chickpeas, cashews', peakNote:'No evidence for higher; excess zinc blocks copper.' },
    { key:'copper', name:'Copper', short:'Copper', unit:'mg', group:'mineral', dp:2, color:'#f6ad55', type:'target', base:0.9, ul:10,
      why:'Iron metabolism, connective tissue, energy production.', src:[SRC.DRI], foods:'Liver, cashews, sesame, dark chocolate, shellfish, mushrooms', peakNote:'No evidence for a higher target (RDA 900 µg).' },
    { key:'manganese', name:'Manganese', short:'Mn', unit:'mg', group:'mineral', dp:2, color:'#cbd5e0', type:'target', base:2.3, ul:11,
      why:'Bone formation and antioxidant enzymes.', src:[SRC.DRI], foods:'Oats, brown rice, pecans, pineapple, mussels, spinach', peakNote:'No evidence for higher (AI).' },
    { key:'selenium', name:'Selenium', short:'Selenium', unit:'µg', group:'mineral', dp:0, color:'#cbd5e0', type:'target', base:55, ul:400,
      why:'Thyroid hormones and antioxidant defence.', src:[SRC.DRI], foods:'Brazil nuts (1–2 is plenty), tuna, sardines, eggs, chicken', peakNote:'No evidence for higher; the range to the UL is narrow — easy to overdo with Brazil nuts.' },
    { key:'iodine', name:'Iodine', short:'Iodine', unit:'µg', group:'mineral', dp:0, color:'#cbd5e0', type:'target', base:150, ul:1100, lowData:true,
      why:'Thyroid hormones that set metabolic rate.', src:[SRC.DRI], foods:'Iodized salt (Canadian table salt is iodized), seaweed, cod, dairy, eggs',
      peakNote:'No evidence for higher. USDA lists iodine for very few foods, so totals will read low.' },
    { key:'molybdenum', name:'Molybdenum', short:'Mo', unit:'µg', group:'mineral', dp:0, color:'#cbd5e0', type:'target', base:45, ul:2000, lowData:true,
      why:'Cofactor for enzymes that break down amino acids.', src:[SRC.DRI], foods:'Legumes, grains, nuts', peakNote:'No evidence for higher. Sparse food data — deficiency is essentially unknown.' },
    { key:'fluoride', name:'Fluoride', short:'Fluoride', unit:'mg', group:'mineral', dp:2, color:'#cbd5e0', type:'target', base:4, ul:10, lowData:true, dbMult:0.001,
      why:'Strengthens teeth.', src:[SRC.DRI], foods:'Fluoridated tap water, tea, seafood', peakNote:'No evidence for higher (AI). Mostly from tap water, which this app doesn\'t measure — informational.' },
    // ---------- Hydration & other ----------
    { key:'water', name:'Water (fluids)', short:'Water', unit:'ml', group:'other', dp:0, color:'#4fc3f7', type:'target', derived:true,
      why:'Even 2% dehydration reduces strength, endurance and focus. Fluids also come from milk, coffee, tea and other drinks.',
      src:[SRC.DRI_W, SRC.ACSM_FLUID], foods:'Water, milk, tea, coffee, soups, fruit',
      peakNote:'Baseline = NASEM AI of 3.7 L total water, ~3.0 L of it from drinks. Peak = 35 ml/kg body weight + activity, + ~700 ml per hour on training days (ACSM sweat-replacement guidance).' },
    { key:'caffeine', name:'Caffeine', short:'Caffeine', unit:'mg', group:'other', dp:0, color:'#c69c72', type:'limit',
      why:'A proven ergogenic aid (3–6 mg/kg ~60 min pre-workout) but too much — or too late in the day — hurts sleep and recovery.', src:[SRC.HC_CAF], foods:'Coffee, energy drinks, pre-workout, tea, cola', peakNote:'Limit 400 mg/day (Health Canada). Supplements/pre-workouts must be added as custom foods.' },
    { key:'alcohol', name:'Alcohol', short:'Alcohol', unit:'g', group:'other', dp:0, color:'#fc8181', type:'track',
      why:'Alcohol adds 7 kcal/g, impairs muscle protein synthesis and sleep, and raises cancer risk at any dose.', src:[SRC.CCSA], foods:'Beer, wine, spirits', peakNote:"No safe target. Canada's 2023 guidance: ≤ 2 standard drinks (13.45 g each) per WEEK is low risk." },
    { key:'leucine', name:'Leucine', short:'Leucine', unit:'g', group:'other', dp:1, color:'#81e6d9', type:'track',
      why:'The amino acid that switches on muscle protein synthesis. Spreading ~2–3 g across 3–5 protein feedings per day is ideal.', src:[SRC.ISSN_LEU], foods:'Whey, chicken, beef, eggs, Greek yogurt, soy', peakNote:'No daily target — aim for ~2–3 g per meal.' },
    { key:'creatine', name:'Creatine', short:'Creatine', unit:'g', group:'other', dp:1, color:'#a3bffa', type:'target', base:3, peak:10, userGoal:true,
      baseLbl:'ISSN maintenance', peakLbl:'your goal',
      why:'The most-studied sports supplement. Topping up muscle creatine stores improves strength and power in repeated hard efforts and increases lean mass gains with resistance training; evidence for cognitive benefits (especially when sleep-deprived or in older adults) is promising but less certain.',
      src:[SRC.ISSN_CR, SRC.AVG_CR], foods:'Creatine monohydrate supplement (1 scoop = 5 g). Red meat and fish contain roughly 1–2 g per 450 g raw, but the USDA and Canadian Nutrient File data bundled here have no creatine values, so only supplements and labels you enter count.',
      peakNote:'Your goal: 10 g a day (change it under Customise below). ISSN position stand (Kreider et al. 2017): 3–5 g/day maintenance, optionally after a loading phase of ~20 g/day (4 × 5 g) for 5–7 days. Doses of 10 g/day and higher have been used safely in studies (the ISSN reports up to 30 g/day for 5 years in healthy people). Take it any time of day, with plenty of fluid.' },
    { key:'moisture', name:'Water in food', short:'Food water', unit:'g', group:'other', dp:0, color:'#90cdf4', type:'track',
      why:'Food supplies roughly 20% of total water intake. Shown for information; only drinks count toward your fluid goal.', src:[SRC.DRI_W], foods:'Fruit, vegetables, soups, yogurt', peakNote:'No target.' },
  ];

  const BY = {}; N.forEach(n => { BY[n.key] = n; if (n.dbMult == null) n.dbMult = 1; });
  const GROUPS = [['macro','Energy & macros'],['fat','Fats & omegas'],['vitamin','Vitamins'],['mineral','Minerals'],['other','Hydration & other']];
  // micronutrients used for score / "all micros at baseline" (excludes sparse-data ones)
  const MICROS = N.filter(n => (n.group==='vitamin'||n.group==='mineral') && n.type==='target' && !n.lowData).map(n=>n.key);
  const VITAMINS = MICROS.filter(k => BY[k].group==='vitamin');
  const MINERALS = MICROS.filter(k => BY[k].group==='mineral');

  const ACTIVITY = {
    sedentary:{ mult:1.2,  label:'Sedentary (desk, little exercise)', water:0 },
    light:    { mult:1.375,label:'Light (1–3 workouts/wk)', water:250 },
    moderate: { mult:1.55, label:'Moderate (3–5 workouts/wk)', water:500 },
    very:     { mult:1.725,label:'Very active (6–7 hard sessions/wk)', water:750 },
    athlete:  { mult:1.9,  label:'Athlete (2-a-days / physical job)', water:1000 },
  };

  /* NASEM DRI values that differ from the male 19–30 defaults in N (RDA/AI; '<key>UL' = UL). Used by computeTargets so the
     sex/age in the profile actually change the micronutrient targets (before v1.3 every profile got male 19–30 values).
     Source: NASEM DRI summary tables (Vitamins, Elements, Macronutrients, Water/Electrolytes; Sodium & Potassium 2019). */
  function driFor(p) {
    const a = +p.age || 30, o = {};
    if (p.sex !== 'female') {
      if (a >= 31) o.magnesium = 420;
      if (a >= 51) Object.assign(o, { fibre: 30, b6: 1.7, omega6: 14, calciumUL: 2000 });
      if (a >= 71) Object.assign(o, { calcium: 1200, vitD: 20, phosphorusUL: 3000 });
    } else {
      Object.assign(o, { vitA: 700, vitC: 75, vitK: 90, thiamin: 1.1, riboflavin: 1.1, niacin: 14, choline: 425, iron: 18, magnesium: a >= 31 ? 320 : 310,
        potassium: 2600, zinc: 8, manganese: 1.8, fluoride: 3, fibre: 25, ala: 1.1, omega6: 12, water: 2200 });
      if (a >= 51) Object.assign(o, { iron: 8, fibre: 21, b6: 1.5, omega6: 11, calcium: 1200, calciumUL: 2000 });
      if (a >= 71) Object.assign(o, { vitD: 20, phosphorusUL: 3000 });
    }
    return o;
  }

  function energy(p) {
    const wkg = kg(p.weightLb), hcm = p.heightCm;
    const bmr = 10*wkg + 6.25*hcm - 5*p.age + (p.sex==='female' ? -161 : 5);
    const act = ACTIVITY[p.activity] || ACTIVITY.moderate;
    const tdee = bmr * act.mult;
    let deficit = 0;
    if (p.weightLb > p.goalLb + 0.5) {
      deficit = (p.ratePct/100) * p.weightLb * 3500 / 7;        // ~3500 kcal per lb of tissue
      deficit = Math.min(deficit, tdee * 0.25);
    }
    let kcal = Math.max(tdee - deficit, bmr);                      // never below BMR
    return { bmr, tdee, deficit, kcal, wkg };
  }

  /** Compute all targets: {key:{base, peak, ul, limit, goal, kind}} */
  function computeTargets(p, s, day) {
    const e = energy(p); const dri = driFor(p);
    const training = day && day.training && day.training.on ? (+day.training.hours || 1) : 0;
    const kcal = Math.round(e.kcal / 10) * 10;
    const protein = p.proteinG || 170;
    const fatG = Math.round(Math.max((p.fatPerLb||0.35) * p.goalLb, 0.25 * kcal / 9));
    const carbsG = Math.max(130, Math.round((kcal - protein*4 - fatG*9) / 4));
    const actW = (ACTIVITY[p.activity]||ACTIVITY.moderate).water;
    const waterPeak = Math.round((35 * e.wkg + actW + training*700) / 50) * 50;
    const T = {};
    const set = (k, o) => { T[k] = Object.assign({ base:null, peak:null, ul:null, limit:null }, o); };
    set('kcal', { base:kcal, peak:kcal });
    set('protein', { base: Math.round(0.8 * e.wkg), peak: protein });
    set('carbs', { base:130, peak:carbsG });
    set('fat', { base: Math.round(0.20*kcal/9), peak: fatG, ul: Math.round(0.35*kcal/9), ulSoft:true });
    set('fibre', { base:dri.fibre ?? 38, peak:dri.fibre ?? 38 });
    set('addedSugar', { limit: Math.round(0.10*kcal/4) });
    set('satFat', { limit: Math.round(0.10*kcal/9) });
    set('transFat', { limit: +(0.01*kcal/9).toFixed(1) });
    set('ala', { base:dri.ala ?? 1.6, peak:dri.ala ?? 1.6 });
    set('epaDha', { base:250, peak:1000, ul:3000, ulSoft:true });
    set('omega6', { base:dri.omega6 ?? 17, peak:dri.omega6 ?? 17 });
    set('sodium', { base:1500, limit: 2300 + training*500 });
    set('caffeine', { limit:400 });
    const waterBase = dri.water ?? 3000;   // NASEM AI from beverages: ~3.0 L men, ~2.2 L women (of 3.7 / 2.7 L total water)
    set('water', { base: waterBase + training*700, peak: Math.max(waterBase + training*700, waterPeak) });
    N.forEach(n => {
      if (T[n.key]) { if (T[n.key].ul==null && n.ul) T[n.key].ul=n.ul; return; }
      const base = dri[n.key] ?? n.base ?? null;
      const peak = n.peakRel && base != null ? Math.round(base * n.peakRel / 5) * 5 : Math.max(n.peak ?? base ?? 0, base ?? 0) || null;
      set(n.key, { base, peak, ul: dri[n.key + 'UL'] ?? n.ul ?? null });
    });
    // overrides
    const ov = (s && s.overrides) || {};
    Object.keys(ov).forEach(k => { if (T[k]) Object.keys(ov[k]).forEach(f => { const v = ov[k][f]; if (v!==''&&v!=null&&!isNaN(v)) T[k][f] = +v; }); });
    // goal = tier choice
    const tier = (s && s.tier) || 'peak';
    // userGoal nutrients (vitamin D, creatine): the peak value IS the user's own daily goal, whichever tier the rings aim for
    Object.keys(T).forEach(k => { const t = T[k]; t.goal = t.goalOverride ?? ((tier==='peak' || (BY[k] && BY[k].userGoal)) ? (t.peak ?? t.base) : (t.base ?? t.peak)); });
    if (ov.kcal && ov.kcal.goal) T.kcal.goal = +ov.kcal.goal;
    Object.keys(ov).forEach(k => { if (T[k] && ov[k].goal!=null && ov[k].goal!=='') T[k].goal = +ov[k].goal; });
    T._energy = Object.assign(e, { kcal, protein, fatG, carbsG, training });
    return T;
  }

  G.NUTR = { N, BY, GROUPS, MICROS, VITAMINS, MINERALS, ACTIVITY, SRC, computeTargets, energy, kg, driFor };
})(window);
