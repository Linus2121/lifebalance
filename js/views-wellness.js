/* Wellness: Fitness and Food (manual logging only). General wellbeing information, not medical advice. */
(function () {
  const LB = window.LB, C = LB.C, V = LB.views, A = LB.actions, SB = LB.submits, esc = LB.esc, M = window.LBMeals;
  const WT = C.WORKOUT_TYPES, SLOTS = C.MEAL_SLOTS, DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SLOT_ICON = { breakfast: '\ud83c\udf05', lunch: '\ud83e\udd6a', dinner: '\ud83c\udf7d\ufe0f', snack: '\ud83c\udf4e' };
  const TYPE_ICON = { walking: '\ud83d\udeb6', running: '\ud83c\udfc3', cycling: '\ud83d\udeb4', gym: '\ud83c\udfcb\ufe0f', custom: '\u2b50' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const numOrNull = v => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null; };
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  const water = () => LB.S.habits.find(h => h.id === 'water');

  V.wellness = function () {
    const tab = LB.ui.wtab === 'food' ? 'food' : 'fitness';
    return `<div class="seg" role="group" aria-label="Wellness section"><button type="button" data-a="wTab" data-arg="fitness" aria-pressed="${tab === 'fitness'}">\ud83d\udcaa Fitness</button><button type="button" data-a="wTab" data-arg="food" aria-pressed="${tab === 'food'}">\ud83e\udd57 Food</button></div>` +
      (tab === 'food' ? food() : fitness()) +
      '<p class="muted small">General wellbeing information only. LifeBalance does not diagnose conditions or prescribe diets or exercise. Speak to a health professional about medical needs.</p>';
  };
  A.wTab = el => { LB.ui.wtab = el.dataset.arg; };

  /* =================== FITNESS =================== */
  function bar(v, max, label) {
    const p = max > 0 ? Math.min(100, Math.round(v / max * 100)) : 0;
    return `<div class="prog"><div class="row between"><span>${esc(label)}</span><b>${LB.num(v)} / ${LB.num(max)}</b></div><div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(v, max)}"><i style="width:${p}%"></i></div></div>`;
  }
  // plan.day stores the JS weekday (0 = Sunday), which is what the reminder code compares against.
  const planDay = d => C.dayOfWeek(d), dowOfRow = i => (i + 1) % 7;

  function fitness() {
    const S = LB.S, F = S.fitness, t = LB.today(), ws = C.weekStart(t), wk = LB.weekWorkouts(S, ws);
    const mins = wk.reduce((a, x) => a + x.minutes, 0), km = wk.reduce((a, x) => a + (x.distanceKm || 0), 0);
    let h = `<section class="card" aria-labelledby="fwH"><h2 id="fwH">This week</h2>`;
    h += F.goals.weeklyWorkouts > 0 ? bar(wk.length, F.goals.weeklyWorkouts, 'Workouts') : '';
    h += F.goals.weeklyMinutes > 0 ? bar(mins, F.goals.weeklyMinutes, 'Active minutes') : '';
    h += `<div class="stats"><div class="stat"><b>${wk.length}</b>workouts</div><div class="stat"><b>${mins}</b>minutes</div><div class="stat"><b>${LB.num(LB.displayValue(km, 'distance'))}</b>${LB.unit('distance')}</div></div>`;
    h += `<div class="row" aria-label="Days this week">` + [0, 1, 2, 3, 4, 5, 6].map(i => { const d = C.addDays(ws, i), n = F.workouts.filter(w => w.date === d).length; return `<span class="badge${n ? ' ok' : ''}" title="${LB.fmtDate(d)}">${DAYS[i].slice(0, 3)} ${n ? '\u2713' : '\u00b7'}</span>`; }).join('') + '</div>';
    h += `<p class="muted small">Walking and exercise workouts also count towards your Walking and Exercise habits automatically, so nothing is counted twice. Steps are not counted automatically and no wearable is connected.</p></section>`;

    const today = F.plan.filter(p => p.day === planDay(t));
    if (today.length) h += `<section class="card"><h2>Planned today</h2>` + today.map(p => `<div class="task"><span class="t">${TYPE_ICON[p.type]} ${esc(p.name || WT[p.type])}${p.minutes ? ' \u00b7 ' + p.minutes + ' min' : ''}${p.time ? ' \u00b7 ' + p.time : ''}</span><span class="acts"><button type="button" class="btn sm" data-a="logPlanned" data-id="${p.id}">Mark done</button></span></div>`).join('') + '</section>';

    const lt = LB.ui.wkType || 'walking';
    h += !LB.ui.showWk ? `<section class="card"><button type="button" class="btn big" data-a="reveal" data-arg="showWk" data-focus="#wk-type">\u2795 Log workout</button></section>` : `<section class="card" aria-labelledby="flH"><h2 id="flH">Log a workout</h2><form data-s="addWorkout">
      <div class="grid2"><div><label for="wk-type">Activity</label><select id="wk-type" name="type" data-c="wkType">${Object.keys(WT).map(k => opt(k, WT[k], k === lt)).join('')}</select></div>
      <div><label for="wk-date">Date</label><input type="date" id="wk-date" name="date" value="${t}" max="${t}" required></div>
      <div><label for="wk-name">Name (optional)</label><input type="text" id="wk-name" name="name" maxlength="60" placeholder="e.g. Morning jog"></div>
      <div><label for="wk-min">Duration (minutes)</label><input type="number" id="wk-min" name="minutes" min="0" max="1440" step="1" inputmode="numeric" placeholder="30"></div>
      <div id="wk-dist" ${['gym'].includes(lt) ? 'hidden' : ''}><label for="wk-km">Distance (${LB.unit('distance')}, optional)</label><input type="number" id="wk-km" name="km" min="0" max="${LB.num(LB.displayValue(1000, 'distance'))}" step="0.01" inputmode="decimal"></div></div>
      <div id="wk-gym" ${lt === 'gym' || lt === 'custom' ? '' : 'hidden'}><p class="small muted">Exercises (optional): sets, repetitions and weight in ${LB.unit('weight')}.</p>` +
      [0, 1, 2, 3].map(i => `<div class="exrow"><label class="sr" for="ex-n${i}">Exercise ${i + 1} name</label><input type="text" id="ex-n${i}" name="exn${i}" placeholder="Exercise" maxlength="60"><label class="sr" for="ex-s${i}">Sets</label><input type="number" id="ex-s${i}" name="exs${i}" min="0" max="100" placeholder="Sets" inputmode="numeric"><label class="sr" for="ex-r${i}">Reps</label><input type="number" id="ex-r${i}" name="exr${i}" min="0" max="1000" placeholder="Reps" inputmode="numeric"><label class="sr" for="ex-w${i}">Weight in ${LB.unit('weight')}</label><input type="number" id="ex-w${i}" name="exw${i}" min="0" max="1000" step="0.5" placeholder="${LB.unit('weight')}" inputmode="decimal"></div>`).join('') +
      `</div><label for="wk-notes">Notes (optional)</label><input type="text" id="wk-notes" name="notes" maxlength="500"><p class="row"><button class="btn">Save workout</button><button type="button" class="btn alt" data-a="hide" data-arg="showWk">Cancel</button></p></form></section>`;

    // history
    const hist = F.workouts.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, LB.ui.allHist ? 500 : 10);
    h += `<section class="card" aria-labelledby="fhH"><h2 id="fhH">Workout history</h2>`;
    h += hist.length ? hist.map(w => `<div class="task"><span class="t">${TYPE_ICON[w.type]} <b>${esc(w.name || WT[w.type])}</b> <span class="muted small">${LB.fmtDate(w.date, true)}</span><br><span class="small">${w.minutes ? w.minutes + ' min' : ''}${w.distanceKm ? ' \u00b7 ' + LB.measure(w.distanceKm, 'distance') : ''}</span>` +
      (w.exercises.length ? '<br><span class="small">' + w.exercises.map(e => esc(e.name) + (e.sets || e.reps ? ' ' + (e.sets || '?') + '\u00d7' + (e.reps || '?') : '') + (e.weightKg ? ' @ ' + LB.measure(e.weightKg, 'weight') : '')).join('; ') + '</span>' : '') + (w.notes ? `<br><span class="small muted">${esc(w.notes)}</span>` : '') +
      `</span><span class="acts"><button type="button" class="btn danger sm" data-a="delWorkout" data-id="${w.id}" aria-label="Delete workout ${esc(w.name || WT[w.type])} on ${w.date}">Delete</button></span></div>`).join('') +
      (F.workouts.length > 10 && !LB.ui.allHist ? '<button type="button" class="btn alt sm" data-a="allHist">Show all</button>' : '') : LB.empty('\ud83c\udfc3', 'No workouts yet', 'Log your first walk, run, ride or gym session above.');
    h += '</section>';

    // plan
    h += `<section class="card" aria-labelledby="fpH"><h2 id="fpH">Weekly workout plan</h2>`;
    h += F.plan.length ? DAYS.map((n, i) => { const a = F.plan.filter(p => p.day === dowOfRow(i)); return a.length ? `<div class="dayhead">${n}</div>` + a.map(p => `<div class="task"><span class="t">${TYPE_ICON[p.type]} ${esc(p.name || WT[p.type])}${p.minutes ? ' \u00b7 ' + p.minutes + ' min' : ''}${p.time ? ' \u00b7 ' + p.time : ''}</span><span class="acts"><button type="button" class="btn danger sm" data-a="delPlan" data-id="${p.id}" aria-label="Remove ${esc(p.name || WT[p.type])} on ${n}">Remove</button></span></div>`).join('') : ''; }).join('') : LB.empty('\ud83d\uddd3\ufe0f', 'No plan yet', 'Add the workouts you would like to do each week.');
    h += !LB.ui.showPlan ? `<p><button type="button" class="btn alt" data-a="reveal" data-arg="showPlan" data-focus="#pl-day">\u2795 Add to plan</button></p></section>` : `<form data-s="addPlan" class="grid2"><div><label for="pl-day">Day</label><select id="pl-day" name="day">${DAYS.map((n, i) => opt(dowOfRow(i), n, dowOfRow(i) === planDay(t))).join('')}</select></div>
      <div><label for="pl-type">Activity</label><select id="pl-type" name="type">${Object.keys(WT).map(k => opt(k, WT[k])).join('')}</select></div>
      <div><label for="pl-name">Name (optional)</label><input type="text" id="pl-name" name="name" maxlength="60"></div>
      <div><label for="pl-min">Minutes</label><input type="number" id="pl-min" name="minutes" min="0" max="1440" inputmode="numeric" placeholder="30"></div>
      <div><label for="pl-time">Time (optional, for reminders)</label><input type="time" id="pl-time" name="time"></div><div class="row"><button class="btn">Add to plan</button><button type="button" class="btn alt" data-a="hide" data-arg="showPlan">Cancel</button></div></form></section>`;

    // goals + reminders
    const R = S.settings.fitnessReminders;
    h += `<section class="card" aria-labelledby="fgH"><h2 id="fgH">Goals and reminders</h2>${LB.ui.showGoals ? '' : `<p class="small">Goal: ${F.goals.weeklyWorkouts} workouts and ${F.goals.weeklyMinutes} active minutes a week \u00b7 workout reminders ${R.enabled ? "on" : "off"}.</p><button type="button" class="btn alt" data-a="reveal" data-arg="showGoals" data-focus="#g-w">Edit goals and reminders</button>`}<form data-s="saveFitGoals" class="grid2" ${LB.ui.showGoals ? '' : "hidden"}>
      <div><label for="g-w">Workouts per week</label><input type="number" id="g-w" name="w" min="0" max="21" value="${F.goals.weeklyWorkouts}" inputmode="numeric"></div>
      <div><label for="g-m">Active minutes per week</label><input type="number" id="g-m" name="m" min="0" max="10080" value="${F.goals.weeklyMinutes}" inputmode="numeric"></div>
      <div class="full"><label class="check"><input type="checkbox" name="fr" ${R.enabled ? 'checked' : ''}> Remind me before planned workouts that have a time</label></div>
      <div><label for="g-lead">Reminder lead time</label><select id="g-lead" name="lead">${[0, 15, 30, 60, 120].map(m => opt(m, m ? m + ' minutes before' : 'At the start time', R.lead === m)).join('')}</select></div>
      <div class="full"><label class="check"><input type="checkbox" name="tw" ${F.goals.trackWeight ? 'checked' : ''}> Track my weight (optional)</label></div>
      <div class="full"><button class="btn">Save goals</button></div></form>
      <p class="muted small">${R.enabled ? esc(LB.rem ? LB.rem.deliveryNote() : '') : 'Reminders use the same system as appointments. Details are hidden in notification previews unless you change that in Settings.'}</p></section>`;

    if (F.goals.trackWeight) {
      const ws2 = F.weights.slice().sort((a, b) => b.date.localeCompare(a.date));
      h += `<section class="card" aria-labelledby="fwtH"><h2 id="fwtH">\u2696\ufe0f Weight (optional)</h2><p class="muted small">Weight is private to you. A target is optional; there is no required goal.</p>`;
      if (ws2.length > 1) { const dlt = ws2[0].kg - ws2[ws2.length - 1].kg; h += `<p>Latest <b>${LB.measure(ws2[0].kg, 'weight')}</b> \u00b7 change since first entry: ${dlt > 0 ? '+' : ''}${LB.measure(dlt, 'weight')}</p>`; }
      h += ws2.length ? ws2.slice(0, 8).map(x => `<div class="task"><span class="t">${LB.fmtDate(x.date, true)} \u00b7 <b>${LB.measure(x.kg, 'weight')}</b></span><span class="acts"><button type="button" class="btn danger sm" data-a="delWeight" data-id="${x.id}" aria-label="Delete weight on ${x.date}">Delete</button></span></div>`).join('') : LB.empty('\u2696\ufe0f', 'No weight entries', 'Add one when you like. You can switch tracking off in Goals.');
      h += `<form data-s="addWeight" class="grid2"><div><label for="wt-d">Date</label><input type="date" id="wt-d" name="date" value="${t}" max="${t}" required></div><div><label for="wt-k">Weight (${LB.unit('weight')})</label><input type="number" id="wt-k" name="kg" min="${LB.displayValue(20, 'weight')}" max="${LB.displayValue(500, 'weight')}" step="any" inputmode="decimal" required></div>
        <div><label for="wt-t">Target weight (${LB.unit('weight')}, optional)</label><input type="number" id="wt-t" name="target" min="${LB.displayValue(20, 'weight')}" max="${LB.displayValue(500, 'weight')}" step="any" inputmode="decimal" value="${F.goals.targetWeightKg ? LB.num(LB.displayValue(F.goals.targetWeightKg, 'weight')) : ''}"></div><div><button class="btn">Save</button></div></form></section>`;
    }
    return h;
  }
  LB.changes.wkType = el => {
    LB.ui.wkType = el.value;
    const g = document.getElementById('wk-gym'), d = document.getElementById('wk-dist');
    if (g) g.hidden = !(el.value === 'gym' || el.value === 'custom'); if (d) d.hidden = el.value === 'gym';
    return 'none';
  };
  A.allHist = () => { LB.ui.allHist = true; };
  SB.addWorkout = f => {
    const d = f.date.value; if (!C.isDate(d) || d > LB.today()) { LB.toast('Choose a date that is not in the future.'); return false; }
    const type = f.type.value, minutes = Math.round(numOrNull(f.minutes.value) || 0), km = LB.metricValue(numOrNull(f.km.value), 'distance'), ex = [];
    for (let i = 0; i < 4; i++) { const n = f['exn' + i].value.trim(); if (n) ex.push({ name: n.slice(0, 60), sets: numOrNull(f['exs' + i].value), reps: numOrNull(f['exr' + i].value), weightKg: LB.metricValue(numOrNull(f['exw' + i].value), 'weight') }); }
    if (!minutes && !km && !ex.length) { LB.toast('Add a duration, distance or exercise.'); return false; }
    LB.S.fitness.workouts.push({ id: C.uid(), date: d, type, name: f.name.value.trim().slice(0, 60), minutes, distanceKm: type === 'gym' ? null : km, notes: f.notes.value.trim().slice(0, 500), exercises: ex });
    LB.ui.showWk = false; LB.save(); LB.toast('Workout saved.');
  };
  A.logPlanned = el => {
    const p = LB.S.fitness.plan.find(x => x.id === el.dataset.id); if (!p) return;
    LB.S.fitness.workouts.push({ id: C.uid(), planId: p.id, date: LB.today(), type: p.type, name: p.name, minutes: p.minutes, distanceKm: null, notes: '', exercises: [] }); LB.save(); LB.toast('Logged from your plan.');
  };
  A.delWorkout = el => LB.remove(() => LB.S.fitness.workouts, el.dataset.id, 'Workout');
  A.delPlan = el => LB.remove(() => LB.S.fitness.plan, el.dataset.id, 'Plan item');
  A.delWeight = el => LB.remove(() => LB.S.fitness.weights, el.dataset.id, 'Weight entry');
  SB.addPlan = f => {
    LB.S.fitness.plan.push({ id: C.uid(), day: +f.day.value, type: f.type.value, name: f.name.value.trim().slice(0, 60), minutes: Math.round(numOrNull(f.minutes.value) || 0), time: f.time.value || '' });
    LB.ui.showPlan = false; LB.save(); LB.toast('Added to your weekly plan.');
  };
  SB.saveFitGoals = f => {
    const S = LB.S; S.fitness.goals.weeklyWorkouts = Math.min(21, Math.round(numOrNull(f.w.value) || 0)); S.fitness.goals.weeklyMinutes = Math.min(10080, Math.round(numOrNull(f.m.value) || 0));
    S.fitness.goals.trackWeight = f.tw.checked; S.settings.fitnessReminders = { enabled: f.fr.checked, lead: +f.lead.value };
    LB.ui.showGoals = false; LB.save(); LB.toast('Goals saved.');
  };
  SB.addWeight = f => {
    const kg = LB.metricValue(numOrNull(f.kg.value), 'weight'); if (!(kg >= 20 && kg <= 500) || !C.isDate(f.date.value)) { LB.toast('Enter a weight between 20 and 500 kg.'); return false; }
    const tg = LB.metricValue(numOrNull(f.target.value), 'weight'); LB.S.fitness.goals.targetWeightKg = tg >= 20 && tg <= 500 ? tg : null;
    LB.S.fitness.weights.push({ id: C.uid(), date: f.date.value, kg }); LB.save(); LB.toast('Weight saved.');
  };

  /* =================== FOOD =================== */
  const allMeals = () => M.LIB.concat(LB.S.food.custom);
  const mealById = id => allMeals().find(m => m.id === id);
  const warn = m => M.conflicts(m, LB.S.food.prefs);
  const FT = [['diary', 'Diary'], ['plan', 'Meal plan'], ['shop', 'Shopping'], ['meals', 'Meals'], ['prefs', 'Preferences']];

  function food() {
    const tab = LB.ui.ftab || 'diary';
    return `<div class="seg sub" role="group" aria-label="Food section">${FT.map(x => `<button type="button" data-a="fTab" data-arg="${x[0]}" aria-pressed="${tab === x[0]}">${x[1]}</button>`).join('')}</div>` + ({ diary, plan, shop, meals, prefs }[tab] || diary)();
  }
  A.fTab = el => { LB.ui.ftab = el.dataset.arg; };
  // Detailed forms stay hidden until the matching button is pressed.
  A.reveal = el => { LB.ui[el.dataset.arg] = true; if (el.dataset.focus) LB.ui.focus = el.dataset.focus; };
  A.hide = el => { LB.ui[el.dataset.arg] = false; };

  function diary() {
    const S = LB.S, P = S.food.prefs, t = LB.today(), d = LB.ui.fdate || t, list = S.food.diary[d] || [], w = water();
    let h = `<section class="card"><label for="fd-date">Day</label><input type="date" id="fd-date" value="${d}" max="${t}" data-c="fdate" style="max-width:200px"> ${d !== t ? '<button type="button" class="btn alt sm" data-a="fToday">Today</button>' : ''}</section>`;
    h += `<section class="card" aria-labelledby="fdH"><h2 id="fdH">Food diary \u00b7 ${LB.fmtDate(d)}</h2>`;
    let total = 0, counted = 0;
    SLOTS.forEach(s => {
      const e = list.filter(x => x.meal === s);
      h += `<div class="dayhead">${SLOT_ICON[s]} ${cap(s)}</div>` + (e.length ? e.map(x => { if (x.kcal != null) { total += x.kcal * x.servings; counted++; } return `<div class="task"><span class="t">${esc(x.name)} <span class="muted small">\u00d7 ${LB.num(x.servings)} serving${x.servings === 1 ? '' : 's'}${P.trackCalories && x.kcal != null ? ' \u00b7 ~' + Math.round(x.kcal * x.servings) + ' kcal (your estimate)' : ''}</span></span><span class="acts"><button type="button" class="btn danger sm" data-a="delDiary" data-id="${x.id}" data-arg="${d}" aria-label="Delete ${esc(x.name)}">Delete</button></span></div>`; }).join('') : '<p class="muted small">Nothing logged.</p>');
    });
    if (!list.length) h += LB.empty('\ud83c\udf7d\ufe0f', 'No meals logged', 'Add what you ate below. This diary is private and optional.');
    if (P.trackCalories) h += `<p class="note"><b>Calories (your own estimates):</b> ~${Math.round(total)} kcal from ${counted} item${counted === 1 ? '' : 's'} with an estimate${P.calorieTarget ? ' \u00b7 your optional target: ' + P.calorieTarget + ' kcal' : ''}. Built-in meals have no nutrition data; values shown are only what you entered. They are not exact.</p>`;
    h += !LB.ui.showMeal ? `<p><button type="button" class="btn big" data-a="reveal" data-arg="showMeal" data-focus="#fd-name">\u2795 Add meal</button></p></section>` : `<form data-s="addDiary" class="grid2"><div><label for="fd-slot">Meal</label><select id="fd-slot" name="slot">${SLOTS.map(s => opt(s, cap(s))).join('')}</select></div>
      <div><label for="fd-name">Food or meal</label><input type="text" id="fd-name" name="name" list="mealNames" maxlength="100" required autocomplete="off"><datalist id="mealNames">${allMeals().map(m => `<option value="${esc(m.name)}">`).join('')}</datalist></div>
      <div><label for="fd-srv">Portion (servings)</label><input type="number" id="fd-srv" name="srv" min="0.1" max="20" step="0.25" value="1" inputmode="decimal"></div>` +
      (P.trackCalories ? `<div><label for="fd-kcal">Calories per serving (optional estimate)</label><input type="number" id="fd-kcal" name="kcal" min="0" max="20000" inputmode="numeric"></div>` : '') +
      `<div class="full row"><button class="btn">Add to diary</button><button type="button" class="btn alt" data-a="hide" data-arg="showMeal">Cancel</button></div></form></section>`;
    if (w) {
      const v = C.habitValue(S, d, w), g = C.goalOn(w, d);
      h += `<section class="card" aria-labelledby="fwaH"><h2 id="fwaH">\ud83d\udca7 Water</h2>${bar(v, g, 'Water (' + w.unit + ')')}<div class="row"><button type="button" class="btn alt" data-a="waterStep" data-arg="-1" data-key="${d}" aria-label="Remove one step of water">\u2212</button><button type="button" class="btn" data-a="waterStep" data-arg="1" data-key="${d}" aria-label="Add one step of water">+ ${LB.num(w.step)} ${esc(w.unit)}</button></div>
        <p class="muted small">This is the same water count as on the Habits tab, so it is never counted twice.</p>`;
      const H = S.settings.hydrationReminders;
      h += `<form data-s="saveHydration"><label class="check"><input type="checkbox" name="on" ${H.enabled ? 'checked' : ''}> Hydration reminders</label><label for="hy-t">Times (comma separated, 24h, e.g. 10:00, 15:00)</label><input type="text" id="hy-t" name="times" value="${esc(H.times.join(', '))}"><p><button class="btn sm">Save</button></p></form></section>`;
    }
    const MR = S.settings.mealReminders;
    h += `<section class="card"><h2>Meal reminders</h2><form data-s="saveMealRem" class="grid2"><div class="full"><label class="check"><input type="checkbox" name="on" ${MR.enabled ? 'checked' : ''}> Remind me to log meals</label></div>` +
      ['breakfast', 'lunch', 'dinner'].map(s => `<div><label for="mr-${s}">${cap(s)}</label><input type="time" id="mr-${s}" name="${s}" value="${MR[s]}"></div>`).join('') + `<div class="full"><button class="btn sm">Save</button></div></form>
      <p class="muted small">${MR.enabled || S.settings.hydrationReminders.enabled ? esc(LB.rem ? LB.rem.deliveryNote() : '') : 'Reminders are optional and appear generically in notifications.'}</p></section>`;
    return h;
  }
  LB.changes.fdate = el => { LB.ui.fdate = C.isDate(el.value) && el.value <= LB.today() ? el.value : null; };
  A.fToday = () => { LB.ui.fdate = null; };
  A.waterStep = el => {
    const S = LB.S, h = water(), d = el.dataset.key; if (!h) return;
    const nv = Math.max(0, Math.round((C.habitManual(S, d, h) + (+el.dataset.arg) * h.step) * 100) / 100);
    (S.logs[d] = S.logs[d] || {})[h.id] = nv; LB.save();
  };
  SB.addDiary = f => {
    const S = LB.S, name = f.name.value.trim(), d = LB.ui.fdate || LB.today(), m = allMeals().find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!name) return false;
    let kcal = f.kcal ? numOrNull(f.kcal.value) : null; if (kcal == null && m && m.nutrition) kcal = m.nutrition.kcal;
    (S.food.diary[d] = S.food.diary[d] || []).push({ id: C.uid(), meal: f.slot.value, name: name.slice(0, 100), mealId: m ? m.id : '', servings: Math.min(20, Math.max(0.1, parseFloat(f.srv.value) || 1)), kcal });
    LB.save();
    LB.ui.showMeal = false; const w = m ? warn(m) : []; LB.toast(w.length ? 'Added. Note: ' + w.join('; ') + '.' : 'Added to your diary.');
  };
  A.delDiary = el => LB.remove(() => LB.S.food.diary[el.dataset.arg] || [], el.dataset.id, 'Entry');
  SB.saveHydration = f => {
    const times = f.times.value.split(/[,\s]+/).filter(x => /^([01]\d|2[0-3]):[0-5]\d$/.test(x));
    if (f.on.checked && !times.length) { LB.toast('Enter at least one time like 10:00.'); return false; }
    LB.S.settings.hydrationReminders = { enabled: f.on.checked, times: [...new Set(times)].sort().slice(0, 12) }; LB.save(); LB.toast('Hydration reminders saved.');
  };
  SB.saveMealRem = f => { LB.S.settings.mealReminders = { enabled: f.on.checked, breakfast: f.breakfast.value || '08:00', lunch: f.lunch.value || '13:00', dinner: f.dinner.value || '19:00' }; LB.save(); LB.toast('Meal reminders saved.'); };

  /* ---- meal plan + shopping ---- */
  function plan() {
    const S = LB.S, ws = LB.ui.pwk || C.weekStart(LB.today());
    let h = `<section class="card"><div class="row between"><button type="button" class="btn alt sm" data-a="pWeek" data-arg="-7" aria-label="Previous week">\u2039 Prev</button><b>Week of ${LB.fmtDate(ws)}</b><button type="button" class="btn alt sm" data-a="pWeek" data-arg="7" aria-label="Next week">Next \u203a</button></div></section>`;
    for (let i = 0; i < 7; i++) {
      const d = C.addDays(ws, i), p = S.food.plan[d] || {};
      h += `<section class="card"><h2>${DAYS[i]} <span class="muted small">${LB.fmtDate(d)}</span></h2><div class="grid2">` + ['breakfast', 'lunch', 'dinner', 'snack'].map(s => {
        const cands = allMeals().filter(m => m.slots.includes(s) || m.id === p[s]).sort((a, b) => (S.food.favourites.includes(b.id) - S.food.favourites.includes(a.id)) || a.name.localeCompare(b.name));
        return `<div><label for="pm-${d}-${s}">${SLOT_ICON[s]} ${cap(s)}</label><select id="pm-${d}-${s}" data-c="planMeal" data-id="${d}" data-arg="${s}"><option value="">\u2014 none \u2014</option>${cands.map(m => opt(m.id, (S.food.favourites.includes(m.id) ? '\u2605 ' : '') + m.name + (warn(m).length ? ' \u26a0' : ''), m.id === p[s])).join('')}</select><label class="sr" for="pp-${d}-${s}">Portions for ${s}</label><input type="number" id="pp-${d}-${s}" class="portion" min="0.5" max="20" step="0.5" value="${S.food.planServings[d + '|' + s] || 1}" data-c="planPortions" data-id="${d}" data-arg="${s}" aria-label="Portions for ${cap(s)} on ${DAYS[i]}" title="Portions"></div>`;
      }).join('') + '</div>';
      const ws2 = Object.keys(p).map(s => { const m = mealById(p[s]); return m && warn(m).length ? esc(m.name) + ': ' + esc(warn(m).join('; ')) : ''; }).filter(Boolean);
      if (ws2.length) h += `<p class="note" role="note">\u26a0 ${ws2.join('<br>\u26a0 ')}<br><span class="small">Tags are best-effort. Always check labels and ingredients yourself.</span></p>`;
      h += '</section>';
    }
    return h + '<p class="muted small">Planning a meal updates your shopping list automatically.</p>';
  }
  A.pWeek = el => { LB.ui.pwk = C.addDays(LB.ui.pwk || C.weekStart(LB.today()), +el.dataset.arg); };
  LB.changes.planMeal = el => {
    const S = LB.S, d = el.dataset.id, s = el.dataset.arg; S.food.plan[d] = S.food.plan[d] || {};
    if (el.value) S.food.plan[d][s] = el.value; else { delete S.food.plan[d][s]; delete S.food.planServings[d + '|' + s]; }
    if (!Object.keys(S.food.plan[d]).length) delete S.food.plan[d];
    rebuildShopping(); LB.save(); LB.ui.focus = '#' + el.id;
  };
  // Rebuilds the auto-generated part of the shopping list from meals planned from today onwards. Manual and edited items and ticks are kept.
  LB.changes.planPortions = el => {
    const S = LB.S, k = el.dataset.id + '|' + el.dataset.arg, v = Math.min(20, Math.max(0.5, parseFloat(el.value) || 1));
    if (!(S.food.plan[el.dataset.id] || {})[el.dataset.arg]) return false;
    if (v === 1) delete S.food.planServings[k]; else S.food.planServings[k] = v;
    rebuildShopping(); LB.save(); LB.ui.focus = '#' + el.id;
  };
  function rebuildShopping() {
    const F = LB.S.food, t = LB.today(), entries = [], old = new Map(F.shopping.filter(x => x.auto).map(x => [x.key || x.name.toLowerCase(), x]));
    Object.keys(F.plan).filter(d => d >= t).sort().forEach(d => SLOTS.forEach(s => {
      const m = mealById(F.plan[d][s]); if (m) entries.push({ meal: m, portions: F.planServings[d + '|' + s] || 1 });
    }));
    const manual = F.shopping.filter(x => !x.auto), have = new Set(manual.map(x => x.name.toLowerCase()));
    F.shopping = manual.concat(M.aggregate(entries).filter(e => !have.has(e.text.toLowerCase())).map(e => {
      const o = old.get(e.key) || old.get(e.text.toLowerCase());
      return { id: o ? o.id : C.uid(), name: e.text.slice(0, 80), key: e.key, auto: true, checked: o ? o.checked : false, sources: e.sources.slice(0, 20) };
    }));
  }
  function shop() {
    const L = LB.S.food.shopping, open = L.filter(x => !x.checked), done = L.filter(x => x.checked);
    let h = `<section class="card" aria-labelledby="shH"><h2 id="shH">\ud83d\uded2 Shopping list</h2>`;
    h += L.length ? open.concat(done).map(x => LB.ui.editShop === x.id ? `<form class="task" data-s="saveShop" data-id="${x.id}"><label class="sr" for="es">Item</label><input type="text" id="es" name="name" value="${esc(x.name)}" maxlength="80" required><button class="btn sm">Save</button><button type="button" class="btn alt sm" data-a="cancelShop">Cancel</button></form>` :
      `<div class="task ${x.checked ? 'done' : ''}"><button type="button" class="chk" data-a="toggleShop" data-id="${x.id}" aria-pressed="${x.checked}" aria-label="${x.checked ? 'Untick' : 'Tick'} ${esc(x.name)}">${x.checked ? '\u2713' : ''}</button><span class="t">${esc(x.name)}${x.sources.length ? `<br><span class="muted small">for ${esc(x.sources.join(', '))}</span>` : ''}</span><span class="acts"><button type="button" class="btn alt sm" data-a="editShop" data-id="${x.id}" aria-label="Edit ${esc(x.name)}">Edit</button><button type="button" class="btn danger sm" data-a="delShop" data-id="${x.id}" aria-label="Delete ${esc(x.name)}">Delete</button></span></div>`).join('') :
      LB.empty('\ud83d\uded2', 'Shopping list is empty', 'Plan meals for today or later and ingredients appear here automatically. You can also add your own items.');
    h += `<form class="task" data-s="addShop"><label class="sr" for="shN">New item</label><input type="text" id="shN" name="name" placeholder="Add an item" maxlength="80" required><button class="btn">Add</button></form>
      <div class="row"><button type="button" class="btn alt sm" data-a="refreshShop">Refresh from meal plan</button>${done.length ? '<button type="button" class="btn alt sm" data-a="clearTicked">Remove ticked items</button>' : ''}</div>
      <p class="muted small">Quantities are scaled by the portions you set in the plan and matching ingredients are combined (estimates from per-serving amounts; check pack sizes). Items you delete may return when the plan changes or you refresh. Editing an item makes it yours, so it stays.</p></section>`;
    return h;
  }
  A.toggleShop = el => { const x = LB.S.food.shopping.find(i => i.id === el.dataset.id); if (x) { x.checked = !x.checked; LB.save(); } };
  A.editShop = el => { LB.ui.editShop = el.dataset.id; LB.ui.focus = '#es'; };
  A.cancelShop = () => { LB.ui.editShop = null; };
  A.delShop = el => LB.remove(() => LB.S.food.shopping, el.dataset.id, 'Item');
  A.refreshShop = () => { rebuildShopping(); LB.save(); LB.toast('Shopping list refreshed from your meal plan.'); };
  A.clearTicked = () => { LB.S.food.shopping = LB.S.food.shopping.filter(x => !x.checked); LB.save(); };
  SB.addShop = f => { const n = f.name.value.trim(); if (!n) return false; LB.S.food.shopping.push({ id: C.uid(), name: n.slice(0, 80), auto: false, checked: false, sources: [] }); LB.save(); LB.ui.focus = '#shN'; };
  SB.saveShop = f => { const x = LB.S.food.shopping.find(i => i.id === f.dataset.id), n = f.name.value.trim(); if (x && n) { x.name = n.slice(0, 80); x.auto = false; x.sources = []; } LB.ui.editShop = null; LB.save(); };

  /* ---- meals, favourites, recipes ---- */
  function meals() {
    const S = LB.S, q = (LB.ui.mq || '').toLowerCase(), slot = LB.ui.mslot || '', cu = LB.ui.mcu || '', favOnly = !!LB.ui.mfav;
    const cuisines = [...new Set(allMeals().map(m => m.cuisine))].sort();
    let list = allMeals().filter(m => (!slot || m.slots.includes(slot)) && (!cu || m.cuisine === cu) && (!favOnly || S.food.favourites.includes(m.id)) && (!q || (m.name + ' ' + m.ingredients.join(' ')).toLowerCase().includes(q)));
    let h = `<section class="card"><h2>Meal ideas</h2><p class="muted small">Explore meals from around the world, including African, Asian, Mediterranean and other international favourites. Built-in meals have no nutrition values. Diet tags are best-effort suggestions, not guarantees.</p>
      <div class="grid2"><div><label for="m-q">Search</label><input type="search" id="m-q" value="${esc(LB.ui.mq || '')}" data-i="mealSearch" placeholder="Name or ingredient"></div>
      <div><label for="m-slot">Meal</label><select id="m-slot" data-c="mealFilter" data-arg="mslot"><option value="">Any</option>${SLOTS.map(s => opt(s, cap(s), s === slot)).join('')}</select></div>
      <div><label for="m-cu">Cuisine</label><select id="m-cu" data-c="mealFilter" data-arg="mcu"><option value="">Any</option>${cuisines.map(c => opt(c, c, c === cu)).join('')}</select></div>
      <div><label class="check"><input type="checkbox" data-c="mealFilter" data-arg="mfav" ${favOnly ? 'checked' : ''}> Favourites only</label></div></div></section><div id="mealList">${mealCards(list)}</div>`;
    h += `<section class="card" aria-labelledby="rcH"><h2 id="rcH">Add my own recipe</h2><form data-s="addRecipe" class="grid2">
      <div><label for="rc-n">Name</label><input type="text" id="rc-n" name="name" maxlength="80" required></div><div><label for="rc-c">Cuisine (optional)</label><input type="text" id="rc-c" name="cuisine" maxlength="30" placeholder="e.g. Family favourite"></div>
      <div class="full"><label for="rc-i">Ingredients (one per line or comma separated)</label><textarea id="rc-i" name="ing" rows="3"></textarea></div>
      <div class="full"><span class="small">Suitable for:</span> ${SLOTS.map(s => `<label class="check inline"><input type="checkbox" name="s-${s}" checked> ${cap(s)}</label>`).join(' ')}</div>
      <div><label for="rc-s">Servings the recipe makes</label><input type="number" id="rc-s" name="srv" min="0.5" max="50" step="0.5" value="1"></div>
      <div class="full"><details><summary>Optional nutrition per serving (your own estimate)</summary><p class="small muted">Only enter values you know, for example from a food label. LifeBalance never invents nutrition numbers. Source recorded: "entered by you".</p>
        <div class="grid2"><div><label for="rc-k">Calories (kcal)</label><input type="number" id="rc-k" name="kcal" min="0" inputmode="numeric"></div><div><label for="rc-p">Protein (g)</label><input type="number" id="rc-p" name="protein" min="0" inputmode="decimal"></div><div><label for="rc-cb">Carbs (g)</label><input type="number" id="rc-cb" name="carbs" min="0" inputmode="decimal"></div><div><label for="rc-f">Fat (g)</label><input type="number" id="rc-f" name="fat" min="0" inputmode="decimal"></div></div></details></div>
      <div class="full"><button class="btn">Save recipe</button></div></form></section>`;
    return h;
  }
  function mealCards(list) {
    const S = LB.S;
    if (!list.length) return LB.empty('\ud83d\udd0e', 'No meals match', 'Try a different search or filter.');
    return list.map(m => {
      const w = warn(m), fav = S.food.favourites.includes(m.id), n = m.nutrition && Object.values(m.nutrition).some(v => v != null) ? m.nutrition : null;
      return `<section class="card meal"><div class="row between"><b>${esc(m.name)}</b><button type="button" class="btn alt sm" data-a="toggleFav" data-id="${esc(m.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}: ${esc(m.name)}">${fav ? '\u2605' : '\u2606'}</button></div>
        <p class="small muted">${esc(m.cuisine)} \u00b7 ${m.slots.map(cap).join(', ') || 'any meal'}${m.servings ? ' \u00b7 makes ' + m.servings + ' serving' + (m.servings === 1 ? '' : 's') : ''}</p><p class="small">${esc(m.ingredients.join(', '))}</p>
        ${n && S.food.prefs.trackCalories ? `<p class="small">Your estimate per serving: ${n.kcal != null ? n.kcal + ' kcal ' : ''}${n.protein != null ? '\u00b7 protein ' + n.protein + ' g ' : ''}${n.carbs != null ? '\u00b7 carbs ' + n.carbs + ' g ' : ''}${n.fat != null ? '\u00b7 fat ' + n.fat + ' g' : ''} <span class="badge">entered by you</span></p>` : ''}
        ${w.length ? `<p class="note" role="note">\u26a0 ${esc(w.join('; '))}</p>` : ''}
        <div class="row"><button type="button" class="btn sm" data-a="quickLog" data-id="${esc(m.id)}">Add to today's diary</button>${m.builtin ? '' : `<button type="button" class="btn danger sm" data-a="delRecipe" data-id="${esc(m.id)}" aria-label="Delete recipe ${esc(m.name)}">Delete</button>`}</div></section>`;
    }).join('');
  }
  LB.inputs.mealSearch = el => { LB.ui.mq = el.value; const l = document.getElementById('mealList'); if (l) l.innerHTML = mealCards(allMeals().filter(m => (!LB.ui.mslot || m.slots.includes(LB.ui.mslot)) && (!LB.ui.mcu || m.cuisine === LB.ui.mcu) && (!LB.ui.mfav || LB.S.food.favourites.includes(m.id)) && (!el.value || (m.name + ' ' + m.ingredients.join(' ')).toLowerCase().includes(el.value.toLowerCase())))); };
  LB.changes.mealFilter = el => { LB.ui[el.dataset.arg] = el.type === 'checkbox' ? el.checked : el.value; LB.ui.focus = '#' + el.id; if (el.type === 'checkbox') LB.ui.focus = '[data-arg=mfav]'; };
  A.toggleFav = el => { const f = LB.S.food.favourites, i = f.indexOf(el.dataset.id); if (i >= 0) f.splice(i, 1); else f.push(el.dataset.id); LB.save(); LB.ui.focus = `[data-a=toggleFav][data-id="${el.dataset.id}"]`; };
  A.quickLog = el => {
    const m = mealById(el.dataset.id), d = LB.today(); if (!m) return;
    const slot = SLOTS.find(s => m.slots.includes(s)) || 'snack';
    (LB.S.food.diary[d] = LB.S.food.diary[d] || []).push({ id: C.uid(), meal: slot, name: m.name, mealId: m.id, servings: 1, kcal: m.nutrition ? m.nutrition.kcal : null }); LB.save();
    LB.toast('Added to today\'s ' + slot + '.' + (warn(m).length ? ' Note: ' + warn(m).join('; ') + '.' : '')); LB.ui.focus = `[data-a=quickLog][data-id="${m.id}"]`;
  };
  SB.addRecipe = f => {
    const name = f.name.value.trim(); if (!name) return false;
    const ing = f.ing.value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean).slice(0, 60), slots = SLOTS.filter(s => f['s-' + s].checked);
    LB.S.food.custom.push({ id: 'c' + C.uid(), name: name.slice(0, 80), cuisine: f.cuisine.value.trim().slice(0, 30) || 'Custom', slots, diets: [], allergens: [], ingredients: ing, servings: Math.max(0.5, parseFloat(f.srv.value) || 1), notes: '', nutrition: { kcal: numOrNull(f.kcal.value), protein: numOrNull(f.protein.value), carbs: numOrNull(f.carbs.value), fat: numOrNull(f.fat.value) }, builtin: false });
    LB.save(); LB.toast('Recipe saved. Diet and allergy tags are not set for your own recipes, but your excluded ingredients are still checked.');
  };
  A.delRecipe = el => { LB.remove(() => LB.S.food.custom, el.dataset.id, 'Recipe'); };

  /* ---- preferences ---- */
  function prefs() {
    const P = LB.S.food.prefs;
    return `<section class="card" aria-labelledby="pfH"><h2 id="pfH">Dietary preferences</h2><p class="muted small">Used only to warn you about meal ideas and plans. Matching is best-effort from ingredient names. It is not a guarantee, so always read labels, especially for allergies.</p>
      <form data-s="savePrefs"><fieldset><legend>Diet</legend>${M.DIETS.map(d => `<label class="check inline"><input type="checkbox" name="d-${d}" ${P.diets.includes(d) ? 'checked' : ''}> ${cap(d)}</label>`).join(' ')}</fieldset>
      <label for="pf-a">Allergies (comma separated, e.g. peanut, egg, dairy)</label><input type="text" id="pf-a" name="allergies" value="${esc(P.allergies.join(', '))}">
      <label for="pf-e">Ingredients to exclude (comma separated)</label><input type="text" id="pf-e" name="exclusions" value="${esc(P.exclusions.join(', '))}">
      <label class="check"><input type="checkbox" name="track" ${P.trackCalories ? 'checked' : ''}> Show calorie estimates in my diary (optional)</label>
      <label for="pf-k">Daily calorie target (optional; leave blank for none)</label><input type="number" id="pf-k" name="target" min="500" max="10000" inputmode="numeric" value="${P.calorieTarget || ''}">
      <p class="small muted">Calorie and weight-loss targets are optional and are not medical advice. Nutrition values come only from numbers you enter yourself; no food database is connected and no photo analysis is available. For medical diets, ask a qualified professional.</p>
      <p><button class="btn">Save preferences</button></p></form></section>`;
  }
  SB.savePrefs = f => {
    const split = v => [...new Set(v.split(',').map(x => x.trim().toLowerCase()).filter(Boolean))].slice(0, 40);
    LB.S.food.prefs = { diets: M.DIETS.filter(d => f['d-' + d].checked), allergies: split(f.allergies.value), exclusions: split(f.exclusions.value), trackCalories: f.track.checked, calorieTarget: numOrNull(f.target.value) >= 500 ? numOrNull(f.target.value) : null };
    LB.save(); LB.toast('Preferences saved.');
  };
})();
