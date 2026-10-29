/* Built-in meal ideas. Suggestions only: NO nutrition values are included.
   Allergens and diet labels are DERIVED from each meal's listed ingredients using the knowledge table below, never hand-tagged.
   Ingredients are written per serving as "<quantity> <unit> <name>". Anything uncertain (stock, spice blends, injera, granola,
   baked beans, cheese, oats, soy sauce...) withholds the affirmative label and is listed as "unverified".
   Labels describe the listed ingredients only. They are NOT a guarantee that a meal is safe for an allergy: always read real labels. */
(function (root) {
  const UNITS = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', tbsp: 'tbsp', tsp: 'tsp', clove: 'clove', cloves: 'clove', slice: 'slice', slices: 'slice', piece: 'piece', pieces: 'piece', cup: 'cup', cups: 'cup' };
  const KB = [
    { re: /\b(chicken|beef|lamb|mince|minced beef)\b/, tr: ['meat'] },
    { re: /\b(tilapia|salmon|fish)\b/, tr: ['fish'], al: ['fish'] },
    { re: /\beggs?\b/, tr: ['egg'], al: ['egg'] },
    { re: /\b(milk|yoghurt|yogurt|feta|cheese)\b/, tr: ['dairy'], al: ['dairy'] },
    { re: /\bcheese\b/, unsure: ['cheese may be made with animal rennet', ['vegetarian', 'vegan']] },
    { re: /\b(bread|pitta|tortilla|pasta|couscous)\b/, tr: ['gluten'], al: ['gluten'] },
    { re: /\b(bread|pitta|tortilla|pasta)\b/, unsure: ['bread, tortilla and pasta can contain egg, milk or honey', ['vegan', 'dairy-free']] },
    { re: /\boats\b/, al: ['gluten'], tr: ['gluten'] },
    { re: /\binjera\b/, may: ['gluten'], unsure: ['injera is often made with wheat or barley as well as teff', ['gluten-free']] },
    { re: /\bgranola\b/, al: ['gluten'], tr: ['gluten'], may: ['nuts'], unsure: ['granola often contains honey, nuts or milk', ['vegan', 'dairy-free']] },
    { re: /\bsoy sauce\b/, al: ['soy'], may: ['gluten'], unsure: ['soy sauce is usually brewed with wheat', ['gluten-free']] },
    { re: /\btofu\b/, al: ['soy'] },
    { re: /\b(sesame oil|tahini)\b/, al: ['sesame'] },
    { re: /\b(peanut|groundnuts?)\b/, al: ['peanut'] },
    { re: /\b(almonds?|cashews?)\b/, al: ['nuts'] },
    { re: /\bvegetable stock\b/, may: ['celery', 'gluten', 'milk'], unsure: ['stock cubes can contain milk, gluten, celery or animal products', ['vegan', 'vegetarian', 'pescatarian', 'dairy-free', 'gluten-free']] },
    { re: /\bbaked beans\b/, unsure: ['tinned baked beans vary by brand: check the label for gluten and animal-derived additives', ['gluten-free', 'vegan']] },
    { re: /\b(curry spice|berbere spice)\b/, may: ['gluten', 'mustard', 'celery'], unsure: ['spice blends can contain wheat fillers or other allergens', ['gluten-free']] }
  ];
  const PLAIN = /\b(black-eyed peas|onion|chilli pepper|scotch bonnet pepper|bell pepper|vegetable oil|palm oil|olive oil|maize meal|banana|cinnamon|water|tomatoes|cumin|garlic|spinach|mixed fruit|avocado|lemon|rice|ground melon seeds|yam|kale|red lentils|plantain|brown beans|raisins|sweet potato|ginger|chickpeas|carrot|turmeric|broccoli|olives|cucumber|basil|black beans|lime|sweetcorn|lettuce|quinoa|white beans|celery|apple|corn|peanut butter)\b/;

  function parseIng(s) {
    const m = /^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-z]+)?\s+(.+)$/i.exec(String(s).trim());
    if (!m) return { qty: null, unit: '', name: String(s).trim() };
    const q = m[1].includes('/') ? m[1].split('/').reduce((a, b) => a / b) : parseFloat(m[1]);
    const u = m[2] ? UNITS[m[2].toLowerCase()] : '';
    if (m[2] && !u) return { qty: q, unit: '', name: m[2] + ' ' + m[3] };
    return { qty: q, unit: u || '', name: m[3].trim() };
  }
  const names = ings => ings.map(i => parseIng(i).name.toLowerCase());
  const known = n => KB.some(k => k.re.test(n)) || PLAIN.test(n);

  function analyse(ings) {
    const ns = names(ings), tr = new Set(), al = new Set(), may = new Set(), unsure = [], unknown = [];
    ns.forEach(n => {
      if (!known(n)) unknown.push(n);
      KB.forEach(k => { if (!k.re.test(n)) return; (k.tr || []).forEach(x => tr.add(x)); (k.al || []).forEach(x => al.add(x)); (k.may || []).forEach(x => may.add(x)); if (k.unsure) unsure.push({ reason: k.unsure[0], affects: k.unsure[1], item: n }); });
    });
    const blocked = d => unsure.some(u => u.affects.includes(d));
    const ok = {
      vegetarian: !tr.has('meat') && !tr.has('fish'), vegan: !tr.has('meat') && !tr.has('fish') && !tr.has('egg') && !tr.has('dairy') && !tr.has('honey'),
      pescatarian: !tr.has('meat'), 'dairy-free': !tr.has('dairy'), 'gluten-free': !tr.has('gluten')
    };
    const diets = Object.keys(ok).filter(d => ok[d] && !blocked(d));
    const unverified = [...new Set(unsure.map(u => u.item + ': ' + u.reason))];
    return { diets, allergens: [...al], may: [...may].filter(x => !al.has(x)), unverified, unknown };
  }

  const m = (id, name, cuisine, slots, ingredients) => {
    const a = analyse(ingredients);
    return { id, name, cuisine, slots, ingredients, servings: 1, diets: a.diets, allergens: a.allergens, may: a.may, unverified: a.unverified, builtin: true };
  };
  const LIB = [
    m('akara-pap', 'Akara (bean fritters) with pap', 'West African', ['breakfast'], ['60 g black-eyed peas', '30 g onion', '10 g chilli pepper', '15 ml vegetable oil', '50 g maize meal']),
    m('oatmeal', 'Oatmeal with banana & cinnamon', 'International', ['breakfast'], ['40 g rolled oats', '1 banana', '1 tsp cinnamon', '250 ml water']),
    m('shakshuka', 'Shakshuka (eggs in spiced tomato)', 'North African', ['breakfast', 'lunch'], ['2 eggs', '200 g tomatoes', '50 g bell pepper', '40 g onion', '1 tsp cumin', '1 clove garlic']),
    m('veg-omelette', 'Vegetable omelette', 'International', ['breakfast', 'lunch'], ['2 eggs', '50 g spinach', '80 g tomatoes', '30 g onion', '10 ml vegetable oil']),
    m('yogurt-granola', 'Yoghurt with fruit & granola', 'International', ['breakfast', 'snack'], ['150 g yoghurt', '80 g mixed fruit', '30 g granola']),
    m('avocado-toast', 'Avocado on wholegrain toast', 'International', ['breakfast', 'snack'], ['2 slice wholegrain bread', '0.5 avocado', '0.25 lemon']),
    m('jollof-chicken', 'Jollof rice with chicken', 'West African', ['lunch', 'dinner'], ['75 g rice', '150 g tomatoes', '40 g onion', '10 g scotch bonnet pepper', '120 g chicken', '15 ml vegetable oil']),
    m('egusi', 'Egusi soup with greens', 'West African', ['lunch', 'dinner'], ['30 g ground melon seeds', '80 g spinach', '15 ml palm oil', '40 g onion', '100 g beef', '100 g yam']),
    m('ugali-sukuma', 'Ugali with sukuma wiki (kale)', 'East African', ['lunch', 'dinner'], ['80 g maize meal', '100 g kale', '80 g tomatoes', '40 g onion', '10 ml vegetable oil']),
    m('injera-misir', 'Injera with misir wot (red lentils)', 'East African', ['lunch', 'dinner'], ['1 piece injera', '60 g red lentils', '40 g onion', '1 tbsp berbere spice', '1 clove garlic']),
    m('pap-chakalaka', 'Pap with chakalaka & beans', 'Southern African', ['lunch', 'dinner'], ['80 g maize meal', '100 g baked beans', '50 g carrot', '50 g bell pepper', '40 g onion', '1 tsp curry spice']),
    m('bobotie', 'Bobotie with yellow rice', 'Southern African', ['dinner'], ['120 g minced beef', '1 slice bread', '100 ml milk', '1 egg', '1 tsp curry spice', '20 g raisins', '75 g rice']),
    m('groundnut-stew', 'Groundnut (peanut) stew with sweet potato', 'West African', ['lunch', 'dinner'], ['30 g peanut butter', '120 g chicken', '120 g sweet potato', '100 g tomatoes', '5 g ginger', '40 g onion']),
    m('plantain-beans', 'Fried plantain with beans', 'West African', ['lunch', 'dinner'], ['1 plantain', '100 g brown beans', '15 ml palm oil', '30 g onion']),
    m('tilapia-veg', 'Grilled tilapia with vegetables', 'West African', ['lunch', 'dinner'], ['150 g tilapia', '100 g tomatoes', '40 g onion', '50 g bell pepper', '0.25 lemon']),
    m('chickpea-tagine', 'Chickpea & vegetable tagine with couscous', 'North African', ['lunch', 'dinner'], ['100 g chickpeas', '50 g carrot', '100 g tomatoes', '40 g onion', '1 tsp cumin', '60 g couscous']),
    m('lentil-dal', 'Lentil dal with rice', 'South Asian', ['lunch', 'dinner'], ['60 g red lentils', '75 g rice', '40 g onion', '1 clove garlic', '1 tsp turmeric', '80 g tomatoes']),
    m('tofu-stir-fry', 'Tofu & vegetable stir-fry', 'East Asian', ['lunch', 'dinner'], ['120 g tofu', '80 g broccoli', '50 g carrot', '1 tbsp soy sauce', '5 g ginger', '75 g rice', '1 tsp sesame oil']),
    m('greek-salad', 'Greek salad with pitta', 'Mediterranean', ['lunch'], ['100 g cucumber', '120 g tomatoes', '40 g feta cheese', '30 g olives', '1 piece pitta bread', '10 ml olive oil']),
    m('pasta-tomato', 'Pasta with tomato & vegetable sauce', 'Italian', ['lunch', 'dinner'], ['80 g pasta', '150 g tomatoes', '40 g onion', '1 clove garlic', '5 g basil', '10 ml olive oil']),
    m('bean-burrito', 'Bean & rice burrito bowl', 'Mexican', ['lunch', 'dinner'], ['80 g black beans', '75 g rice', '80 g tomatoes', '0.5 avocado', '0.25 lime', '40 g sweetcorn']),
    m('chicken-wrap', 'Chicken & salad wrap', 'International', ['lunch'], ['100 g chicken', '1 tortilla wrap', '30 g lettuce', '60 g tomatoes', '50 g cucumber']),
    m('salmon-quinoa', 'Baked salmon with quinoa & greens', 'International', ['dinner'], ['140 g salmon', '60 g quinoa', '80 g broccoli', '0.25 lemon', '10 ml olive oil']),
    m('veg-soup', 'Vegetable & bean soup', 'International', ['lunch', 'dinner'], ['80 g white beans', '50 g carrot', '30 g celery', '40 g onion', '100 g tomatoes', '250 ml vegetable stock']),
    m('fruit-nuts', 'Fresh fruit & mixed nuts', 'International', ['snack'], ['1 apple', '20 g almonds', '20 g cashews']),
    m('hummus-veg', 'Hummus with vegetable sticks', 'Middle Eastern', ['snack'], ['80 g chickpeas', '15 g tahini', '50 g carrot', '50 g cucumber', '0.25 lemon']),
    m('boiled-eggs', 'Boiled eggs', 'International', ['snack'], ['2 eggs']),
    m('roasted-corn', 'Roasted corn or groundnuts', 'West African', ['snack'], ['1 corn', '30 g groundnuts'])
  ];
  const DIETS = ['vegetarian', 'vegan', 'pescatarian', 'halal', 'gluten-free', 'dairy-free'];
  const has = (list, term) => list.some(x => x.toLowerCase().includes(term.toLowerCase()));

  // Reasons a meal may not suit the user's preferences. Empty = no KNOWN conflict, which is not a promise of safety.
  function conflicts(meal, prefs) {
    const out = [], ing = meal.ingredients || [];
    const a = meal.builtin ? null : analyse(ing);
    const al = (meal.allergens || []).concat(meal.may || [], a ? a.allergens.concat(a.may) : []);
    const dt = meal.builtin ? meal.diets || [] : a.diets, unv = meal.builtin ? meal.unverified || [] : a.unverified;
    (prefs.diets || []).forEach(d => {
      if (d === 'halal') out.push('halal status is not verified');
      else if (!dt.includes(d)) out.push(unv.length ? 'cannot confirm ' + d + ' (unverified ingredients)' : 'not marked ' + d);
    });
    (prefs.allergies || []).forEach(x => { if (has(al, x) || (x.toLowerCase() === 'milk' && has(al, 'dairy')) || has(ing, x) || meal.name.toLowerCase().includes(x.toLowerCase())) out.push('may contain ' + x); });
    (prefs.exclusions || []).forEach(x => { if (has(ing, x) || meal.name.toLowerCase().includes(x.toLowerCase())) out.push('contains ' + x); });
    return out;
  }

  const round = n => Math.round(n * 100) / 100;
  const fmtQty = (q, u) => { if (u === 'g' && q >= 1000) return round(q / 1000) + ' kg'; if (u === 'ml' && q >= 1000) return round(q / 1000) + ' l'; return round(q) + (u ? ' ' + u : ''); };
  const stem = n => n.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(es|s)$/, '');
  // entries: [{ meal, portions }]. Combines matching ingredients (same name and unit) across meals, scaled by portions.
  function aggregate(entries) {
    const map = new Map();
    entries.forEach(({ meal, portions }) => {
      const f = portions / (meal.servings > 0 ? meal.servings : 1);
      (meal.ingredients || []).forEach(s => {
        const p = parseIng(s), unit = p.qty == null ? '' : p.unit, key = stem(p.name) + '|' + unit;
        const e = map.get(key) || { key, name: p.name, unit, qty: p.qty == null ? null : 0, sources: [] };
        if (p.qty != null) e.qty += p.qty * f;
        if (!e.sources.includes(meal.name)) e.sources.push(meal.name);
        map.set(key, e);
      });
    });
    return [...map.values()].map(e => Object.assign(e, { text: e.qty == null ? e.name : (e.unit ? fmtQty(e.qty, e.unit) : String(round(e.qty))) + ' ' + e.name }));
  }
  root.LBMeals = { LIB, DIETS, conflicts, analyse, parseIng, aggregate, fmtQty };
  if (typeof module !== 'undefined') module.exports = root.LBMeals;
})(typeof window !== 'undefined' ? window : globalThis);
