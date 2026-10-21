/* veefivee store guide — no dependencies, no network calls, no stored input. */
(() => {
  const setup = document.querySelector('[data-store-preview]');
  if (setup) {
    const name = setup.querySelector('[data-product-name]');
    const price = setup.querySelector('[data-product-price]');
    const kind = setup.querySelector('[data-product-kind]');
    const outName = setup.querySelector('[data-preview-name]');
    const outPrice = setup.querySelector('[data-preview-price]');
    const outKind = setup.querySelector('[data-preview-kind]');
    const outIcon = setup.querySelector('[data-preview-icon]');
    const icons = { 'Handmade goods':'🕯️','Clothing & accessories':'👜','Beauty & self-care':'🧴','Art & stationery':'🎨','Home & gifts':'🎁','Other products':'✨' };
    const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
    const update = () => {
      if (outName) outName.textContent = name?.value.trim().slice(0,65) || 'Your amazing product';
      if (outPrice) outPrice.textContent = money.format(Math.max(0,Math.min(999999, Number(price?.value || 0))));
      if (outKind) outKind.textContent = kind?.value || 'Handmade goods';
      if (outIcon) outIcon.textContent = icons[kind?.value] || '✨';
    };
    [name,price,kind].forEach(field => field?.addEventListener('input',update,{passive:true}));
    update();
  }
  const checklist = document.querySelector('[data-store-checklist]');
  if (checklist) {
    const inputs = [...checklist.querySelectorAll('input[type="checkbox"]')];
    const fill = checklist.querySelector('[data-store-fill]');
    const status = checklist.querySelector('[data-store-status]');
    const update = () => {
      const checked = inputs.filter(x => x.checked).length;
      if (fill) fill.style.width = (100*checked/Math.max(1,inputs.length))+'%';
      if (status) status.textContent = checked===inputs.length
        ? 'All steps checked! You are ready to review your store before launch. ✨'
        : checked+' of '+inputs.length+' steps ready — you are making progress!';
    };
    inputs.forEach(input=>input.addEventListener('change',update));
    update();
  }
})();