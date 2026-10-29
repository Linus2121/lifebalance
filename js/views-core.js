/* Today, Habits, Journal and Progress views. */
(function () {
  const LB = window.LB, C = LB.C, V = LB.views, A = LB.actions, SB = LB.submits, esc = LB.esc;
  const MOODS = [[1, '😞', 'Awful'], [2, '🙁', 'Low'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '😄', 'Great']];
  const COLORS = ['#1c7ed6', '#2f9e44', '#e8590c', '#c2255c', '#6c4cf1', '#0e9f8e', '#b36200'];
  LB.MOODS = MOODS;
  LB.empty = (icon, title, text, btn) => '<div class="empty"><div class="big" aria-hidden="true">' + icon + '</div><b>' + esc(title) + '</b><p>' + esc(text) + '</p>' + (btn || '') + '</div>';
  const water = () => LB.S.habits.find(h => h.id === 'water');
  LB.weekWorkouts = (S, start) => S.fitness.workouts.filter(w => w.date >= start && w.date <= C.addDays(start, 6));

  /* ---------- suggestions ---------- */
  LB.tips = function () {
    const S = LB.S, t = LB.today(), out = [], hour = new Date().getHours();
    const over = C.overdueTasks(S, t), todays = C.dayTasks(S, t), pri = todays.filter(x => x.priority);
    if (over.length) out.push(`You have ${over.length} unfinished task${over.length > 1 ? 's' : ''} from earlier days. Pick one small one to finish first, or move it to today.`);
    if (!todays.length) out.push('Start your day by choosing up to three priorities. Small, clear goals are easier to finish.');
    else if (pri.length === 3 && pri.every(x => x.done)) out.push('All three priorities are done. Well done! Take a moment to enjoy that.');
    const w = water();
    if (w && C.habitActive(w, t)) { const p = C.habitPct(S, t, w); if (p >= 1) out.push('💧 Water goal reached today. Great habit!'); else if (p < 0.5 && hour >= 14) out.push('Your water is a little low today. A glass now helps you stay on track.'); }
    let best = null; S.habits.filter(h => C.habitActive(h, t)).forEach(h => { const s = C.habitStreak(S, h, t); if (s >= 3 && (!best || s > best.s)) best = { h, s }; });
    if (best) out.push(`🔥 ${best.s}-day streak on ${best.h.name}. Keep it going!`);
    const ws = C.weekStart(t), done = LB.weekWorkouts(S, ws).length, goal = S.fitness.goals.weeklyWorkouts;
    if (goal > 0 && done < goal && S.fitness.workouts.length) out.push(`You have logged ${done} of ${goal} planned workouts this week. Even a short walk counts.`);
    const recent = S.journal.slice().sort((a, b) => b.ts - a.ts).slice(0, 3);
    if (recent.length === 3 && recent.reduce((a, j) => a + j.mood, 0) / 3 <= 2) out.push('Your last few journal entries feel low. Be kind to yourself: rest, a short walk or talking to someone you trust can help. If this continues, consider speaking to a health professional.');
    else if (!S.journal.some(j => j.date === t) && hour >= 18) out.push('A quick journal note before bed can help you unwind.');
    const tmr = C.allOccurrences(S, C.addDays(t, 1), C.addDays(t, 1)).filter(o => !o.cancelled);
    if (tmr.length) out.push(`📅 You have ${tmr.length} appointment${tmr.length > 1 ? 's' : ''} tomorrow. Check your reminders are set.`);
    if (!out.length) out.push('Add a task, habit or appointment and suggestions will appear here based on what you record.');
    return out.slice(0, 3);
  };
  const tipsHtml = () => '<section class="card" aria-labelledby="tipH"><h2 id="tipH">💡 Suggestions</h2>' + LB.tips().map(x => '<p class="tip">' + esc(x) + '</p>').join('') + '<p class="muted small">General wellbeing ideas only, not medical advice.</p></section>';

  /* ---------- tasks ---------- */
  function taskRow(t, o) {
    o = o || {};
    if (LB.ui.editTask === t.id) return `<form class="task" data-s="saveTask" data-id="${t.id}"><label class="sr" for="et">Task title</label><input type="text" id="et" name="title" value="${esc(t.title)}" maxlength="120" required>
      <label class="sr" for="ed">Task date</label><input type="date" id="ed" name="date" value="${t.date}" required style="max-width:170px"><button class="btn sm">Save</button><button type="button" class="btn alt sm" data-a="cancelEditTask">Cancel</button></form>`;
    return `<div class="task ${t.done ? 'done' : ''}"><button type="button" class="chk" data-a="toggleTask" data-id="${t.id}" aria-pressed="${t.done}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.title)}">${t.done ? '✓' : ''}</button>
      <span class="t">${t.priority ? '⭐ ' : ''}${esc(t.title)}${o.showDate ? ' <span class="badge warn">' + LB.fmtDate(t.date) + '</span>' : ''}</span>
      <span class="acts">${o.move ? `<button type="button" class="btn alt sm" data-a="moveTask" data-id="${t.id}">Move to today</button>` : ''}
      <button type="button" class="btn alt sm" data-a="togglePri" data-id="${t.id}" aria-pressed="${t.priority}" aria-label="${t.priority ? 'Remove priority' : 'Make priority'}: ${esc(t.title)}">${t.priority ? '★' : '☆'}</button>
      <button type="button" class="btn alt sm" data-a="editTask" data-id="${t.id}" aria-label="Edit ${esc(t.title)}">Edit</button>
      <button type="button" class="btn danger sm" data-a="delTask" data-id="${t.id}" aria-label="Delete ${esc(t.title)}">Delete</button></span></div>`;
  }
  const findTask = id => LB.S.tasks.find(t => t.id === id);
  const priCount = (d, exceptId) => LB.S.tasks.filter(t => t.date === d && t.priority && t.id !== exceptId).length;
  A.toggleTask = el => { const t = findTask(el.dataset.id); if (t) { t.done = !t.done; LB.save(); } };
  A.togglePri = el => {
    const t = findTask(el.dataset.id); if (!t) return;
    if (!t.priority && priCount(t.date, t.id) >= 3) { LB.toast('You already have 3 priorities for that day. Remove one first.'); return false; }
    t.priority = !t.priority; LB.save();
  };
  A.editTask = el => { LB.ui.editTask = el.dataset.id; LB.ui.focus = '#et'; };
  A.cancelEditTask = () => { LB.ui.editTask = null; };
  A.delTask = el => LB.remove(() => LB.S.tasks, el.dataset.id, 'Task');
  A.moveTask = el => { const t = findTask(el.dataset.id); if (t) { t.date = LB.today(); if (t.priority && priCount(t.date, t.id) >= 3) t.priority = false; LB.save(); } };
  SB.saveTask = f => {
    const t = findTask(f.dataset.id), title = f.title.value.trim(); if (!t || !title) return false;
    t.title = title.slice(0, 120); if (C.isDate(f.date.value)) t.date = f.date.value;
    if (t.priority && priCount(t.date, t.id) >= 3) { t.priority = false; LB.toast('That day already had 3 priorities, so this task is no longer a priority.'); }
    LB.ui.editTask = null; LB.save();
  };
  SB.addTask = f => {
    const title = f.title.value.trim(), t = LB.today(); if (!title) return false;
    const pri = f.dataset.pri === '1';
    if (pri && priCount(t) >= 3) return false;
    LB.S.tasks.push({ id: C.uid(), title: title.slice(0, 120), date: t, done: false, priority: pri }); LB.save();
    LB.ui.focus = pri ? '#priTitle' : '#taskTitle';
  };

  function countdown(ms) {
    if (ms <= 0) return 'Happening now';
    const m = Math.round(ms / 6e4); if (m < 60) return 'Starts in ' + m + ' minute' + (m === 1 ? '' : 's');
    const hr = Math.floor(m / 60); if (hr < 24) return 'Starts in ' + hr + ' hour' + (hr === 1 ? '' : 's') + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    const d = Math.round(ms / 864e5); return 'Starts in ' + d + ' day' + (d === 1 ? '' : 's');
  }
  A.quickAdd = async () => {
    const v = await LB.ask({ title: 'Add…', body: '<p class="small muted">What would you like to add?</p>', buttons: [
      { label: '📅 Appointment', value: 'event' }, { label: '💪 Log workout', value: 'workout' }, { label: '🍽️ Add meal', value: 'meal' }, { label: '📝 Task', value: 'task' }, { label: 'Cancel', value: null, cls: 'alt' }] });
    if (v === 'event') { LB.actions.newEvent(); LB.ui.tab = 'events'; LB.render(true); }
    else if (v === 'workout') { LB.ui.wtab = 'fitness'; LB.ui.focus = '#wk-type'; LB.go('wellness'); }
    else if (v === 'meal') { LB.ui.wtab = 'food'; LB.ui.ftab = 'diary'; LB.ui.focus = '#fd-name'; LB.go('wellness'); }
    else if (v === 'task') { LB.ui.focus = '#taskTitle'; LB.render(); }
    return false;
  };

  V.today = function () {
    const S = LB.S, t = LB.today(), todays = C.dayTasks(S, t), pri = todays.filter(x => x.priority), other = todays.filter(x => !x.priority);
    const over = C.overdueTasks(S, t), hp = C.dayHabitPct(S, t), w = water();
    const up = C.allOccurrences(S, t, C.addDays(t, 7)).filter(o => !o.cancelled).slice(0, 4);
    const wk = S.fitness.workouts.filter(x => x.date === t), meals = S.food.diary[t] || [];
    const hist = [...new Set(S.tasks.filter(x => x.date < t).map(x => x.date))].sort().reverse().slice(0, 30);
    let h = `<h2>${LB.fmtDate(t, true)}</h2>`;
    h += `<button type="button" class="btn big" data-a="quickAdd" aria-haspopup="dialog" style="margin-bottom:14px">➕ Add</button>`;
    h += `<p class="small muted" id="remNote" role="status">🔔 ${esc(LB.rem && LB.rem.deliveryNote ? LB.rem.deliveryNote() : '')} <button type="button" class="btn alt sm" data-a="openSettings">Reminder settings</button></p>`;
    const nowMs = Date.now(), nxt = C.allOccurrences(S, t, C.addDays(t, 120)).filter(o => !o.cancelled && C.startInstant(o) > nowMs - 36e5).sort((a, b) => C.startInstant(a) - C.startInstant(b))[0];
    h += `<section class="card star" aria-labelledby="nxH"><h2 id="nxH">📅 Next appointment</h2>`;
    h += nxt ? LB.occRow(nxt, { compact: true }) + `<p class="small muted">${esc(countdown(C.startInstant(nxt) - nowMs))}</p>` : LB.empty('📅', 'No appointments coming up', 'Add one and choose reminders so you never miss it.', '<button type="button" class="btn" data-a="newEvent">Add appointment</button>');
    h += '</section>';
    if (over.length) h += `<section class="card" aria-labelledby="ovH"><h2 id="ovH">⏰ Overdue tasks <span class="badge warn">${over.length}</span></h2>${over.map(x => taskRow(x, { move: true, showDate: true })).join('')}</section>`;
    h += tipsHtml();
    h += `<div class="grid2"><section class="card star" aria-labelledby="priH"><h2 id="priH">⭐ Top 3 priorities <span class="badge">${pri.length}/3</span></h2>`;
    h += pri.length ? pri.map(x => taskRow(x)).join('') : LB.empty('⭐', 'No priorities yet', 'Pick up to three things that matter most today.');
    h += pri.length < 3 ? `<form class="task" data-s="addTask" data-pri="1"><label class="sr" for="priTitle">New priority</label><input type="text" id="priTitle" name="title" placeholder="Add a priority" maxlength="120" required><button class="btn">Add</button></form>` : '<p class="muted small">All three slots are used.</p>';
    h += `</section><section class="card" aria-labelledby="tkH"><h2 id="tkH">📝 Other tasks</h2>`;
    h += other.length ? other.map(x => taskRow(x)).join('') : LB.empty('📝', 'Nothing else planned', 'Add a task below, or enjoy a lighter day.');
    h += `<form class="task" data-s="addTask"><label class="sr" for="taskTitle">New task</label><input type="text" id="taskTitle" name="title" placeholder="Add a task" maxlength="120" required><button class="btn">Add</button></form></section></div>`;
    h += `<section class="card" aria-labelledby="upH"><h2 id="upH">📅 Upcoming appointments</h2>`;
    h += up.length ? up.map(o => LB.occRow(o, { compact: true })).join('') + `<button type="button" class="btn alt sm" data-a="go" data-arg="events">See all events</button>` : LB.empty('📅', 'No appointments this week', 'Add one and set reminders so you never miss it.', '<button type="button" class="btn" data-a="newEvent">Add appointment</button>');
    const planned = S.fitness.plan.filter(p => p.day === C.dayOfWeek(t)), mp = S.food.plan[t] || {}, M = window.LBMeals, byId = id => M && M.LIB.concat(S.food.custom).find(x => x.id === id);
    const doneTypes = null, wc = w && C.habitActive(w, t);
    h += `</section><section class="card" aria-labelledby="tdH"><h2 id="tdH">🗓️ Today's plan</h2>`;
    h += planned.length ? planned.map(p => `<div class="task"><span class="t">${esc(p.name || p.type)}${p.minutes ? ' · ' + p.minutes + ' min' : ''}${p.time ? ' · ' + esc(p.time) : ''}</span><span class="acts">${wk.some(x => x.planId === p.id) ? '<span class="badge ok">Done</span>' : `<button type="button" class="btn sm" data-a="logPlanned" data-id="${p.id}">Mark done</button>`}</span></div>`).join('') : '<p class="muted small">No workout planned today. <button type="button" class="btn alt sm" data-a="goWellness" data-arg="fitness">Plan one</button></p>';
    const ml = Object.keys(mp).map(s => { const m = byId(mp[s]); return m ? `<li><b>${esc(s)}</b>: ${esc(m.name)}</li>` : ''; }).join('');
    h += ml ? `<h3>Planned meals</h3><ul class="small">${ml}</ul>` : '<p class="muted small">No meals planned today. <button type="button" class="btn alt sm" data-a="goWellness" data-arg="food">Plan meals</button></p>';
    if (wc) h += `<h3>Water</h3><div class="row"><button type="button" class="btn alt" data-a="waterStep" data-key="${t}" data-arg="-1" aria-label="Remove one ${esc(w.unit)} of water">−</button><b aria-live="polite">${LB.num(C.habitValue(S, t, w))} / ${LB.num(C.goalOn(w, t))} ${esc(w.unit)}</b><button type="button" class="btn" data-a="waterStep" data-key="${t}" data-arg="1" aria-label="Add one ${esc(w.unit)} of water">＋</button></div>`;
    h += `</section><section class="card" aria-labelledby="wlH"><h2 id="wlH">💪 Wellness today</h2><div class="stats">
      <div class="stat"><b>${wk.length}</b>workout${wk.length === 1 ? '' : 's'}${wk.length ? ' · ' + wk.reduce((a, x) => a + x.minutes, 0) + ' min' : ''}</div>
      <div class="stat"><b>${meals.length}</b>meal${meals.length === 1 ? '' : 's'} logged</div>
      <div class="stat"><b>${w && C.habitActive(w, t) ? LB.num(C.habitValue(S, t, w)) + '/' + LB.num(C.goalOn(w, t)) : '–'}</b>water (${w ? esc(w.unit) : ''})</div>
      <div class="stat"><b>${hp == null ? '–' : LB.pct(hp) + '%'}</b>habit progress</div></div>
      <p><button type="button" class="btn alt sm" data-a="goWellness" data-arg="fitness">Fitness</button> <button type="button" class="btn alt sm" data-a="goWellness" data-arg="food">Food</button> <button type="button" class="btn alt sm" data-a="go" data-arg="habits">Habits</button></p></section>`;
    h += `<details class="card"><summary>🗂️ Task history (${hist.length} earlier day${hist.length === 1 ? '' : 's'})</summary>`;
    h += hist.length ? hist.map(d => { const a = S.tasks.filter(x => x.date === d); return `<div class="dayhead">${LB.fmtDate(d)} · ${a.filter(x => x.done).length}/${a.length} done</div>` + a.map(x => taskRow(x, { move: !x.done })).join(''); }).join('') : '<p class="muted">Tasks from earlier days will appear here.</p>';
    return h + '</details>';
  };
  A.goWellness = el => { LB.ui.wtab = el.dataset.arg; LB.go('wellness'); return false; };

  /* ---------- habits ---------- */
  A.habitStep = el => {
    const S = LB.S, h = S.habits.find(x => x.id === el.dataset.id), d = LB.ui.habitDate || LB.today(); if (!h) return;
    const cur = C.habitManual(S, d, h), nv = Math.max(0, Math.round((cur + (+el.dataset.arg) * h.step) * 100) / 100);
    (S.logs[d] = S.logs[d] || {})[h.id] = nv; LB.save(); LB.ui.focus = `[data-a=habitStep][data-id="${h.id}"][data-arg="${el.dataset.arg}"]`;
  };
  A.editHabit = el => { LB.ui.editHabit = el.dataset.id; LB.ui.focus = '#hg'; };
  A.cancelHabit = () => { LB.ui.editHabit = null; };
  SB.saveHabit = f => {
    const h = LB.S.habits.find(x => x.id === f.dataset.id), goal = parseFloat(f.goal.value), step = parseFloat(f.step.value), t = LB.today();
    if (!h || !(goal > 0) || !(step > 0)) { LB.toast('Goal and step must be greater than zero.'); return false; }
    if (!h.builtin && f.hname && f.hname.value.trim()) h.name = f.hname.value.trim().slice(0, 30);
    if (goal !== C.goalOn(h, t)) { h.goalHistory = h.goalHistory.filter(e => e.from !== t); h.goalHistory.push({ from: t, goal }); }
    h.goal = goal; h.step = step; LB.ui.editHabit = null; LB.save(); LB.toast('Saved. The new goal applies from today; earlier days keep their old goal.');
  };
  SB.addHabit = f => {
    const name = f.hname.value.trim(), goal = parseFloat(f.goal.value), step = parseFloat(f.step.value) || 1, t = LB.today(); if (!name || !(goal > 0)) return false;
    LB.S.habits.push({ id: 'h' + C.uid(), name: name.slice(0, 30), icon: (f.icon.value.trim() || '⭐').slice(0, 4), unit: f.unit.value.trim().slice(0, 15) || 'times', goal, step, color: COLORS[LB.S.habits.length % COLORS.length], builtin: false, createdAt: t, archivedAt: '', goalHistory: [{ from: t, goal }] });
    LB.save(); LB.toast('Habit added.');
  };
  A.removeHabit = el => {
    const h = LB.S.habits.find(x => x.id === el.dataset.id); if (!h || h.builtin) return;
    h.archivedAt = LB.today(); LB.save(); LB.toast(h.name + ' removed. History is kept.', () => { h.archivedAt = ''; LB.save(); });
  };
  A.restoreHabit = el => { const h = LB.S.habits.find(x => x.id === el.dataset.id); if (h) { h.archivedAt = ''; LB.save(); } };
  LB.changes.habitDate = el => { LB.ui.habitDate = C.isDate(el.value) && el.value <= LB.today() ? el.value : null; };
  A.habitToday = () => { LB.ui.habitDate = null; };

  V.habits = function () {
    const S = LB.S, t = LB.today(), d = LB.ui.habitDate || t, act = S.habits.filter(h => C.habitActive(h, d)), gone = S.habits.filter(h => !h.builtin && h.archivedAt && h.archivedAt <= t);
    const avg = C.dayHabitPct(S, d);
    let h = `<h2>Habits</h2><div class="card"><div class="row"><div class="grow"><label for="hd">Date</label><input type="date" id="hd" value="${d}" max="${t}" data-c="habitDate"></div>${d !== t ? '<button type="button" class="btn alt" data-a="habitToday">Back to today</button>' : ''}</div>
      <p class="muted">Average habit progress for ${d === t ? 'today' : LB.fmtDate(d)}: <b>${avg == null ? 'no habits that day' : LB.pct(avg) + '%'}</b>. Each day uses the goals and habits that applied then.</p></div>`;
    if (!act.length) h += `<div class="card">${LB.empty('✅', 'No habits for this date', 'Habits you add start counting from the day they were created.')}</div>`;
    h += act.map(x => {
      const val = C.habitValue(S, d, x), goal = C.goalOn(x, d), p = Math.min(1, val / goal), der = x.id === 'walk' || x.id === 'exercise' ? C.workoutMinutes(S, d, x.id) : 0, st = C.habitStreak(S, x, t);
      if (LB.ui.editHabit === x.id) return `<form class="card" data-s="saveHabit" data-id="${x.id}"><h3>${x.icon} Edit ${esc(x.name)}</h3>
        ${x.builtin ? '' : `<div class="field"><label for="hn">Name</label><input type="text" id="hn" name="hname" value="${esc(x.name)}" maxlength="30"></div>`}
        <div class="row"><div class="grow"><label for="hg">Daily goal (${esc(x.unit)})</label><input type="number" id="hg" name="goal" value="${C.goalOn(x, t)}" min="0.1" step="any" required></div><div class="grow"><label for="hs">Step per tap</label><input type="number" id="hs" name="step" value="${x.step}" min="0.1" step="any" required></div></div>
        <p class="muted small">A new goal applies from today. Earlier days keep their old goal.</p><div class="row"><button class="btn">Save</button><button type="button" class="btn alt" data-a="cancelHabit">Cancel</button></div></form>`;
      return `<section class="card habit" aria-label="${esc(x.name)}"><div class="head"><h3>${x.icon} ${esc(x.name)}</h3><span class="badge">${st ? '🔥 ' + st + ' day' + (st > 1 ? 's' : '') : 'No streak yet'}</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${LB.pct(p)}" aria-label="${esc(x.name)} progress"><i style="width:${LB.pct(p)}%;background:${x.color}"></i></div>
        <div class="stepper"><button type="button" class="btn alt" data-a="habitStep" data-id="${x.id}" data-arg="-1" aria-label="Decrease ${esc(x.name)}">−</button><output aria-live="polite">${LB.num(val)} / ${LB.num(goal)} ${esc(x.unit)}</output><button type="button" class="btn" data-a="habitStep" data-id="${x.id}" data-arg="1" aria-label="Increase ${esc(x.name)}">+</button></div>
        ${der ? `<p class="muted small">Includes ${LB.num(der)} min from logged workouts (so nothing is counted twice).</p>` : ''}
        <div class="row"><button type="button" class="btn alt sm" data-a="editHabit" data-id="${x.id}">Edit goal</button>${x.builtin ? '' : `<button type="button" class="btn danger sm" data-a="removeHabit" data-id="${x.id}">Remove</button>`}</div></section>`;
    }).join('');
    h += `<form class="card" data-s="addHabit"><h3>➕ Add a custom habit</h3><div class="row"><div class="grow"><label for="nn">Name</label><input type="text" id="nn" name="hname" maxlength="30" required placeholder="e.g. Meditate"></div><div class="grow"><label for="ni">Emoji</label><input type="text" id="ni" name="icon" maxlength="4" placeholder="🧘"></div></div>
      <div class="row"><div class="grow"><label for="nu">Unit</label><input type="text" id="nu" name="unit" maxlength="15" placeholder="minutes"></div><div class="grow"><label for="ng">Daily goal</label><input type="number" id="ng" name="goal" min="0.1" step="any" required></div><div class="grow"><label for="ns">Step per tap</label><input type="number" id="ns" name="step" min="0.1" step="any" value="1"></div></div><button class="btn">Add habit</button></form>`;
    if (gone.length) h += `<details class="card"><summary>Removed habits (${gone.length})</summary>${gone.map(x => `<div class="row sp"><span>${x.icon} ${esc(x.name)}</span><button type="button" class="btn alt sm" data-a="restoreHabit" data-id="${x.id}">Restore</button></div>`).join('')}</details>`;
    return h;
  };

  /* ---------- journal ---------- */
  A.draftMood = el => { LB.S.draft.mood = +el.dataset.arg; LB.persist(); };
  LB.inputs.draftNote = el => { LB.S.draft.note = el.value.slice(0, 2000); LB.persist(); const s = document.getElementById('draftState'); if (s) s.textContent = '🔒 Private: stored only on this device. Draft saved automatically.'; };
  SB.saveEntry = f => {
    const S = LB.S; if (!S.draft.mood) { LB.toast('Choose a mood first.'); return false; }
    S.journal.push({ id: C.uid(), date: LB.today(), ts: Date.now(), mood: S.draft.mood, note: f.note.value.trim().slice(0, 2000) });
    S.draft = { mood: null, note: '' }; LB.save(); LB.toast('Journal entry saved.');
  };
  A.delEntry = el => LB.remove(() => LB.S.journal, el.dataset.id, 'Journal entry');
  V.journal = function () {
    const S = LB.S, d = S.draft, es = S.journal.slice().sort((a, b) => b.ts - a.ts);
    let h = `<h2>Mood journal</h2><form class="card" data-s="saveEntry"><h3 id="mh">How are you feeling?</h3><div class="moods" role="group" aria-labelledby="mh">${MOODS.map(m => `<button type="button" data-a="draftMood" data-arg="${m[0]}" aria-pressed="${d.mood === m[0]}"><span aria-hidden="true">${m[1]}</span><small>${m[2]}</small></button>`).join('')}</div>
      <div class="field" style="margin-top:12px"><label for="note">Private note (optional)</label><textarea id="note" name="note" maxlength="2000" data-i="draftNote" placeholder="What's on your mind?">${esc(d.note)}</textarea></div>
      <p class="muted small" id="draftState">🔒 Private: stored only on this device. ${d.note || d.mood ? 'Your draft is saved automatically.' : ''}</p><button class="btn">Save entry</button></form>`;
    h += '<section class="card" aria-labelledby="eh"><h2 id="eh">Past entries</h2>';
    h += es.length ? es.map(j => `<div class="entry"><div class="row sp"><b>${MOODS[j.mood - 1][1]} ${MOODS[j.mood - 1][2]} · ${LB.fmtDate(j.date)}</b><button type="button" class="btn danger sm" data-a="delEntry" data-id="${j.id}" aria-label="Delete entry from ${LB.fmtDate(j.date)}">Delete</button></div>${j.note ? `<p>${esc(j.note)}</p>` : ''}</div>`).join('') : LB.empty('📔', 'No entries yet', 'Pick a mood above and add a note if you like.');
    return h + '</section>';
  };

  /* ---------- progress ---------- */
  function bars(vals, labels, max, color, label, fmt) {
    const W = 350, H = 170, bw = 32, gap = (W - 7 * bw) / 8;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><line x1="0" y1="140" x2="${W}" y2="140" stroke="#b9b2e6"/>`;
    vals.forEach((v, i) => {
      const x = gap + i * (bw + gap), hh = v == null ? 0 : Math.max(2, Math.round(v / max * 110));
      s += `<rect x="${x}" y="${140 - hh}" width="${bw}" height="${hh}" rx="6" fill="${color}"/><text x="${x + bw / 2}" y="${v == null ? 135 : 134 - hh}" text-anchor="middle">${v == null ? '–' : fmt(v)}</text><text x="${x + bw / 2}" y="158" text-anchor="middle">${labels[i]}</text>`;
    });
    return s + '</svg>';
  }
  A.weekMove = el => { LB.ui.weekOff = Math.min(0, (LB.ui.weekOff || 0) + (+el.dataset.arg)); };
  V.progress = function () {
    const S = LB.S, t = LB.today(), off = LB.ui.weekOff || 0, ws = C.addDays(C.weekStart(t), off * 7), days = Array.from({ length: 7 }, (_, i) => C.addDays(ws, i));
    const lbl = days.map(d => ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][(C.dayOfWeek(d) + 6) % 7] + ' ' + d.slice(8));
    const done = days.map(d => C.dayTasks(S, d).filter(x => x.done).length), tot = days.map(d => C.dayTasks(S, d).length);
    const hp = days.map(d => d > t ? null : C.dayHabitPct(S, d)), mood = days.map(d => { const e = C.dayEntries(S, d); return e.length ? e.reduce((a, x) => a + x.mood, 0) / e.length : null; });
    const hv = hp.filter(v => v != null), mv = mood.filter(v => v != null);
    const maxT = Math.max(3, ...done, ...tot);
    let h = `<h2>Weekly progress</h2><div class="card row sp"><button type="button" class="btn alt" data-a="weekMove" data-arg="-1">◀ Previous</button><b>${LB.fmtDate(ws)} – ${LB.fmtDate(days[6])}</b><button type="button" class="btn alt" data-a="weekMove" data-arg="1" ${off >= 0 ? 'disabled' : ''}>Next ▶</button></div>`;
    h += `<div class="card"><div class="stats"><div class="stat"><b>${done.reduce((a, b) => a + b, 0)}/${tot.reduce((a, b) => a + b, 0)}</b>tasks completed</div><div class="stat"><b>${hv.length ? LB.pct(hv.reduce((a, b) => a + b, 0) / hv.length) + '%' : '–'}</b>Average habit progress (%)</div>
      <div class="stat"><b>${mv.length ? (mv.reduce((a, b) => a + b, 0) / mv.length).toFixed(1) : '–'}</b>average mood (1–5)</div><div class="stat"><b>${C.activeStreak(S, t)}</b>day activity streak</div></div></div>`;
    h += `<div class="grid2"><section class="card"><h3>Tasks completed</h3>${bars(done, lbl, maxT, '#6c4cf1', 'Tasks completed per day', v => v)}</section>
      <section class="card"><h3>Average habit progress (%)</h3>${bars(hp, lbl, 1, '#0e9f8e', 'Average habit progress per day, percent', v => LB.pct(v))}<p class="muted small">Average of each habit's progress that day, using that day's goals. "–" means no data.</p></section>
      <section class="card"><h3>Mood</h3>${bars(mood, lbl, 5, '#c2255c', 'Average mood per day out of 5', v => v.toFixed(1).replace('.0', ''))}</section>
      <section class="card"><h3>Habit streaks</h3>${S.habits.filter(x => C.habitActive(x, t)).map(x => { const s = C.habitStreak(S, x, t); return `<div class="row sp"><span>${x.icon} ${esc(x.name)}</span><b>${s ? '🔥 ' + s + ' day' + (s > 1 ? 's' : '') : '–'}</b></div>`; }).join('')}</section></div>`;
    h += `<details class="card"><summary>View chart data as a table</summary><div style="overflow:auto"><table><caption class="sr">Weekly data</caption><thead><tr><th scope="col">Day</th><th scope="col">Tasks done</th><th scope="col">Habit progress</th><th scope="col">Mood</th></tr></thead><tbody>${days.map((d, i) => `<tr><th scope="row">${LB.fmtDate(d)}</th><td>${done[i]}/${tot[i]}</td><td>${hp[i] == null ? '–' : LB.pct(hp[i]) + '%'}</td><td>${mood[i] == null ? '–' : mood[i].toFixed(1)}</td></tr>`).join('')}</tbody></table></div></details>`;
    h += `<section class="card"><h2>🏆 Achievements</h2><p class="muted small">Once earned, achievements are kept.</p><div class="ach">${C.ACHIEVEMENTS.map(a => { const on = S.achievements[a.id]; return `<div class="${on ? 'on' : ''}"><b>${a.icon} ${esc(a.name)}</b><br><span class="small">${esc(a.desc)}</span><br><span class="small ${on ? '' : 'muted'}">${on ? 'Earned ' + LB.fmtDate(on, true) : 'Not yet earned'}</span></div>`; }).join('')}</div></section>`;
    return h;
  };
})();
