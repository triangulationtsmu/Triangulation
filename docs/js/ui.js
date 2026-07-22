// Small UI helpers: DOM building, toasts, modals, confirm dialogs.
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

let toastSeq = 0;
export function toast(message, type = 'info', timeout = 3200) {
  const root = document.getElementById('toast');
  if (!root) return;
  const id = ++toastSeq;
  const node = h('div', { class: `toast ${type}`, text: message, 'data-id': id });
  root.appendChild(node);
  setTimeout(() => node.remove(), timeout);
}

// Generic modal. content is a DOM node. Returns { close }.
export function openModal({ title, content, footer = [], width, onClose }) {
  const root = document.getElementById('modal-root');
  const backdrop = h('div', { class: 'modal-backdrop' });
  const modal = h('div', { class: 'modal' });
  if (width) modal.style.maxWidth = width;
  const closeBtn = h('button', { class: 'modal-close', text: 'დახურვა', onClick: () => close() });
  const head = h('div', { class: 'modal-head' }, [h('h2', { text: title || '' }), closeBtn]);
  const body = h('div', { class: 'modal-body' }, [content]);
  modal.appendChild(head); modal.appendChild(body);
  if (footer && footer.length) modal.appendChild(h('div', { class: 'modal-foot' }, footer));
  backdrop.appendChild(modal);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);
  root.appendChild(backdrop);
  function close() {
    document.removeEventListener('keydown', escHandler);
    backdrop.remove();
    if (onClose) onClose();
  }
  return { close, modal, body };
}

export function confirmDialog(message, { okText = 'დადასტურება', danger = true } = {}) {
  return new Promise((resolve) => {
    const okBtn = h('button', { class: danger ? 'bad' : '', text: okText });
    const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
    const m = openModal({
      title: 'დადასტურება',
      content: h('div', { text: message }),
      footer: [cancelBtn, okBtn],
      width: '460px',
      onClose: () => resolve(false),
    });
    okBtn.addEventListener('click', () => { m.close(); resolve(true); });
    cancelBtn.addEventListener('click', () => { m.close(); resolve(false); });
  });
}

// Guard against double-submit: disables the button while `fn` runs.
export function guardButton(btn, fn) {
  return async (...args) => {
    if (btn.disabled) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.dataset.orig = original;
    btn.textContent = '⏳ ' + original;
    try { return await fn(...args); }
    finally { btn.disabled = false; btn.textContent = btn.dataset.orig || original; }
  };
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
