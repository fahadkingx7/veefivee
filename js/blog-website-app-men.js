/* veefivee — founder's website/app guide. Client-side only; no submissions or storage. */
(() => {
  "use strict";
  const choices = {
    presence: {
      title: "Start with a great website",
      detail: "A fast, mobile-friendly site with your services, testimonials, contact details and one easy next step. Add bookings or quotes when customers need them."
    },
    portal: {
      title: "Consider a simple web app",
      detail: "Start with one core workflow: a customer login, booking system, dashboard or quote generator. Test that journey before building extras."
    },
    mobile: {
      title: "Validate a phone-first product",
      detail: "Check whether a responsive web app can serve your users first. Build a native phone app if notifications, frequent usage or device features justify it."
    }
  };
  const picker = document.querySelector('.vf-build-picker');
  if (picker) {
    const buttons = [...picker.querySelectorAll('[data-build-choice]')];
    const title = document.querySelector('[data-build-result-title]');
    const detail = document.querySelector('[data-build-result-detail]');
    const update = value => {
      if (!choices[value]) return;
      buttons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.buildChoice === value)));
      if (title) title.textContent = choices[value].title;
      if (detail) detail.textContent = choices[value].detail;
    };
    buttons.forEach(btn => btn.addEventListener('click', () => update(btn.dataset.buildChoice)));
    update('presence');
  }
  const demo = document.querySelector('.vf-build-demo');
  if (demo) {
    const name = demo.querySelector('#build-name');
    const type = demo.querySelector('#build-type');
    const action = demo.querySelector('#build-action');
    const device = demo.querySelector('.vf-build-device');
    const brand = demo.querySelector('[data-build-brand]');
    const mode = demo.querySelector('[data-build-mode]');
    const headline = demo.querySelector('[data-build-headline]');
    const subline = demo.querySelector('[data-build-subline]');
    const button = demo.querySelector('[data-build-btn]');
    const presentations = {
      website: ['WEBSITE PREVIEW', 'Big ideas. Built beautifully.', 'A simpler way to connect with your next customer.'],
      portal: ['CUSTOM WEB APP', 'Everything in one place.', 'Log in, manage tasks, and get things done.'],
      app: ['MOBILE APP CONCEPT', 'Built for life on the go.', 'Your everyday tools, right in your pocket.']
    };
    const update = () => {
      const value = name?.value.trim().slice(0,42) || 'Your Business';
      const kind = type?.value in presentations ? type.value : 'website';
      const copy = presentations[kind];
      if (brand) brand.textContent = value;
      if (mode) mode.textContent = copy[0];
      if (headline) headline.textContent = copy[1];
      if (subline) subline.textContent = copy[2];
      if (button) button.textContent = (action?.value || 'Get started') + ' ↗';
      if (device) device.dataset.mode = kind;
    };
    [name,type,action].forEach(field => field?.addEventListener('input', update));
    update();
  }
  const checklist = document.querySelector('[data-build-checklist]');
  if (checklist) {
    const inputs = [...checklist.querySelectorAll('input[type=checkbox]')];
    const bar = checklist.querySelector('[data-build-progress]');
    const progress = checklist.querySelector('.vf-build-progress');
    const status = checklist.querySelector('[data-build-status]');
    const update = () => {
      const checked = inputs.reduce((total, input) => total + Number(input.checked), 0);
      const total = inputs.length;
      if (bar) bar.style.width = (checked / Math.max(1,total) * 100) + '%';
      if (progress) {progress.setAttribute('aria-valuemax', String(total));progress.setAttribute('aria-valuenow', String(checked));}
      if (status) status.textContent = checked === total ? "All steps checked! You're ready to talk through your first version." : checked + ' of ' + total + ' steps ready. Small steps count.';
    };
    inputs.forEach(input => input.addEventListener('change', update));
    update();
  }
})();
