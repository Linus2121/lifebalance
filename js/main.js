(function () {
  const LB = window.LB;
  // Applies LB.ui.focus (a selector) after each render, then clears it.
  LB.hooks.push(() => {
    const sel = LB.ui.focus; if (!sel) return; LB.ui.focus = null;
    const el = document.querySelector(sel); if (el) { el.focus({ preventScroll: false }); if (el.select && el.tagName === 'INPUT' && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
  });
  LB.start();
  LB.rem.init();
})();
