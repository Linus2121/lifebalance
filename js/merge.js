/* Three-way merge for LifeBalance data (base = last synced copy, local = this device, remote = cloud).
   Rules: a change on only one side is taken. If both sides changed the same value, the local value is kept
   and the other value is recorded as a conflict so nothing is silently lost. Edit-vs-delete keeps the edited item.
   Lists of objects with an id are merged item by item; lists of plain values are merged as sets. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.LBMerge = factory(); })(typeof window !== 'undefined' ? window : globalThis, function () {
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const idList = a => Array.isArray(a) && a.length > 0 && a.every(x => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number'));
  const scalarList = a => Array.isArray(a) && a.every(x => x === null || typeof x !== 'object');
  const label = v => isObj(v) ? String(v.title || v.name || v.note || v.id || '').slice(0, 60) : '';

  function merge3(base, local, remote, opts) {
    const ignore = (opts && opts.ignore) || [], conflicts = [];
    const note = (path, mine, theirs, why) => conflicts.push({ path, mine, theirs, why });
    function val(path, b, l, r) {
      if (eq(l, r)) return l;
      if (eq(b, l)) return r;
      if (eq(b, r)) return l;
      if (ignore.includes(path[0])) return l;
      if (l === undefined || r === undefined) { const kept = l === undefined ? r : l; note(path, l, r, l === undefined ? 'deleted here, edited on another device' : 'edited here, deleted on another device'); return kept; }
      if (isObj(l) && isObj(r)) return obj(path, isObj(b) ? b : {}, l, r);
      if (Array.isArray(l) && Array.isArray(r)) {
        const bb = Array.isArray(b) ? b : [];
        if (idList(l) || idList(r) || (!l.length && idList(r)) || (!r.length && idList(l))) return list(path, bb, l, r);
        if (scalarList(l) && scalarList(r)) return set(bb, l, r);
      }
      note(path, l, r, 'changed on both devices'); return l;
    }
    function obj(path, b, l, r) {
      const out = {}, keys = [...new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(b)])];
      keys.forEach(k => { const v = val(path.concat(k), b[k], l[k], r[k]); if (v !== undefined) out[k] = v; });
      return out;
    }
    function set(b, l, r) {
      const bs = new Set(b.map(x => JSON.stringify(x))), ls = new Set(l.map(x => JSON.stringify(x))), rs = new Set(r.map(x => JSON.stringify(x)));
      const out = [];
      [...l, ...r].forEach(x => { const k = JSON.stringify(x); if (out.some(y => JSON.stringify(y) === k)) return; const removed = bs.has(k) && (!ls.has(k) || !rs.has(k)); if (!removed) out.push(x); });
      return out;
    }
    function list(path, b, l, r) {
      const bm = new Map(b.map(x => [x.id, x])), lm = new Map(l.map(x => [x.id, x])), rm = new Map(r.map(x => [x.id, x]));
      const out = [], order = [...l.map(x => x.id), ...r.filter(x => !lm.has(x.id)).map(x => x.id)];
      order.forEach(id => {
        const bi = bm.get(id), li = lm.get(id), ri = rm.get(id), p = path.concat('#' + id);
        if (li && ri) { out.push(val(p, bi, li, ri)); return; }
        const present = li || ri, isLocal = !!li;
        if (bi === undefined) { out.push(present); return; }
        if (eq(bi, present)) return; // deleted on one side, untouched on the other: delete
        note(p, isLocal ? li : undefined, isLocal ? undefined : ri, isLocal ? 'edited here, deleted on another device' : 'deleted here, edited on another device'); out.push(present);
      });
      return out;
    }
    return { merged: val([], base === undefined ? {} : base, local, remote), conflicts: conflicts.map(c => Object.assign(c, { path: c.path.join('/'), label: label(c.mine) || label(c.theirs) })) };
  }

  /* Applies "theirs" or "mine" for a recorded conflict to a state object. path segments starting with # address list items by id. */
  function setAt(state, path, value) {
    const segs = path.split('/'); let cur = state;
    for (let i = 0; i < segs.length - 1; i++) {
      const s = segs[i];
      if (s[0] === '#' && Array.isArray(cur)) { cur = cur.find(x => String(x.id) === s.slice(1)); } else cur = cur && cur[s];
      if (cur === undefined || cur === null) return false;
    }
    const last = segs[segs.length - 1];
    if (last[0] === '#' && Array.isArray(cur)) {
      const i = cur.findIndex(x => String(x.id) === last.slice(1));
      if (value === undefined) { if (i >= 0) cur.splice(i, 1); } else if (i >= 0) cur[i] = value; else cur.push(value);
    } else if (value === undefined) delete cur[last]; else cur[last] = value;
    return true;
  }
  return { merge3, setAt, eq };
});
