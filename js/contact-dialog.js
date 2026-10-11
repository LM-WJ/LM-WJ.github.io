(() => {
  'use strict';
  const trigger = document.getElementById('wechat-contact');
  const dialog = document.getElementById('wechat-dialog');
  if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;
  trigger.addEventListener('click', event => {
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => trigger.focus());
})();
