/* Three independent, progressive-enhancement article interactives. No dependencies. */
(() => {
  const choice = document.querySelector('[data-restaurant-picker]');
  if (choice) {
    const responses = {
      orders: 'Start by making your ordering information easier to find. Check menus, mobile ordering, checkout, and how new orders reach the kitchen before buying another system.',
      bookings: 'Start with a simple reservation or enquiry flow, instant confirmation, and clear ownership of missed calls. Connect it to your existing tools where possible.',
      customers: 'Make your Google Business Profile, hours, menu, and contact details accurate first. Then collect reviews ethically and give returning guests an easy path back.',
      staff: 'List where your team retypes information. One reliable hand-off between bookings, orders, and the right people may save more confusion than a giant new dashboard.'
    };
    const buttons = [...choice.querySelectorAll('button[data-pain]')];
    const output = choice.querySelector('[data-picker-result]');
    buttons.forEach(button => button.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      if (output) output.textContent = responses[button.dataset.pain] || '';
    }));
  }
  const scope = document.querySelector('[data-scope-builder]');
  if (scope) {
    const list = [...scope.querySelectorAll('input[type=checkbox]')];
    const out = scope.querySelector('[data-scope-result]');
    function updateScope() {
      const selected = list.filter(x => x.checked).map(x => x.dataset.need);
      if (out) out.textContent = selected.length
        ? 'Your starting brief: We need a practical website tool that helps with ' + selected.join(', ') + '. We should first agree on users, the information it needs, and one useful first version.'
        : 'Choose the tasks that matter most. A short, clear problem statement is enough to begin a software conversation.';
    }
    list.forEach(el => el.addEventListener('change', updateScope));
    updateScope();
  }
  const checklist = document.querySelector('[data-launch-checklist]');
  if (checklist) {
    const checks = [...checklist.querySelectorAll('input[type=checkbox]')];
    const progress = checklist.querySelector('[data-launch-progress]');
    const status = checklist.querySelector('[data-launch-status]');
    function update() {
      const done = checks.filter(c => c.checked).length;
      if (progress) progress.style.width = (100 * done / Math.max(1, checks.length)) + '%';
      if (status) status.textContent = done + ' of ' + checks.length + ' steps ready' + (done === checks.length ? ' — you are ready for a final review!' : '');
    }
    checks.forEach(input => input.addEventListener('change', update));
    update();
  }
})();