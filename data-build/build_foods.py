#!/usr/bin/env python3
"""Build compact food DB for the app from USDA FoodData Central bulk JSON.
Inputs (download from https://fdc.nal.usda.gov/download-datasets):
  raw/FoodData_Central_foundation_food_json_*.json   (Foundation Foods)
  raw/FoodData_Central_sr_legacy_food_json_2018-04.json (SR Legacy)
Output: ../data/foods.json  — all values per 100 g edible portion.
"""
import json, glob, os, math, re, csv, io
HERE = os.path.dirname(os.path.abspath(__file__))
# app key -> list of candidate USDA nutrient numbers (first found wins) ; special handlers below
MAP = [
 ('kcal',   ['208','958','957']),
 ('protein',['203']),
 ('carbs',  ['205','205.2']),
 ('fibre',  ['291','293']),
 ('sugars', ['269','269.3']),
 ('addedSugar', []),            # not reported in Foundation/SR Legacy
 ('fat',    ['204','298']),
 ('satFat', ['606']),
 ('monoFat',['645']),
 ('polyFat',['646']),
 ('transFat',['605']),
 ('ala',    ['851','619']),     # 18:3 n-3; falls back to undifferentiated 18:3 (mostly ALA)
 ('epa',    ['629']),
 ('dpa',    ['631']),
 ('dha',    ['621']),
 ('omega6', ['675','618']),     # linoleic acid 18:2 n-6; fallback undifferentiated 18:2
 ('cholesterol',['601']),
 ('vitA',   ['320']),           # µg RAE
 ('vitC',   ['401']),
 ('vitD',   ['328','324']),     # µg (IU/40 fallback)
 ('vitE',   ['323']),           # mg alpha-tocopherol
 ('vitK',   ['430']),           # µg phylloquinone (+MK-4 added below)
 ('thiamin',['404']),
 ('riboflavin',['405']),
 ('niacin', ['406']),
 ('pantothenic',['410']),
 ('b6',     ['415']),
 ('biotin', ['416']),
 ('folate', ['435','417']),     # µg DFE (total folate used when DFE absent)
 ('b12',    ['418']),
 ('choline',['421']),
 ('calcium',['301']),
 ('iron',   ['303']),
 ('magnesium',['304']),
 ('phosphorus',['305']),
 ('potassium',['306']),
 ('sodium', ['307']),
 ('zinc',   ['309']),
 ('copper', ['312']),           # mg in USDA; app uses mg
 ('manganese',['315']),
 ('selenium',['317']),
 ('iodine', ['314']),
 ('molybdenum',['316']),
 ('fluoride',['313']),
 ('caffeine',['262']),
 ('alcohol',['221']),
 ('leucine',['504']),
 ('moisture',['255']),          # water contained in food (g)
]
KEYS=[k for k,_ in MAP]

def sig(x, n=3):
    if x is None: return None
    if x == 0: return 0
    r = round(x, -int(math.floor(math.log10(abs(x)))) + (n-1))
    if r == int(r): return int(r)
    return r

def fmt_amt(a):
    if a is None: return '1'
    if abs(a-round(a))<1e-6: return str(int(round(a)))
    fr={0.25:'1/4',0.5:'1/2',0.75:'3/4',0.333:'1/3',0.33:'1/3',0.667:'2/3',0.125:'1/8'}
    for k,v in fr.items():
        if abs(a-k)<0.01: return v
    return ('%g'%a)

VOL={'cup':236.6,'tbsp':14.79,'tablespoon':14.79,'tsp':4.93,'teaspoon':4.93,'fl oz':29.57,'ml':1.0,'liter':1000.0,'l':1000.0}

def portions(f):
    out=[]; dens=None
    for p in f.get('foodPortions') or []:
        g=p.get('gramWeight')
        if not g or g<=0: continue
        unit=(p.get('measureUnit') or {}).get('name') or ''
        mod=(p.get('modifier') or '').strip()
        amt=p.get('amount') if p.get('amount') is not None else p.get('value')
        if unit=='RACC':
            label='1 serving (RACC)'
        elif unit in ('undetermined',''):
            label=(fmt_amt(amt)+' '+mod).strip()
        else:
            label=(fmt_amt(amt)+' '+unit+(' '+mod if mod else '')).strip()
        label=re.sub(r'\s+',' ',label)
        # density from volume portions
        txt=(unit+' '+mod).lower()
        if dens is None and amt:
            for vk,ml in VOL.items():
                if re.match(r'^(%s)\b'%re.escape(vk), txt.strip()) or (unit in ('undetermined','') and re.match(r'^(%s)\b'%re.escape(vk), mod.lower())):
                    # avoid chopped/sliced solids skewing density only slightly matters; accept
                    dens=g/(amt*ml); break
        if not any(o[0]==label for o in out):
            out.append([label[:60], sig(g,4)])
    return out[:8], (sig(dens,3) if dens else None)

BEV_FNDDS={'Coffee','Tea','Fruit drinks','Soft drinks','Diet soft drinks','Sport and energy drinks','Diet sport and energy drinks','Other diet drinks',
  'Flavored or carbonated water','Tap water','Enhanced water','Bottled water','Milk, whole','Milk, reduced fat','Milk, lowfat','Milk, nonfat','Flavored milk, whole',
  'Flavored milk, reduced fat','Flavored milk, lowfat','Flavored milk, nonfat','Plant-based milk','Citrus juice','Apple juice','Other fruit juice','Vegetable juice',
  'Smoothies and grain drinks','Milk shakes and other dairy drinks','Nutritional beverages','Beer','Wine','Liquor and cocktails'}
BEV_RE=re.compile(r'^(milk|beverages?|water|tea|coffee|juice|soymilk|almond milk|oat milk|soy milk|kefir|lemonade|soda|cola|carbonated)\b|\bjuice\b|\bmilk, (whole|lowfat|nonfat|reduced|skim|partly|1%|2%|3\.25%|fluid)|\bbeverage\b|\bdrink\b', re.I)
NOT_BEV=re.compile(r'powder|\bdry\b|dehydrated|concentrate|mix, |instant, (dry|powder)|unprepared|crystals|granules|evaporated|condensed|ice cream|frozen dessert', re.I)

def hydflag(name, cat, alc, src):
    if alc and alc > 1.0: return 0          # alcoholic drinks don't count toward hydration
    if NOT_BEV.search(name) and not re.search(r'prepared|reconstituted|brewed', name, re.I): return 0
    if src=='N': return 1 if cat in BEV_FNDDS else 0
    if cat in ('Beverages',): return 1
    return 1 if BEV_RE.search(name) else 0

def make_vec(amounts):
    vec=[]
    for k,nums in MAP:
        v=None
        for num in nums:
            if num in amounts:
                v=amounts[num]
                if k=='vitD' and num=='324': v=v/40.0
                break
        if k=='vitK' and v is not None and '428' in amounts: v+=amounts['428']
        if k=='kcal' and v is None and all(x in amounts for x in ('203','204','205')):
            v=4*amounts['203']+9*amounts['204']+4*amounts['205']
        vec.append(sig(v))
    return vec

def fdc_iter(src, fn, key):
    for f in json.load(open(fn))[key]:
        if not f or not f.get('foodNutrients'): continue
        amounts={}
        for n in f['foodNutrients']:
            nn=n.get('nutrient') or {}
            a=n.get('amount')
            if a is None or not nn.get('number'): continue
            amounts[nn['number']]=a
        if src=='N':
            cat=(f.get('wweiaFoodCategory') or {}).get('wweiaFoodCategoryDescription','Other')
            por=[]; dens=None
            for p in f.get('foodPortions') or []:
                g=p.get('gramWeight'); d=(p.get('portionDescription') or '').strip()
                if not g or g<=0 or not d or 'not specified' in d.lower(): continue
                m=re.match(r'^([\d./]+)\s*(fl oz|cup|tbsp|tablespoon|tsp|teaspoon|ml)\b', d.lower())
                if m and dens is None:
                    try:
                        a=eval(m.group(1)) if re.match(r'^[\d./]+$',m.group(1)) else None
                        if a: dens=g/(a*VOL[m.group(2)])
                    except Exception: pass
                if not any(o[0]==d[:60] for o in por): por.append([d[:60], sig(g,4)])
            por=por[:8]; dens=sig(dens,3) if dens else None
        else:
            cat=(f.get('foodCategory') or {}).get('description','Other')
            por,dens=portions(f)
        yield f['fdcId'], f['description'].strip(), cat, amounts, por, dens

def cnf_iter(d):
    def rd(fn):
        raw=open(os.path.join(d,fn),'rb').read()
        for enc in ('utf-8','cp1252'):
            try: return list(csv.DictReader(io.StringIO(raw.decode(enc))))
            except UnicodeDecodeError: pass
    groups={r['FoodGroupID']:r['FoodGroupName'].strip() for r in rd('FOOD GROUP.csv')}
    ncode={r['NutrientID']:r['NutrientCode'] for r in rd('NUTRIENT NAME.csv')}
    meas={r['MeasureID']:r['MeasureDescription'].strip() for r in rd('MEASURE NAME.csv')}
    amts={}
    for r in rd('NUTRIENT AMOUNT.csv'):
        try: amts.setdefault(r['FoodID'],{})[ncode[r['NutrientID']]]=float(r['NutrientValue'])
        except (KeyError,ValueError): pass
    convs={}
    for r in rd('CONVERSION FACTOR.csv'):
        try: convs.setdefault(r['FoodID'],[]).append((meas[r['MeasureID']], float(r['ConversionFactorValue'])*100))
        except (KeyError,ValueError): pass
    for r in rd('FOOD NAME.csv'):
        fid=r['FoodID']; a=amts.get(fid)
        if not a: continue
        por=[]; dens=None
        for lab,g in convs.get(fid,[]):
            if lab.lower() in ('100g','100 g') or g<=0: continue
            m=re.match(r'^(\d+(?:\.\d+)?)\s*ml$', lab.lower().replace(' ',''))
            if m and dens is None: dens=g/float(m.group(1))
            if not any(o[0]==lab[:60] for o in por): por.append([lab[:60], sig(g,4)])
        yield 'cnf'+fid, r['FoodDescription'].strip(), groups.get(r['FoodGroupID'],'Other'), a, por[:8], (sig(dens,3) if dens else None)

SRC_CODE={'F':1,'S':0,'N':2,'C':3}
def build():
    R=os.path.join(HERE,'raw')
    sources=[('F',fdc_iter('F',glob.glob(os.path.join(R,'*foundation_food_json*.json'))[0],'FoundationFoods')),
             ('S',fdc_iter('S',glob.glob(os.path.join(R,'*sr_legacy_food_json*.json'))[0],'SRLegacyFoods')),
             ('N',fdc_iter('N',os.path.join(R,'surveyDownload.json'),'SurveyFoods')),
             ('C',cnf_iter(os.path.join(R,'cnf')))]
    cats=[]; foods=[]; seen=set(); counts={}
    for src,it in sources:
        for fid,name,cat,amounts,por,dens in it:
            vec=make_vec(amounts)
            if vec[0] is None or vec[1] is None: continue
            dkey=re.sub(r'[^a-z0-9]+',' ',name.lower()).strip()
            if dkey in seen: continue
            seen.add(dkey)
            if cat not in cats: cats.append(cat)
            alc=amounts.get('221')
            hyd=hydflag(name,cat,alc,src)
            if hyd and dens is None: dens=1.0
            while vec and vec[-1] is None: vec.pop()
            foods.append([fid, name, cats.index(cat), SRC_CODE[src], vec, por, dens, hyd])
            counts[src]=counts.get(src,0)+1
    out={'v':2,'source':'USDA FoodData Central — Foundation Foods (2026-04), SR Legacy (2018-04), FNDDS 2021-2023 (2024-10); Health Canada Canadian Nutrient File 2015. Values per 100 g.',
         'built':__import__('datetime').date.today().isoformat(),'keys':KEYS,'cats':cats,'srcNames':['USDA SR Legacy','USDA Foundation','USDA FNDDS','Canadian Nutrient File'],'foods':foods}
    p=os.path.join(HERE,'..','data','foods.json')
    json.dump(out,open(p,'w'),separators=(',',':'),ensure_ascii=False)
    print('foods',len(foods),counts,'bytes',os.path.getsize(p), 'hydrating',sum(f[7] for f in foods))
    for i,k in enumerate(KEYS):
        c=sum(1 for f in foods if len(f[4])>i and f[4][i] is not None)
        print(f'{k:12s} {c:5d} {100*c/len(foods):5.1f}%')
if __name__=='__main__': build()
