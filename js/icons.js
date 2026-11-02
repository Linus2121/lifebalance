/* Line icons and logo mark for the premium design. LB.svg('calendar') returns an inline <svg>; LB.catSvg(category) picks the category icon. */
(function () {
  const LB = window.LB;
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M11 12.5v2h2v-2"/>',
    grid: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    right: '<path d="m9 5 7 7-7 7"/>', left: '<path d="m15 5-7 7 7 7"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
    tick: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
    pulse: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path d="M6.5 12h3l1.5-2.5 2 5 1.5-2.5h3"/>',
    drop: '<path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    steth: '<path d="M6 3.5v5a4 4 0 0 0 8 0v-5"/><path d="M10 12.5v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="10.5" r="2"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.2a4.5 4.5 0 0 1 5.5 4.3"/>',
    plane: '<path d="M10.5 13.5 4 11l1.5-1.5 7 1 4.2-4.2a1.8 1.8 0 0 1 2.5 2.5L15 13l1 7-1.5 1.5-2.5-6.5-3 3V20l-1.5 1-1-3-3-1L4 15.5h2l3-3"/>',
    thumbtack: '<path d="M9 3.5h6l-1 5 3 3H7l3-3z"/><path d="M12 11.5V21"/>',
    school: '<path d="m2.5 9 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5"/>',
    hospital: '<rect x="4" y="4" width="16" height="17" rx="2.5"/><path d="M12 8v6M9 11h6M9.5 21v-3h5v3"/>',
    ring: '<circle cx="12" cy="14.5" r="5.5"/><path d="m9.5 9.5-1-3 3.5-3 3.5 3-1 3"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="m8 21 3-6 3 2.5V21M6 12l3-3.5 4 .5 2.5 3.5 3 .5M11 15 10 9"/>',
    flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9.5-1.5 2-2 3.5-2 5-1.5-1-2-2.5-2-4-2 2.5-4 5-4 8.5a6 6 0 0 0 6 6z"/>',
    dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    book: '<path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v12H8.5A3.5 3.5 0 0 1 5 16.5z"/><path d="M5 16.5A3.5 3.5 0 0 1 8.5 13H19"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    sparkle: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2-1.8 6.5-1.8-6.5L3.5 12l6.7-2z"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    beach: '<path d="M4 20.5h16M12 20.5 9 9.5"/><path d="M3.5 10.5A8.5 8.5 0 0 1 18.5 6z"/>'
  };
  const CAT = { General: 'thumbtack', School: 'school', GP: 'steth', Hospital: 'hospital', Meetings: 'users', Weddings: 'ring', Travel: 'plane', Work: 'briefcase', Other: 'folder' };
  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' +
    Object.entries(P).map(([k, v]) => '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + v + '</symbol>').join('') +
    '<linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#3D7BFF"/></linearGradient>' +
    '<linearGradient id="lg-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FACC15"/><stop offset=".55" stop-color="#34D399"/><stop offset="1" stop-color="#3D7BFF"/></linearGradient></svg>';
  if (typeof document !== 'undefined' && document.body && document.body.insertAdjacentHTML) document.body.insertAdjacentHTML('afterbegin', sprite);
  LB.svg = (name, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  LB.catSvg = (cat, cls) => LB.svg(CAT[cat] || 'thumbtack', cls);
  LB.catClass = cat => 'c-' + (CAT[cat] ? cat : 'General');
  // Brand name: white "Life" + electric-blue to cyan "Balance" (styled by .wordmark).
  LB.wordmark = () => '<span class="wordmark">Life<span>Balance</span></span>';
  // LifeBalance brand mark (vector copy of logo.png: ring with three linked dots); spins clockwise via CSS.
  LB.logoSvg = (size, cls) => '<svg class="logo' + (cls ? ' ' + cls : '') + '" viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false"><g fill="none" stroke="#D4FA39" stroke-linecap="round"><circle cx="24" cy="24" r="6.8" stroke-width="2.6"/><path d="M21.3 17.8 18.6 11.3M30.7 25.4l6.4 1.4M19.9 29.3l-4.6 5.6" stroke-width="2"/></g><g fill="#D4FA39"><circle cx="17.8" cy="8" r="3.4"/><circle cx="40.4" cy="27.4" r="3.4"/><circle cx="13.2" cy="37.4" r="3.4"/></g></svg>';
})();
