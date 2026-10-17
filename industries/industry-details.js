// A single small progressive enhancement for the industry solution selector.
// The first option is fully readable without JavaScript.
(() => {
  for (const widget of document.querySelectorAll('[data-solution-picker]')) {
    const buttons = [...widget.querySelectorAll('[role="tab"]')];
    const heading = widget.querySelector('[data-result-title]');
    const body = widget.querySelector('[data-result-body]');
    const rec = widget.querySelector('[data-result-recommendation]');
    const panel = widget.querySelector('[role="tabpanel"]');
    const choose = (button, focus = false) => {
      buttons.forEach(b => {b.setAttribute('aria-selected', String(b===button)); b.tabIndex = b===button ? 0 : -1;});
      panel.setAttribute('aria-labelledby', button.id);
      heading.textContent = button.dataset.title;
      body.textContent = button.dataset.body;
      rec.textContent = button.dataset.recommendation;
      if (focus) button.focus();
    };
    for (const [i, button] of buttons.entries()) {
      button.addEventListener('click', () => choose(button));
      button.addEventListener('keydown', e => {
        const d = (e.key==='ArrowDown'||e.key==='ArrowRight') ? 1 : (e.key==='ArrowUp'||e.key==='ArrowLeft') ? -1 : 0;
        if (d) {e.preventDefault();choose(buttons[(i+d+buttons.length)%buttons.length], true);}
        if (e.key==='Home'||e.key==='End') {e.preventDefault();choose(buttons[e.key==='Home'?0:buttons.length-1],true);}
      });
    }
  }
})();
