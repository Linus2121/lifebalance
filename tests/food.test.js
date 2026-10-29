const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/meals.js');

test('every built-in ingredient is recognised and quantified', () => {
  M.LIB.forEach(meal => {
    const a = M.analyse(meal.ingredients);
    assert.deepStrictEqual(a.unknown, [], meal.id + ' unknown: ' + a.unknown);
    meal.ingredients.forEach(i => assert.ok(M.parseIng(i).qty > 0, meal.id + ' lacks quantity: ' + i));
  });
});

test('no contradictory labels', () => {
  M.LIB.forEach(meal => {
    const txt = meal.ingredients.join(' ').toLowerCase();
    if (/couscous|pasta|bread|pitta|tortilla|oats|granola/.test(txt)) assert.ok(!meal.diets.includes('gluten-free'), meal.id);
    if (/egg|milk|yoghurt|feta|cheese|chicken|beef|salmon|tilapia/.test(txt)) assert.ok(!meal.diets.includes('vegan'), meal.id);
    if (/chicken|beef|salmon|tilapia/.test(txt)) assert.ok(!meal.diets.includes('vegetarian'), meal.id);
    assert.ok(!meal.diets.includes('halal'), meal.id + ' must not claim halal');
  });
});

test('tagine is not gluten-free; uncertain items are unverified', () => {
  const t = M.LIB.find(x => x.id === 'chickpea-tagine');
  assert.ok(!t.diets.includes('gluten-free') && t.allergens.includes('gluten'));
  const inj = M.LIB.find(x => x.id === 'injera-misir');
  assert.ok(!inj.diets.includes('gluten-free') && inj.unverified.length);
  const soup = M.LIB.find(x => x.id === 'veg-soup');
  assert.ok(!soup.diets.includes('vegan') && soup.unverified.length);
});

test('conflicts never promise halal or safety', () => {
  const c = M.conflicts(M.LIB[0], { diets: ['halal'], allergies: [], exclusions: [] });
  assert.ok(c.some(x => /halal/.test(x)));
  assert.ok(M.conflicts(M.LIB.find(x => x.id === 'groundnut-stew'), { allergies: ['peanut'] }).length);
});

test('aggregate combines matching items scaled by portions', () => {
  const a = M.LIB.find(x => x.id === 'jollof-chicken'), b = M.LIB.find(x => x.id === 'lentil-dal');
  const r = M.aggregate([{ meal: a, portions: 2 }, { meal: b, portions: 1 }]);
  const rice = r.filter(x => x.name === 'rice');
  assert.strictEqual(rice.length, 1);
  assert.strictEqual(rice[0].qty, 225);
  assert.strictEqual(rice[0].text, '225 g rice');
  assert.strictEqual(r.filter(x => x.name === 'tomatoes').length, 1);
});
