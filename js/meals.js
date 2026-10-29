/* Built-in meal ideas. These are suggestions only: NO nutrition values are included.
   Diet tags and allergens are best-effort and must be checked against real ingredients and labels. */
(function (root) {
  const V = ['vegetarian', 'pescatarian'], VG = ['vegan', 'vegetarian', 'pescatarian', 'dairy-free'];
  const m = (id, name, cuisine, slots, diets, allergens, ingredients) => ({ id, name, cuisine, slots, diets, allergens, ingredients, builtin: true });
  const LIB = [
    m('akara-pap', 'Akara (bean fritters) with pap', 'West African', ['breakfast'], [...VG, 'halal', 'gluten-free'], [], ['black-eyed peas', 'onion', 'pepper', 'vegetable oil', 'maize meal']),
    m('oatmeal', 'Oatmeal with banana & cinnamon', 'International', ['breakfast'], [...VG, 'halal'], ['gluten'], ['rolled oats', 'banana', 'cinnamon', 'water']),
    m('shakshuka', 'Shakshuka (eggs in spiced tomato)', 'North African', ['breakfast', 'lunch'], [...V, 'halal', 'gluten-free', 'dairy-free'], ['egg'], ['eggs', 'tomatoes', 'bell pepper', 'onion', 'cumin', 'garlic']),
    m('veg-omelette', 'Vegetable omelette', 'International', ['breakfast', 'lunch'], [...V, 'halal', 'gluten-free', 'dairy-free'], ['egg'], ['eggs', 'spinach', 'tomatoes', 'onion', 'vegetable oil']),
    m('yogurt-granola', 'Yoghurt with fruit & granola', 'International', ['breakfast', 'snack'], [...V, 'halal'], ['dairy', 'gluten'], ['yoghurt', 'mixed fruit', 'granola']),
    m('avocado-toast', 'Avocado on wholegrain toast', 'International', ['breakfast', 'snack'], [...VG, 'halal'], ['gluten'], ['wholegrain bread', 'avocado', 'lemon']),
    m('jollof-chicken', 'Jollof rice with chicken', 'West African', ['lunch', 'dinner'], ['halal', 'gluten-free', 'dairy-free'], [], ['rice', 'tomatoes', 'onion', 'scotch bonnet pepper', 'chicken', 'vegetable oil']),
    m('egusi', 'Egusi soup with greens', 'West African', ['lunch', 'dinner'], ['halal', 'gluten-free', 'dairy-free'], [], ['ground melon seeds', 'spinach', 'palm oil', 'onion', 'beef', 'yam']),
    m('ugali-sukuma', 'Ugali with sukuma wiki (kale)', 'East African', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['maize meal', 'kale', 'tomatoes', 'onion', 'vegetable oil']),
    m('injera-misir', 'Injera with misir wot (red lentils)', 'East African', ['lunch', 'dinner'], [...VG, 'halal'], ['gluten'], ['injera', 'red lentils', 'onion', 'berbere spice', 'garlic']),
    m('pap-chakalaka', 'Pap with chakalaka & beans', 'Southern African', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['maize meal', 'baked beans', 'carrot', 'bell pepper', 'onion', 'curry spice']),
    m('bobotie', 'Bobotie with yellow rice', 'Southern African', ['dinner'], ['halal'], ['egg', 'dairy', 'gluten'], ['minced beef', 'bread', 'milk', 'eggs', 'curry spice', 'raisins', 'rice']),
    m('groundnut-stew', 'Groundnut (peanut) stew with sweet potato', 'West African', ['lunch', 'dinner'], ['halal', 'gluten-free', 'dairy-free'], ['peanut'], ['peanut butter', 'chicken', 'sweet potato', 'tomatoes', 'ginger', 'onion']),
    m('plantain-beans', 'Fried plantain with beans', 'West African', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['plantain', 'brown beans', 'palm oil', 'onion']),
    m('tilapia-veg', 'Grilled tilapia with vegetables', 'West African', ['lunch', 'dinner'], ['pescatarian', 'halal', 'gluten-free', 'dairy-free'], ['fish'], ['tilapia', 'tomatoes', 'onion', 'bell pepper', 'lemon']),
    m('chickpea-tagine', 'Chickpea & vegetable tagine', 'North African', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['chickpeas', 'carrot', 'tomatoes', 'onion', 'cumin', 'couscous']),
    m('lentil-dal', 'Lentil dal with rice', 'South Asian', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['red lentils', 'rice', 'onion', 'garlic', 'turmeric', 'tomatoes']),
    m('tofu-stir-fry', 'Tofu & vegetable stir-fry', 'East Asian', ['lunch', 'dinner'], [...VG, 'halal'], ['soy', 'gluten', 'sesame'], ['tofu', 'broccoli', 'carrot', 'soy sauce', 'ginger', 'rice', 'sesame oil']),
    m('greek-salad', 'Greek salad with pitta', 'Mediterranean', ['lunch'], [...V, 'halal'], ['dairy', 'gluten'], ['cucumber', 'tomatoes', 'feta cheese', 'olives', 'pitta bread', 'olive oil']),
    m('pasta-tomato', 'Pasta with tomato & vegetable sauce', 'Italian', ['lunch', 'dinner'], [...VG, 'halal'], ['gluten'], ['pasta', 'tomatoes', 'onion', 'garlic', 'basil', 'olive oil']),
    m('bean-burrito', 'Bean & rice burrito bowl', 'Mexican', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['black beans', 'rice', 'tomatoes', 'avocado', 'lime', 'sweetcorn']),
    m('chicken-wrap', 'Chicken & salad wrap', 'International', ['lunch'], ['halal', 'dairy-free'], ['gluten'], ['chicken', 'tortilla wrap', 'lettuce', 'tomatoes', 'cucumber']),
    m('salmon-quinoa', 'Baked salmon with quinoa & greens', 'International', ['dinner'], ['pescatarian', 'halal', 'gluten-free', 'dairy-free'], ['fish'], ['salmon', 'quinoa', 'broccoli', 'lemon', 'olive oil']),
    m('veg-soup', 'Vegetable & bean soup', 'International', ['lunch', 'dinner'], [...VG, 'halal', 'gluten-free'], [], ['white beans', 'carrot', 'celery', 'onion', 'tomatoes', 'vegetable stock']),
    m('fruit-nuts', 'Fresh fruit & mixed nuts', 'International', ['snack'], [...VG, 'halal', 'gluten-free'], ['nuts'], ['apple', 'almonds', 'cashews']),
    m('hummus-veg', 'Hummus with vegetable sticks', 'Middle Eastern', ['snack'], [...VG, 'halal', 'gluten-free'], ['sesame'], ['chickpeas', 'tahini', 'carrot', 'cucumber', 'lemon']),
    m('boiled-eggs', 'Boiled eggs', 'International', ['snack'], [...V, 'halal', 'gluten-free', 'dairy-free'], ['egg'], ['eggs']),
    m('roasted-corn', 'Roasted corn or groundnuts', 'West African', ['snack'], [...VG, 'halal', 'gluten-free'], ['peanut'], ['corn', 'groundnuts'])
  ];
  const DIETS = ['vegetarian', 'vegan', 'pescatarian', 'halal', 'gluten-free', 'dairy-free'];
  const has = (list, term) => list.some(x => x.toLowerCase().includes(term.toLowerCase()));
  // Returns the reasons a meal conflicts with the user's preferences (empty = no known conflict).
  function conflicts(meal, prefs) {
    const out = [], ing = meal.ingredients || [], al = meal.allergens || [], dt = meal.diets || [];
    (prefs.diets || []).forEach(d => { if (!dt.includes(d)) out.push('not marked ' + d); });
    (prefs.allergies || []).forEach(a => { if (has(al, a) || has(ing, a) || meal.name.toLowerCase().includes(a.toLowerCase())) out.push('may contain ' + a); });
    (prefs.exclusions || []).forEach(x => { if (has(ing, x) || meal.name.toLowerCase().includes(x.toLowerCase())) out.push('contains ' + x); });
    return out;
  }
  root.LBMeals = { LIB, DIETS, conflicts };
})(typeof window !== 'undefined' ? window : globalThis);
