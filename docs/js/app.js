// =========================================================================
// app.js — Triangulation SPA: auth gate, router, and all authenticated views.
// =========================================================================
import * as api from './api.js';
import { h, toast, openModal, confirmDialog, guardButton, clear } from './ui.js';
import * as E from './engines.js';
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const state = {
  me: null,            // { uid, firstName, lastName, role, isAdmin, departmentId, active }
  departments: [],
  view: 'workspace',
};

const appRoot = () => document.getElementById('app');

// -------------------------------------------------------------------------
// session (localStorage — client-side auth, no Firebase Auth)
// -------------------------------------------------------------------------
const SESSION_KEY = 'triangulation_session';
function saveSession(p) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(p)); } catch (_) {} }
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; } }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (_) {} }

// -------------------------------------------------------------------------
// boot
// -------------------------------------------------------------------------
async function boot() {
  try { await api.ensureAdminSeed(); } catch (e) { console.warn('admin seed skipped:', e && e.message); }
  const sess = loadSession();
  if (!sess || !sess.uid) { renderLogin(); return; }
  try {
    const fresh = await api.fetchProfile(sess.uid);
    if (!fresh) { clearSession(); renderLogin(); return; }
    if (fresh.active === false) { clearSession(); renderLogin('თქვენი ანგარიში გათიშულია. მიმართეთ ადმინისტრატორს.'); return; }
    state.me = fresh;
    saveSession(fresh);
    state.departments = await safe(() => api.listDepartments(), []);
    renderApp();
  } catch (err) {
    console.error(err);
    clearSession();
    renderLogin('სესიის აღდგენა ვერ მოხერხდა. გთხოვთ, შეხვიდეთ თავიდან.');
  }
}
boot();

async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { console.error(e); return fallback; }
}

// -------------------------------------------------------------------------
// login page
// -------------------------------------------------------------------------
function renderLogin(message) {
  const root = appRoot();
  clear(root);
  const username = h('input', { type: 'text', id: 'li-user', autocomplete: 'username', placeholder: 'მომხმარებელი' });
  const password = h('input', { type: 'password', id: 'li-pass', autocomplete: 'current-password', placeholder: 'პაროლი' });
  const msg = h('div', { class: 'muted', style: 'min-height:20px;color:#b91c1c;font-weight:600', text: message || '' });
  const btn = h('button', { class: 'grow', text: 'შესვლა' });

  async function doLogin() {
    const u = username.value.trim(); const p = password.value;
    if (!u || !p) { msg.textContent = 'შეავსეთ მომხმარებელი და პაროლი.'; return; }
    msg.style.color = '#6b7280'; msg.textContent = 'მოწმდება…';
    try {
      const profile = await api.loginUser(u, p);
      saveSession(profile);
      state.me = profile;
      state.view = 'workspace';
      state.departments = await safe(() => api.listDepartments(), []);
      renderApp();
    } catch (e) {
      msg.style.color = '#b91c1c';
      msg.textContent = (e && e.message) ? e.message : 'შესვლა ვერ მოხერხდა.';
    }
  }
  const guarded = guardButton(btn, doLogin);
  btn.addEventListener('click', guarded);
  password.addEventListener('keydown', (e) => { if (e.key === 'Enter') guarded(); });

  const card = h('div', { class: 'card login-card' }, [
    h('div', { class: 'head' }, [
      h('h1', { text: 'ტრიანგულაციური მოდელი' }),
      h('div', { class: 'muted', text: 'შეფასების სისტემა — ავტორიზაცია' }),
    ]),
    h('div', { class: 'body stack' }, [
      h('div', { class: 'field' }, [h('label', { text: 'მომხმარებელი' }), username]),
      h('div', { class: 'field' }, [h('label', { text: 'პაროლი' }), password]),
      msg,
      h('div', { class: 'row' }, [btn]),
      h('div', { class: 'muted', style: 'font-size:13px',
        text: 'რეგისტრაცია დახურულია. ახალ მომხმარებელს ქმნის ადმინისტრატორი.' }),
    ]),
  ]);
  root.appendChild(h('div', { class: 'login-wrap' }, [card]));
}

// -------------------------------------------------------------------------
// app shell + nav
// -------------------------------------------------------------------------
function navItems() {
  const items = [{ id: 'workspace', label: 'სამუშაო სივრცე' }];
  if (state.me.isAdmin || state.me.role === 'department_head') {
    items.push({ id: 'students', label: 'სტუდენტები' });
  }
  if (state.me.isAdmin) {
    items.push({ id: 'departments', label: 'დეპარტამენტები' });
    items.push({ id: 'users', label: 'მომხმარებლები' });
    items.push({ id: 'uceem', label: 'UCEEM კამპანიები' });
    items.push({ id: 'uceemResults', label: 'UCEEM შედეგები' });
  }
  items.push({ id: 'profile', label: 'პროფილი' });
  return items;
}

function renderApp() {
  const root = appRoot();
  clear(root);
  const nav = h('div', { class: 'nav' },
    navItems().map((it) => h('button', {
      class: state.view === it.id ? 'active' : '',
      text: it.label,
      onClick: () => { state.view = it.id; renderView(); },
    })));
  const logout = h('button', { text: 'გასვლა', onClick: doLogout });
  const topbar = h('div', { class: 'topbar' }, [
    h('div', { class: 'wrap' }, [
      h('div', { class: 'brand', text: 'ტრიანგულაცია' }),
      nav,
      h('div', { class: 'who' }, [
        h('span', { text: `${state.me.firstName} ${state.me.lastName} · ${E.roleLabel(state.me.role)}${state.me.isAdmin ? ' · ადმინი' : ''}` }),
      ]),
      logout,
    ]),
  ]);
  const content = h('div', { class: 'wrap', id: 'view', style: 'padding-top:18px;padding-bottom:60px' });
  root.appendChild(topbar);
  root.appendChild(content);
  renderView();
}

function doLogout() {
  clearSession();
  state.me = null; state.view = 'workspace';
  renderLogin();
}

function setTopbarActive() {
  const nav = document.querySelector('.topbar .nav');
  if (!nav) return;
  const items = navItems();
  [...nav.children].forEach((b, i) => b.classList.toggle('active', items[i] && items[i].id === state.view));
}

function renderView() {
  setTopbarActive();
  const host = document.getElementById('view');
  if (!host) return renderApp();
  clear(host);
  const loading = h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']);
  host.appendChild(loading);
  const map = {
    workspace: viewWorkspace, students: viewStudents, departments: viewDepartments,
    users: viewUsers, uceem: viewUceem, uceemResults: viewUceemResults, profile: viewProfile,
  };
  const fn = map[state.view] || viewWorkspace;
  Promise.resolve(fn(host)).catch((e) => {
    console.error(e);
    clear(host);
    host.appendChild(h('div', { class: 'empty-note', text: 'ჩატვირთვისას მოხდა შეცდომა: ' + (e.message || e) }));
  });
}

function deptName(id) {
  const d = state.departments.find((x) => x.id === id);
  return d ? d.name : '—';
}
function deptOptions(includeAll = true, onlyActive = true) {
  const list = state.departments.filter((d) => (onlyActive ? d.active !== false : true));
  const opts = includeAll ? [{ value: '', label: 'ყველა დეპარტამენტი' }] : [{ value: '', label: 'აირჩიეთ დეპარტამენტი' }];
  return opts.concat(list.map((d) => ({ value: d.id, label: d.name })));
}
function selectEl(id, options, value = '') {
  const s = h('select', { id });
  options.forEach((o) => {
    const opt = h('option', { value: o.value, text: o.label });
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}
function academicYearOptions(startYear = new Date().getFullYear(), count = 12, includeAll = false) {
  const opts = includeAll ? [{ value: '', label: 'ყველა სასწავლო წელი' }] : [{ value: '', label: 'აირჩიეთ სასწავლო წელი' }];
  for (let y = startYear; y < startYear + count; y++) {
    opts.push({ value: `${y}(შ) - ${y}`, label: `${y}(შ) - ${y}` });
    opts.push({ value: `${y} - ${y + 1}`, label: `${y} - ${y + 1}` });
  }
  return opts;
}

// =========================================================================
// WORKSPACE  (dept -> year/semester -> group -> students -> eval buttons)
// =========================================================================
async function viewWorkspace(host) {
  clear(host);
  // Department: admins choose; others locked to own department.
  const canChooseDept = state.me.isAdmin;
  const deptSel = canChooseDept
    ? selectEl('ws-dept', deptOptions(false), state.me.departmentId || '')
    : null;
  const yearInput = selectEl('ws-year', academicYearOptions(new Date().getFullYear(), 12, true), '');
  const semSel = selectEl('ws-sem', [{ value: '', label: 'ყველა სემესტრი' }].concat(
    ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((s) => ({ value: s, label: s + ' სემესტრი' }))));
  const groupInput = h('input', { type: 'text', id: 'ws-group', placeholder: 'ჯგუფის ნომერი/დასახელება' });

  const listHost = h('div', { id: 'ws-list' }, [h('div', { class: 'empty-note', text: 'აირჩიეთ პარამეტრები და დააჭირეთ „სტუდენტების ჩვენებას“.' })]);

  const loadBtn = h('button', { text: 'სტუდენტების ჩვენება' });
  const loadGuarded = guardButton(loadBtn, async () => {
    const departmentId = canChooseDept ? deptSel.value : state.me.departmentId;
    if (!departmentId) { toast('აირჩიეთ დეპარტამენტი.', 'error'); return; }
    await loadWorkspaceStudents(listHost, {
      departmentId, group: groupInput.value.trim(),
      semester: semSel.value, academicYear: yearInput.value.trim(),
    });
  });
  loadBtn.addEventListener('click', loadGuarded);

  const adminUceemBtn = state.me.isAdmin
    ? h('button', { class: 'secondary', text: 'UCEEM ლინკის კოპირება', onClick: () => copyUceemLinkForContext(canChooseDept ? deptSel.value : state.me.departmentId) })
    : null;

  const filtersCard = h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'სამუშაო სივრცე' }),
      h('small', { class: 'muted', text: 'დეპარტამენტი → სასწავლო წელი/სემესტრი → ჯგუფი → სტუდენტები' })]),
    h('div', { class: 'body' }, [
      h('div', { class: 'filters' }, [
        canChooseDept ? h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), deptSel])
          : h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), h('input', { type: 'text', value: deptName(state.me.departmentId), disabled: 'true' })]),
        h('div', { class: 'field' }, [h('label', { text: 'სასწავლო წელი' }), yearInput]),
        h('div', { class: 'field' }, [h('label', { text: 'სემესტრი' }), semSel]),
        h('div', { class: 'field' }, [h('label', { text: 'ჯგუფი' }), groupInput]),
      ]),
      h('div', { class: 'row', style: 'margin-top:12px' }, [loadBtn, adminUceemBtn].filter(Boolean)),
    ]),
  ]);
  host.appendChild(filtersCard);
  host.appendChild(listHost);
}

async function loadWorkspaceStudents(listHost, { departmentId, group, semester, academicYear }) {
  clear(listHost);
  listHost.appendChild(h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' სტუდენტები იტვირთება…']));
  let students = await api.queryStudents({ departmentId, group: group || null });
  students = students.filter((s) =>
    (!semester || s.semester === semester) &&
    (!academicYear || (s.academicYear || '') === academicYear));
  students.sort((a, b) => (`${a.lastName} ${a.firstName}`).localeCompare(`${b.lastName} ${b.firstName}`, 'ka'));
  clear(listHost);
  if (!students.length) {
    listHost.appendChild(h('div', { class: 'card' }, [h('div', { class: 'body' },
      [h('div', { class: 'empty-note', text: 'ამ პარამეტრებით სტუდენტი ვერ მოიძებნა.' })])]));
    return;
  }
  const card = h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: `სტუდენტები (${students.length})` }),
      h('small', { class: 'muted', text: deptName(departmentId) })]),
    h('div', { class: 'body stack' }, students.map(studentRow)),
  ]);
  listHost.appendChild(card);
}

function studentRow(student) {
  const meta = [
    ['ჯგუფი', student.group], ['სემესტრი', student.semester],
    ['კურსი', student.course], ['სასწ. წელი', student.academicYear],
    ['შეჭრილია', student.isShechrili ? 'დიახ' : 'არა'],
  ].map(([k, v]) => h('span', { class: 'pill', text: `${k}: ${v || '—'}` }));

  const btns = [
    ['Mini-CEX', () => openEvalForm('mini_cex', student)],
    ['CBD', () => openEvalForm('cbd', student)],
    ['DOPS', () => openEvalForm('dops', student)],
    ['MSF', () => openEvalForm('msf', student)],
  ].map(([label, fn]) => h('button', { class: 'sm', text: label, onClick: fn }));
  const summaryBtns = [
    h('button', { class: 'sm secondary', text: 'WBA Summary', onClick: () => openWbaSummary(student) }),
    h('button', { class: 'sm secondary', text: 'MSF Resume', onClick: () => openMsfResume(student) }),
  ];

  return h('div', { class: 'card', style: 'margin:0' }, [
    h('div', { class: 'body' }, [
      h('div', { class: 'row' }, [
        h('div', { class: 'grow' }, [
          h('h3', { text: `${student.lastName} ${student.firstName}` }),
          h('div', { style: 'margin-top:4px' }, meta),
        ]),
      ]),
      h('div', { class: 'btn-group', style: 'margin-top:10px' }, [...btns, ...summaryBtns]),
    ]),
  ]);
}

// =========================================================================
// EVALUATION FORM (Mini-CEX / CBD / DOPS / MSF)
// =========================================================================
function openEvalForm(type, student) {
  const form = E.FORMS[type];
  if (!['department_head', 'curator', 'doctor', 'nurse', 'lecturer', 'assessor'].includes(state.me.role) && !state.me.isAdmin) {
    toast('შეფასების შევსების უფლება არ გაქვთ.', 'error'); return;
  }

  const scoreSelects = {};
  const ratingRows = form.domains.map((d) => {
    const sel = h('select', { class: 'score' }, [h('option', { value: '', text: 'აირჩიეთ' })].concat(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('option', { value: String(n), text: String(n) }))));
    sel.addEventListener('change', recalc);
    scoreSelects[d.key] = sel;
    return h('div', { class: 'rating-row' }, [
      h('div', { class: 'prompt' }, [h('strong', { text: d.label }), h('small', { text: d.hint || '' })]),
      sel,
    ]);
  });

  const textInputs = {};
  const textFields = form.textFields.map((f) => {
    const inp = f.area ? h('textarea', {}) : h('input', { type: 'text' });
    textInputs[f.key] = inp;
    return h('div', { class: 'field' }, [h('label', { text: f.label }), inp]);
  });

  const caseInput = form.caseLabel ? h('input', { type: 'text', placeholder: form.caseLabel }) : null;

  const totalV = h('div', { class: 'v', text: '0' });
  const completedV = h('div', { class: 'v', text: '0' });
  const avgV = h('div', { class: 'v', text: '0.00' });
  const judgeV = h('div', { class: 'v', style: 'font-size:16px', text: 'მიმდინარეობს' });

  function collectAnswers() {
    const a = {};
    form.domains.forEach((d) => { a[d.key] = scoreSelects[d.key].value; });
    return a;
  }
  function recalc() {
    const s = E.computeEvalScores(type, collectAnswers());
    totalV.textContent = s.total; completedV.textContent = s.completed;
    avgV.textContent = s.average.toFixed(2); judgeV.textContent = s.judgment;
  }

  const evaluatorCanEdit = state.me.username !== 'kakha';
  const evaluatorFirst = h('input', { type: 'text', value: evaluatorCanEdit ? '' : state.me.firstName, disabled: evaluatorCanEdit ? null : 'true', placeholder: 'სახელი' });
  const evaluatorLast = h('input', { type: 'text', value: evaluatorCanEdit ? '' : state.me.lastName, disabled: evaluatorCanEdit ? null : 'true', placeholder: 'გვარი' });

  const body = h('div', { class: 'stack' }, [
    h('div', { class: 'card', style: 'margin:0' }, [h('div', { class: 'body grid grid-3' }, [
      h('div', { class: 'field' }, [h('label', { text: 'სტუდენტი' }), h('input', { type: 'text', disabled: 'true', value: `${student.lastName} ${student.firstName}` })]),
      h('div', { class: 'field' }, [h('label', { text: evaluatorCanEdit ? 'შემფასებლის სახელი *' : 'შემფასებლის სახელი' }), evaluatorFirst]),
      h('div', { class: 'field' }, [h('label', { text: evaluatorCanEdit ? 'შემფასებლის გვარი *' : 'შემფასებლის გვარი' }), evaluatorLast]),
      h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), h('input', { type: 'text', disabled: 'true', value: deptName(student.departmentId || state.me.departmentId) })]),
      caseInput ? h('div', { class: 'field' }, [h('label', { text: form.caseLabel }), caseInput]) : null,
    ].filter(Boolean))]),
    h('div', { class: 'card', style: 'margin:0' }, [
      h('div', { class: 'section-title' }, [h('h3', { text: 'დომენები (1–8)' })]),
      h('div', { class: 'body' }, ratingRows),
    ]),
    h('div', { class: 'card', style: 'margin:0' }, [h('div', { class: 'body kpi' }, [
      h('div', { class: 'box' }, [h('div', { class: 'k', text: 'ჯამური ქულა' }), totalV]),
      h('div', { class: 'box' }, [h('div', { class: 'k', text: 'შევსებული დომენები' }), completedV]),
      h('div', { class: 'box' }, [h('div', { class: 'k', text: 'საშუალო ქულა' }), avgV]),
      h('div', { class: 'box' }, [h('div', { class: 'k', text: 'ზოგადი შეფასება' }), judgeV]),
    ])]),
    h('div', { class: 'card', style: 'margin:0' }, [h('div', { class: 'body grid grid-2' }, textFields)]),
  ]);

  const saveBtn = h('button', { text: 'შენახვა' });
  const cancelBtn = h('button', { class: 'ghost', text: 'დახურვა' });
  const modal = openModal({
    title: `${form.label} — ${student.lastName} ${student.firstName}`,
    content: body, footer: [cancelBtn, saveBtn], width: '1000px',
  });
  cancelBtn.addEventListener('click', () => modal.close());

  const doSave = guardButton(saveBtn, async () => {
    const answers = collectAnswers();
    const scores = E.computeEvalScores(type, answers);
    if (scores.completed < form.domains.length) {
      toast('შეავსეთ ყველა დომენი (1–8).', 'error'); return;
    }
    const summary = {};
    form.textFields.forEach((f) => { summary[f.key] = textInputs[f.key].value.trim(); });
    if (caseInput) summary.caseName = caseInput.value.trim();
    const evaluatorFirstName = evaluatorFirst.value.trim();
    const evaluatorLastName = evaluatorLast.value.trim();
    if (!evaluatorFirstName || !evaluatorLastName) {
      toast('შეიყვანეთ შემფასებლის სახელი და გვარი.', 'error'); return;
    }

    const payload = {
      studentId: student.id, type,
      departmentId: student.departmentId || state.me.departmentId || null,
      group: student.group || null, semester: student.semester || null,
      course: student.course || null, academicYear: student.academicYear || null,
      evaluatorUid: state.me.uid,
      evaluatorFirstName, evaluatorLastName,
      evaluatorRole: state.me.role,
      answers, scores, summary,
    };
    try {
      await api.createEvaluation(payload);
      toast('შეფასება შენახულია.', 'success');
      modal.close();
    } catch (e) {
      console.error(e);
      toast('შენახვა ვერ მოხერხდა: ' + (e.message || e), 'error');
    }
  });
  saveBtn.addEventListener('click', doSave);
  recalc();
}

// =========================================================================
// WBA SUMMARY  (per student: Mini-CEX + CBD + DOPS)
// =========================================================================
async function openWbaSummary(student) {
  const content = h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']);
  const modal = openModal({ title: `WBA Summary — ${student.lastName} ${student.firstName}`, content, width: '1000px' });
  let evals = [];
  try {
    const [m, c, d] = await Promise.all([
      api.listEvaluationsByStudent(student.id, 'mini_cex'),
      api.listEvaluationsByStudent(student.id, 'cbd'),
      api.listEvaluationsByStudent(student.id, 'dops'),
    ]);
    evals = [...m, ...c, ...d];
  } catch (e) { console.error(e); }

  const entries = E.wbaBuildEntries(evals);
  const avg = E.wbaGetAverages(entries);
  const body = modal.body;
  clear(body);

  if (!entries.length) {
    body.appendChild(h('div', { class: 'empty-note', text: 'ამ სტუდენტს ჯერ არ აქვს Mini-CEX / CBD / DOPS შეფასება.' }));
    return;
  }

  const rows = entries.map((r, i) => h('tr', {}, [
    h('td', { class: 'num', text: String(i + 1) }),
    h('td', { class: 'left', text: r.caseName }),
    h('td', { class: 'num', text: r.mini > 0 ? E.formatNum(r.mini) : '0.00' }),
    h('td', { class: 'num', text: r.cbd > 0 ? E.formatNum(r.cbd) : '0.00' }),
    h('td', { class: 'num', text: r.dops > 0 ? E.formatNum(r.dops) : '0.00' }),
  ]));
  const table = h('div', { class: 'table-wrap' }, [h('table', {}, [
    h('thead', {}, [h('tr', {}, [
      h('th', { class: 'num', text: '№' }), h('th', { text: 'შემთხვევა / ქეისი' }),
      h('th', { class: 'num', text: 'Mini-CEX' }), h('th', { class: 'num', text: 'CBD' }), h('th', { class: 'num', text: 'DOPS' }),
    ])]),
    h('tbody', {}, rows),
    h('tfoot', {}, [h('tr', {}, [
      h('td', { colspan: '2', text: 'საშუალო' }),
      h('td', { class: 'num', text: E.formatNum(avg.mini) }),
      h('td', { class: 'num', text: E.formatNum(avg.cbd) }),
      h('td', { class: 'num', text: E.formatNum(avg.dops) }),
    ])]),
  ])]);

  const canvas = h('canvas', { width: '900', height: '700' });
  const printBtn = h('button', { class: 'warn no-print', text: 'ბეჭდვა', onClick: () => window.print() });

  body.appendChild(h('div', { class: 'report-shell wba-report' }, [
    h('div', { class: 'report-head' }, [
      h('h1', { text: 'WBA შეფასების ინსტრუმენტი' }),
      h('div', { class: 'sub', text: 'Mini-CEX, CBD, DOPS მონაცემების შეჯამება და საშუალო ქულებით რადარული დიაგრამა.' }),
    ]),
    h('div', { class: 'report-card' }, [
      h('div', { class: 'section-title' }, [h('h2', { text: 'სტუდენტის მონაცემები' })]),
      h('div', { class: 'radar-meta' }, reportMetaBoxes(student, [
        ['ჩანაწერების რაოდენობა', String(entries.length)],
        ['საშუალო ჯამური ქულა', E.formatNum(avg.overall)],
        ['Mini-CEX საშუალო', E.formatNum(avg.mini)],
        ['CBD საშუალო', E.formatNum(avg.cbd)],
        ['DOPS საშუალო', E.formatNum(avg.dops)],
      ])),
    ]),
    h('div', { class: 'report-card' }, [
      h('div', { class: 'section-title' }, [h('h2', { text: 'WBA Summary' })]),
      table,
    ]),
    h('div', { class: 'report-card' }, [
      h('div', { class: 'section-title' }, [h('h2', { text: 'რედარული დიაგრამა' })]),
      h('div', { class: 'canvas-card' }, [canvas]),
    ]),
    h('div', { class: 'row no-print' }, [printBtn]),
  ]));
  E.drawWbaRadar(canvas, avg);
}

// =========================================================================
// MSF RESUME  (per student: MSF)
// =========================================================================
async function openMsfResume(student) {
  const content = h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']);
  const modal = openModal({ title: `MSF Resume — ${student.lastName} ${student.firstName}`, content, width: '1000px' });
  let msfEvals = [];
  try { msfEvals = await api.listEvaluationsByStudent(student.id, 'msf'); }
  catch (e) { console.error(e); }

  const entries = msfEvals.map(E.msfEntryFromEvaluation);
  const averages = E.msfCalculateAverages(entries);
  const body = modal.body; clear(body);

  if (!entries.length) {
    body.appendChild(h('div', { class: 'empty-note', text: 'ამ სტუდენტს ჯერ არ აქვს MSF შეფასება.' }));
    return;
  }

  const headCells = [h('th', { class: 'num', text: '№' }), h('th', { text: 'შემფასებელი' })]
    .concat(E.MSF_DOMAINS.map((d) => h('th', { class: 'num', text: d.label })));
  const rows = entries.map((e, i) => h('tr', {}, [
    h('td', { class: 'num', text: String(i + 1) }), h('td', { text: e.evaluator || '—' }),
    ...E.MSF_DOMAINS.map((d) => h('td', { class: 'num', text: E.msfFormatNumber(e[d.key]) })),
  ]));
  const footCells = [h('td', { colspan: '2', text: 'საშუალო' })]
    .concat(E.MSF_DOMAINS.map((d) => h('td', { class: 'num', text: E.msfFormatNumber(averages[d.key]) })));
  const table = h('div', { class: 'table-wrap' }, [h('table', {}, [
    h('thead', {}, [h('tr', {}, headCells)]),
    h('tbody', {}, rows),
    h('tfoot', {}, [h('tr', {}, footCells)]),
  ])]);

  const canvas = h('canvas', { width: '900', height: '700' });
  const descriptors = h('div', { class: 'descriptor-list' }, E.MSF_DOMAINS.map((d) => h('div', { class: 'descriptor-card' }, [
    h('div', { class: 'descriptor-head' }, [
      h('h4', { text: d.label }),
      h('span', { class: 'score-pill', text: `საშუალო ქულა: ${E.msfFormatNumber(averages[d.key])}` }),
    ]),
      h('div', { style: 'margin-top:6px', text: E.getDescriptorText(d.key, averages[d.key]) }),
  ])));
  const legend = h('div', { class: 'legend-grid' }, E.MSF_DOMAINS.map((d) => h('div', { class: 'legend-item' }, [
    h('span', { text: d.label }),
    h('strong', { text: E.msfFormatNumber(averages[d.key]) }),
  ])));

  const printBtn = h('button', { class: 'warn no-print', text: 'ბეჭდვა', onClick: () => window.print() });
  body.appendChild(h('div', { class: 'report-shell msf-report' }, [
    h('div', { class: 'page-title' }, [
      h('h1', { text: 'MSF / 360° უკუკავშირის შეფასება' }),
      h('p', { text: 'რეზიუმე, საშუალო დომენური ქულები და რადარული დიაგრამა.' }),
    ]),
    h('div', { class: 'resume-student-card' }, [
      h('div', { class: 'resume-student-grid' }, [
        ...reportMetaBoxes(student, [['ჩანაწერები', String(entries.length)]]),
      ]),
    ]),
    h('div', { class: 'report-card' }, [
      h('div', { class: 'section-title-row' }, [h('h2', { text: 'შემფასებლების ცხრილი' }), h('span', { class: 'badge', text: `ჩანაწერები: ${entries.length}` })]),
      table,
    ]),
    h('div', { class: 'report-card' }, [
      h('div', { class: 'section-title-row' }, [h('h2', { text: 'დომენების საშუალო ქულების რადარული დიაგრამა' })]),
      h('div', { class: 'chart-box' }, [h('div', { class: 'chart-canvas-wrap' }, [canvas]), legend]),
    ]),
    h('div', { class: 'report-card' }, [
      h('div', { class: 'resume-header' }, [h('h2', { text: 'ავტომატური რეზიუმე' }), h('h3', { text: `${student.lastName} ${student.firstName}` })]),
      descriptors,
    ]),
    h('div', { class: 'row no-print' }, [printBtn]),
  ]));
  E.drawMsfRadar(canvas, averages);
}

function kbox(k, v) { return h('div', { class: 'box' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v })]); }
function reportMetaBoxes(student, extra = []) {
  const base = [
    ['სტუდენტი', `${student.lastName} ${student.firstName}`],
    ['ჯგუფი', student.group || '—'],
    ['სემესტრი', student.semester || '—'],
    ['კურსი', student.course || '—'],
    ['სასწავლო წელი', student.academicYear || '—'],
    ['დეპარტამენტი', student.departmentId ? deptName(student.departmentId) : '—'],
  ];
  return base.concat(extra).map(([k, v]) => h('div', { class: 'meta-box resume-item' }, [
    h('div', { class: 'k', text: k }),
    h('div', { class: 'v', text: v }),
  ]));
}
function metaGrid(student, extra = {}) {
  const items = {
    'სტუდენტი': `${student.lastName} ${student.firstName}`,
    'ჯგუფი': student.group || '—', 'სემესტრი': student.semester || '—',
    'კურსი': student.course || '—', 'სასწავლო წელი': student.academicYear || '—',
    ...extra,
  };
  return h('div', { class: 'card', style: 'margin:0' }, [h('div', { class: 'body kpi' },
    Object.entries(items).map(([k, v]) => kbox(k, v)))]);
}

// =========================================================================
// DEPARTMENTS (admin)
// =========================================================================
async function viewDepartments(host) {
  clear(host);
  state.departments = await api.listDepartments();
  const nameI = h('input', { type: 'text', placeholder: 'დეპარტამენტის დასახელება' });
  const codeI = h('input', { type: 'text', placeholder: 'მოკლე კოდი (სურვილისამებრ)' });
  const activeSel = selectEl('dep-active', [{ value: 'true', label: 'აქტიური' }, { value: 'false', label: 'გათიშული' }], 'true');
  const addBtn = h('button', { text: 'დეპარტამენტის დამატება' });
  addBtn.addEventListener('click', guardButton(addBtn, async () => {
    const name = nameI.value.trim();
    if (!name) { toast('შეავსეთ დასახელება.', 'error'); return; }
    try {
      await api.createDepartment({ name, code: codeI.value.trim() || null, active: activeSel.value === 'true' }, state.me.uid);
      toast('დეპარტამენტი დაემატა.', 'success');
      nameI.value = ''; codeI.value = '';
      viewDepartments(host);
    } catch (e) { toast('ვერ დაემატა: ' + (e.message || e), 'error'); }
  }));

  const rows = state.departments.map((d) => h('tr', {}, [
    h('td', { text: d.name }), h('td', { text: d.code || '—' }),
    h('td', { class: 'num' }, [h('span', { class: `pill ${d.active !== false ? 'badge-ok' : 'badge-off'}`, text: d.active !== false ? 'აქტიური' : 'გათიშული' })]),
    h('td', { class: 'num' }, [h('button', {
      class: 'sm ghost', text: d.active !== false ? 'გათიშვა' : 'გააქტიურება',
      onClick: async () => { await api.updateDepartment(d.id, { active: !(d.active !== false) }); toast('განახლდა.', 'success'); viewDepartments(host); },
    })]),
  ]));

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'დეპარტამენტის დამატება' })]),
    h('div', { class: 'body grid grid-4' }, [
      h('div', { class: 'field' }, [h('label', { text: 'დასახელება' }), nameI]),
      h('div', { class: 'field' }, [h('label', { text: 'კოდი' }), codeI]),
      h('div', { class: 'field' }, [h('label', { text: 'სტატუსი' }), activeSel]),
      h('div', { class: 'field', style: 'display:flex;align-items:flex-end' }, [addBtn]),
    ]),
  ]));
  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: `დეპარტამენტები (${state.departments.length})` })]),
    h('div', { class: 'body table-scroll' }, [
      state.departments.length
        ? h('table', {}, [h('thead', {}, [h('tr', {}, [h('th', { text: 'დასახელება' }), h('th', { text: 'კოდი' }), h('th', { class: 'num', text: 'სტატუსი' }), h('th', { class: 'num', text: 'მოქმედება' })])]), h('tbody', {}, rows)])
        : h('div', { class: 'empty-note', text: 'დეპარტამენტი ჯერ არ დამატებულა.' }),
    ]),
  ]));
}

// =========================================================================
// USERS (admin)
// =========================================================================
async function viewUsers(host) {
  clear(host);
  const [users] = await Promise.all([api.listUsers()]);
  const createBtn = h('button', { text: '+ ახალი მომხმარებელი', onClick: () => openUserForm(host) });

  const rows = users.map((u) => h('tr', {}, [
    h('td', { text: `${u.lastName} ${u.firstName}` }),
    h('td', { text: u.username }),
    h('td', { text: E.roleLabel(u.role) }),
    h('td', { text: u.departmentId ? deptName(u.departmentId) : '—' }),
    h('td', { class: 'num' }, [h('span', { class: `pill ${u.active !== false ? 'badge-ok' : 'badge-off'}`, text: u.active !== false ? 'აქტიური' : 'გათიშული' })]),
    h('td', { class: 'num' }, [h('div', { class: 'btn-group' }, [
      h('button', { class: 'sm ghost', text: 'პაროლის აღდგენა', onClick: () => openResetPassword(u) }),
      h('button', {
        class: 'sm ' + (u.active !== false ? 'bad' : 'secondary'),
        text: u.active !== false ? 'გათიშვა' : 'გააქტიურება',
        onClick: async () => {
          if (u.uid === state.me.uid && u.active !== false) { toast('საკუთარი ანგარიშის გათიშვა შეუძლებელია.', 'error'); return; }
          const ok = await confirmDialog(`დარწმუნებული ხართ, რომ გსურთ „${u.firstName} ${u.lastName}“-ის ${u.active !== false ? 'გათიშვა' : 'გააქტიურება'}?`);
          if (!ok) return;
          try { await api.setUserActive(u.uid, !(u.active !== false)); toast('განახლდა.', 'success'); viewUsers(host); }
          catch (e) { toast(e.message || 'ვერ განახლდა', 'error'); }
        },
      }),
    ])]),
  ]));

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: `მომხმარებლები (${users.length})` }), createBtn]),
    h('div', { class: 'body table-scroll' }, [
      users.length
        ? h('table', {}, [h('thead', {}, [h('tr', {}, [h('th', { text: 'სახელი გვარი' }), h('th', { text: 'username' }), h('th', { text: 'როლი' }), h('th', { text: 'დეპარტამენტი' }), h('th', { class: 'num', text: 'სტატუსი' }), h('th', { class: 'num', text: 'მოქმედება' })])]), h('tbody', {}, rows)])
        : h('div', { class: 'empty-note', text: 'მომხმარებელი ვერ მოიძებნა.' }),
    ]),
  ]));
}

function openUserForm(host) {
  const username = h('input', { type: 'text', placeholder: 'username' });
  const password = h('input', { type: 'text', placeholder: 'პაროლი' });
  const firstName = h('input', { type: 'text' });
  const lastName = h('input', { type: 'text' });
  const roleSel = selectEl('nu-role', E.ROLES.map((r) => ({ value: r.value, label: r.label })), 'curator');
  const deptSel = selectEl('nu-dept', deptOptions(true), '');
  const activeSel = selectEl('nu-active', [{ value: 'true', label: 'აქტიური' }, { value: 'false', label: 'გათიშული' }], 'true');

  const body = h('div', { class: 'grid grid-2' }, [
    h('div', { class: 'field' }, [h('label', { text: 'მომხმარებელი (username) *' }), username]),
    h('div', { class: 'field' }, [h('label', { text: 'პაროლი *' }), password]),
    h('div', { class: 'field' }, [h('label', { text: 'სახელი *' }), firstName]),
    h('div', { class: 'field' }, [h('label', { text: 'გვარი *' }), lastName]),
    h('div', { class: 'field' }, [h('label', { text: 'როლი *' }), roleSel]),
    h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), deptSel]),
    h('div', { class: 'field' }, [h('label', { text: 'აქტიურია თუ არა' }), activeSel]),
  ]);
  const saveBtn = h('button', { text: 'შექმნა' });
  const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
  const modal = openModal({ title: 'ახალი მომხმარებელი', content: body, footer: [cancelBtn, saveBtn], width: '760px' });
  cancelBtn.addEventListener('click', () => modal.close());

  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    const data = {
      username: username.value.trim(), password: password.value,
      firstName: firstName.value.trim(), lastName: lastName.value.trim(),
      role: roleSel.value, departmentId: deptSel.value || null, active: activeSel.value === 'true',
    };
    if (!data.username || !data.password || !data.firstName || !data.lastName || !data.role) {
      toast('შეავსეთ ყველა სავალდებულო ველი (*).', 'error'); return;
    }
    try {
      await api.createUserAccount(data, state.me.uid);
      toast('მომხმარებელი შეიქმნა.', 'success');
      modal.close(); viewUsers(host);
    } catch (e) { toast(e.message || 'ვერ შეიქმნა', 'error'); }
  }));
}

function openResetPassword(u) {
  const p1 = h('input', { type: 'text', placeholder: 'ახალი პაროლი' });
  const saveBtn = h('button', { text: 'პაროლის დაყენება' });
  const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
  const modal = openModal({
    title: `პაროლის აღდგენა — ${u.firstName} ${u.lastName}`,
    content: h('div', { class: 'stack' }, [h('div', { class: 'field' }, [h('label', { text: 'ახალი პაროლი' }), p1])]),
    footer: [cancelBtn, saveBtn], width: '480px',
  });
  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    if (!p1.value) { toast('შეიყვანეთ ახალი პაროლი.', 'error'); return; }
    try { await api.resetUserPassword(u.uid, p1.value); toast('პაროლი განახლდა.', 'success'); modal.close(); }
    catch (e) { toast(e.message || 'ვერ განახლდა', 'error'); }
  }));
}

// =========================================================================
// STUDENTS (admin / department_head) — management + filters
// =========================================================================
async function viewStudents(host) {
  clear(host);
  const canChooseDept = state.me.isAdmin;
  const fFirst = h('input', { type: 'text', placeholder: 'სახელი' });
  const fLast = h('input', { type: 'text', placeholder: 'გვარი' });
  const fPhone = h('input', { type: 'text', placeholder: 'ტელეფონი' });
  const fGroup = h('input', { type: 'text', placeholder: 'ჯგუფი' });
  const fSem = h('input', { type: 'text', placeholder: 'სემესტრი' });
  const fCourse = h('input', { type: 'text', placeholder: 'კურსი' });
  const fYear = selectEl('f-year', academicYearOptions(new Date().getFullYear(), 12, true), '');
  const fShech = selectEl('f-shech', [{ value: '', label: 'ყველა (შეჭრილია?)' }, { value: 'yes', label: 'შეჭრილია: დიახ' }, { value: 'no', label: 'შეჭრილია: არა' }], '');
  const fDept = canChooseDept ? selectEl('f-dept', deptOptions(true), '') : null;

  const listHost = h('div', { id: 'st-list' });
  const addBtn = h('button', { text: '+ სტუდენტის დამატება', onClick: () => openStudentForm(host) });
  const importBtn = state.me.isAdmin
    ? h('button', { class: 'secondary', text: 'ჯგუფის დამატება PDF-ით', onClick: () => openGroupImport(host) })
    : null;

  async function run() {
    clear(listHost);
    listHost.appendChild(h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']));
    const departmentId = canChooseDept ? (fDept.value || null) : state.me.departmentId;
    let students = await api.queryStudents({ departmentId, group: fGroup.value.trim() || null });
    const norm = (s) => (s || '').toString().toLowerCase();
    students = students.filter((s) =>
      (!fFirst.value.trim() || norm(s.firstName).includes(norm(fFirst.value))) &&
      (!fLast.value.trim() || norm(s.lastName).includes(norm(fLast.value))) &&
      (!fPhone.value.trim() || norm(s.phone).includes(norm(fPhone.value))) &&
      (!fSem.value.trim() || norm(s.semester) === norm(fSem.value)) &&
      (!fCourse.value.trim() || norm(s.course) === norm(fCourse.value)) &&
      (!fYear.value.trim() || norm(s.academicYear) === norm(fYear.value)) &&
      (!fShech.value || (fShech.value === 'yes' ? s.isShechrili === true : s.isShechrili !== true)));
    students.sort((a, b) => (`${a.lastName} ${a.firstName}`).localeCompare(`${b.lastName} ${b.firstName}`, 'ka'));
    renderStudentTable(listHost, students, host);
  }
  const runBtn = h('button', { class: 'secondary', text: 'ფილტრი' });
  runBtn.addEventListener('click', run);
  const clearBtn = h('button', { class: 'ghost', text: 'გასუფთავება', onClick: () => {
    [fFirst, fLast, fPhone, fGroup, fSem, fCourse, fYear].forEach((i) => (i.value = ''));
    fShech.value = ''; if (fDept) fDept.value = ''; run();
  } });

  const filterFields = [
    ['სახელი', fFirst], ['გვარი', fLast], ['ტელეფონი', fPhone], ['ჯგუფი', fGroup],
    ['სემესტრი', fSem], ['კურსი', fCourse], ['სასწავლო წელი', fYear], ['შეჭრილია თუ არა', fShech],
  ].map(([l, el]) => h('div', { class: 'field' }, [h('label', { text: l }), el]));
  if (fDept) filterFields.unshift(h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), fDept]));

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'სტუდენტები' }), h('div', { class: 'row' }, [addBtn, importBtn].filter(Boolean))]),
    h('div', { class: 'body' }, [
      h('div', { class: 'filters' }, filterFields),
      h('div', { class: 'row', style: 'margin-top:12px' }, [runBtn, clearBtn]),
    ]),
  ]));
  host.appendChild(listHost);
  if (state.me.isAdmin) {
    const groupsHost = h('div', { id: 'groups-list' });
    host.appendChild(groupsHost);
    renderStudentGroups(groupsHost, host);
  }
  run();
}

async function renderStudentGroups(groupsHost, host) {
  clear(groupsHost);
  groupsHost.appendChild(h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' ჯგუფები იტვირთება…']));
  let groups = [];
  try { groups = await api.listStudentGroups(); }
  catch (e) { console.error(e); clear(groupsHost); groupsHost.appendChild(h('div', { class: 'empty-note', text: 'ჯგუფების ჩატვირთვა ვერ მოხერხდა.' })); return; }
  clear(groupsHost);
  const rows = groups.map((g) => h('tr', {}, [
    h('td', { text: g.name || `ჯგუფი ${g.group || '—'}` }),
    h('td', { text: g.departmentId ? deptName(g.departmentId) : '—' }),
    h('td', { text: [g.academicYear, g.semester && (g.semester + ' სემ.'), g.course && (g.course + ' კურსი'), g.group && ('ჯგ. ' + g.group)].filter(Boolean).join(' · ') || '—' }),
    h('td', { class: 'num', text: String(g.studentCount || 0) }),
    h('td', { class: 'num' }, [h('span', { class: `pill ${g.archived ? 'badge-off' : 'badge-ok'}`, text: g.archived ? 'დაარქივებული' : 'აქტიური' })]),
    h('td', { class: 'num' }, [h('div', { class: 'btn-group' }, [
      h('button', { class: 'sm ' + (g.archived ? 'secondary' : 'warn'), text: g.archived ? 'აღდგენა' : 'დაარქივება', onClick: async () => {
        try { await api.setStudentGroupArchived(g.id, !g.archived); toast('ჯგუფი განახლდა.', 'success'); viewStudents(host); }
        catch (e) { toast(e.message || 'ჯგუფი ვერ განახლდა.', 'error'); }
      } }),
      h('button', { class: 'sm bad', text: 'წაშლა', onClick: async () => {
        const ok = await confirmDialog(`წავშალო ჯგუფი „${g.name || g.group || '—'}“ და ამ ჯგუფის სტუდენტები?`);
        if (!ok) return;
        try { await api.deleteStudentGroup(g.id); toast('ჯგუფი წაიშალა.', 'success'); viewStudents(host); }
        catch (e) { toast(e.message || 'ჯგუფი ვერ წაიშალა.', 'error'); }
      } }),
    ])]),
  ]));
  groupsHost.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: `ჯგუფები (${groups.length})` }), h('small', { class: 'muted', text: 'ატვირთვა, დაარქივება და წაშლა მხოლოდ ადმინისთვის' })]),
    h('div', { class: 'body table-scroll' }, [
      groups.length
        ? h('table', {}, [h('thead', {}, [h('tr', {}, ['ჯგუფი', 'დეპარტამენტი', 'კონტექსტი', 'სტუდენტები', 'სტატუსი', 'მოქმედება'].map((t, i) => h('th', { class: i >= 3 ? 'num' : '', text: t })))]), h('tbody', {}, rows)])
        : h('div', { class: 'empty-note', text: 'ჯგუფი ჯერ არ დამატებულა.' }),
    ]),
  ]));
}

function normalizePhone(s) {
  return String(s || '').replace(/[^\d+]/g, '');
}
function cleanPersonName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}
function parseStudentPdfText(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines.join(' ');
  const course = (header.match(/კურსი:\s*([^\s]+)/) || [])[1] || '';
  const semester = (header.match(/სემესტრი:\s*([^\s]+)/) || [])[1] || '';
  const group = (header.match(/ჯგუფი:\s*([^\s]+)/) || [])[1] || '';
  const specialty = (header.match(/სპეციალობა:\s*([^;]+?)(?:\s+კურსი:|$)/) || [])[1]?.trim() || '';
  const students = [];
  for (let i = 0; i < lines.length; i++) {
    let m = lines[i].match(/^(\d+)\s+(.+)$/);
    if (!m && /^\d+$/.test(lines[i]) && lines[i + 1]) {
      m = [`${lines[i]} ${lines[i + 1]}`, lines[i], lines[i + 1]];
      i++;
    }
    if (!m) continue;
    const raw = m[2].replace(/;.*$/, '').trim();
    if (!/[\u10A0-\u10FF]/.test(raw)) continue;
    const eng = raw.match(/[A-Za-z][A-Za-z' -]+$/)?.[0]?.trim() || '';
    const ge = cleanPersonName(eng ? raw.slice(0, raw.length - eng.length) : raw);
    const parts = ge.split(' ');
    const lastName = parts.shift() || '';
    const firstName = parts.join(' ');
    const phoneContext = [lines[i], lines[i - 1], lines[i + 1], lines[i + 2]].filter(Boolean).join(' ');
    const emailContext = [lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(' ');
    const phone = normalizePhone((phoneContext.match(/;?\s*(\+?\d[\d\s-]{6,}\d)/) || [])[1] || '');
    const email = (emailContext.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    if (firstName && lastName) students.push({ firstName, lastName, englishName: eng || null, phone, email });
  }
  return { course, semester, group, specialty, students };
}
async function extractPdfText(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = [];
    content.items.forEach((item) => {
      const text = String(item.str || '').trim();
      if (!text) return;
      const x = item.transform?.[4] || 0;
      const y = item.transform?.[5] || 0;
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x, text });
    });
    pages.push(rows
      .sort((a, b) => b.y - a.y)
      .map((row) => row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim())
      .filter(Boolean)
      .join('\n'));
  }
  return pages.join('\n');
}
function openGroupImport(host) {
  if (!state.me.isAdmin) { toast('ჯგუფის ატვირთვა მხოლოდ ადმინს შეუძლია.', 'error'); return; }
  const deptSel = selectEl('gi-dept', deptOptions(false), state.me.departmentId || '');
  const yearSel = selectEl('gi-year', academicYearOptions(new Date().getFullYear(), 12), '');
  const nameInput = h('input', { type: 'text', placeholder: 'ჯგუფის დასახელება (სურვილისამებრ)' });
  const shech = selectEl('gi-shech', [{ value: 'no', label: 'არა' }, { value: 'yes', label: 'დიახ (შეჭრილია)' }], 'no');
  const fileInput = h('input', { type: 'file', accept: 'application/pdf' });
  const metaHost = h('div', { class: 'empty-note', text: 'აირჩიეთ PDF ფაილი. მონაცემები ჯერ არ შეინახება.' });
  const previewHost = h('div', {});
  let parsed = null;

  async function readFile() {
    const file = fileInput.files && fileInput.files[0];
    parsed = null;
    clear(previewHost);
    if (!file) { metaHost.textContent = 'აირჩიეთ PDF ფაილი.'; return; }
    metaHost.textContent = 'PDF იკითხება…';
    try {
      parsed = parseStudentPdfText(await extractPdfText(file));
      if (!nameInput.value.trim() && parsed.group) nameInput.value = `ჯგუფი ${parsed.group}`;
      metaHost.textContent = `ამოიცნო: კურსი ${parsed.course || '—'}, სემესტრი ${parsed.semester || '—'}, ჯგუფი ${parsed.group || '—'}, სტუდენტი ${parsed.students.length}`;
      const rows = parsed.students.slice(0, 20).map((s, i) => h('tr', {}, [
        h('td', { class: 'num', text: String(i + 1) }),
        h('td', { text: `${s.lastName} ${s.firstName}` }),
        h('td', { text: s.englishName || '—' }),
        h('td', { text: s.phone || '—' }),
        h('td', { text: s.email || '—' }),
      ]));
      previewHost.appendChild(h('div', { class: 'table-scroll', style: 'margin-top:12px' }, [h('table', {}, [
        h('thead', {}, [h('tr', {}, ['№', 'სახელი გვარი', 'ENG', 'ტელეფონი', 'ელ.ფოსტა'].map((t, i) => h('th', { class: i === 0 ? 'num' : '', text: t })))]),
        h('tbody', {}, rows),
      ])]));
      if (parsed.students.length > 20) previewHost.appendChild(h('div', { class: 'muted', style: 'margin-top:8px', text: `ნაჩვენებია პირველი 20 სტუდენტი ${parsed.students.length}-დან.` }));
    } catch (e) {
      console.error(e);
      metaHost.textContent = 'PDF-ის წაკითხვა ვერ მოხერხდა.';
      toast(e.message || 'PDF-ის წაკითხვა ვერ მოხერხდა.', 'error');
    }
  }
  fileInput.addEventListener('change', readFile);

  const saveBtn = h('button', { text: 'ჯგუფის დამატება' });
  const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
  const modal = openModal({
    title: 'ჯგუფის დამატება PDF-ით',
    content: h('div', { class: 'stack' }, [
      h('div', { class: 'grid grid-2' }, [
        h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი *' }), deptSel]),
        h('div', { class: 'field' }, [h('label', { text: 'სასწავლო წელი *' }), yearSel]),
        h('div', { class: 'field' }, [h('label', { text: 'ჯგუფის სახელი' }), nameInput]),
        h('div', { class: 'field' }, [h('label', { text: 'შეჭრილია თუ არა' }), shech]),
        h('div', { class: 'field' }, [h('label', { text: 'PDF ფაილი *' }), fileInput]),
      ]),
      metaHost,
      previewHost,
    ]),
    footer: [cancelBtn, saveBtn],
    width: '980px',
  });
  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    if (!deptSel.value || !yearSel.value) { toast('აირჩიეთ დეპარტამენტი და სასწავლო წელი.', 'error'); return; }
    if (!parsed || !parsed.students.length) { toast('PDF-დან სტუდენტები ვერ ამოიცნო.', 'error'); return; }
    const groupName = nameInput.value.trim() || `ჯგუფი ${parsed.group || ''}`.trim();
    const studentRows = parsed.students.map((s) => ({
      ...s,
      departmentId: deptSel.value,
      group: parsed.group || groupName,
      semester: parsed.semester,
      course: parsed.course,
      academicYear: yearSel.value,
      isShechrili: shech.value === 'yes',
    }));
    try {
      await api.createStudentGroupWithStudents({
        name: groupName,
        departmentId: deptSel.value,
        academicYear: yearSel.value,
        semester: parsed.semester || null,
        course: parsed.course || null,
        group: parsed.group || groupName,
        specialty: parsed.specialty || null,
        isShechrili: shech.value === 'yes',
      }, studentRows, state.me.uid);
      toast('ჯგუფი და სტუდენტები დაემატა.', 'success');
      modal.close();
      viewStudents(host);
    } catch (e) {
      const msg = e && e.message ? e.message : '';
      if (/permission|insufficient/i.test(msg)) {
        try {
          await api.createStudentsBulk(studentRows, state.me.uid);
          toast('სტუდენტები დაემატა. ჯგუფის archive/delete-სთვის Firestore rules უნდა გამოქვეყნდეს.', 'success', 7000);
          modal.close();
          viewStudents(host);
          return;
        } catch (bulkErr) {
          toast(bulkErr.message || 'სტუდენტები ვერ დაემატა.', 'error');
          return;
        }
      }
      toast(msg || 'ჯგუფი ვერ დაემატა.', 'error');
    }
  }));
}

function renderStudentTable(listHost, students, host) {
  clear(listHost);
  if (!students.length) {
    listHost.appendChild(h('div', { class: 'card' }, [h('div', { class: 'body' }, [h('div', { class: 'empty-note', text: 'სტუდენტი ვერ მოიძებნა.' })])]));
    return;
  }
  const rows = students.map((s) => h('tr', {}, [
    h('td', { text: `${s.lastName} ${s.firstName}` }),
    h('td', { text: s.phone || '—' }), h('td', { text: s.group || '—' }),
    h('td', { text: s.semester || '—' }), h('td', { text: s.course || '—' }),
    h('td', { text: s.academicYear || '—' }),
    h('td', { text: s.isShechrili ? 'დიახ' : 'არა' }),
    h('td', { text: s.departmentId ? deptName(s.departmentId) : '—' }),
    h('td', { class: 'num' }, [h('div', { class: 'btn-group' }, [
      h('button', { class: 'sm ghost', text: 'რედაქტ.', onClick: () => openStudentForm(host, s) }),
      state.me.isAdmin ? h('button', { class: 'sm bad', text: 'წაშლა', onClick: async () => {
        const ok = await confirmDialog(`წავშალო სტუდენტი „${s.firstName} ${s.lastName}“?`);
        if (!ok) return;
        try { await api.deleteStudent(s.id); toast('წაიშალა.', 'success'); viewStudents(host); }
        catch (e) { toast(e.message || 'ვერ წაიშალა', 'error'); }
      } }) : null,
    ].filter(Boolean))]),
  ]));
  listHost.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: `შედეგი (${students.length})` })]),
    h('div', { class: 'body table-scroll' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, ['სახელი გვარი', 'ტელეფონი', 'ჯგუფი', 'სემესტრი', 'კურსი', 'სასწ. წელი', 'შეჭრილია', 'დეპარტამენტი', 'მოქმედება']
        .map((t, i) => h('th', { class: i === 8 ? 'num' : '', text: t })))]),
      h('tbody', {}, rows),
    ])]),
  ]));
}

function openStudentForm(host, existing = null) {
  const firstName = h('input', { type: 'text', value: existing?.firstName || '' });
  const lastName = h('input', { type: 'text', value: existing?.lastName || '' });
  const phone = h('input', { type: 'text', value: existing?.phone || '', placeholder: '+995…' });
  const group = h('input', { type: 'text', value: existing?.group || '' });
  const semester = h('input', { type: 'text', value: existing?.semester || '' });
  const course = h('input', { type: 'text', value: existing?.course || '' });
  const year = selectEl('st-year', academicYearOptions(new Date().getFullYear(), 12), existing?.academicYear || '');
  const shech = selectEl('st-shech', [{ value: '', label: 'აირჩიეთ' }, { value: 'yes', label: 'დიახ' }, { value: 'no', label: 'არა' }],
    existing ? (existing.isShechrili ? 'yes' : 'no') : '');
  const canChooseDept = state.me.isAdmin;
  const deptSel = canChooseDept
    ? selectEl('st-dept', deptOptions(false), existing?.departmentId || '')
    : null;

  const fields = [
    h('div', { class: 'field' }, [h('label', { text: 'სახელი *' }), firstName]),
    h('div', { class: 'field' }, [h('label', { text: 'გვარი *' }), lastName]),
    h('div', { class: 'field' }, [h('label', { text: 'ტელეფონის ნომერი' }), phone]),
    h('div', { class: 'field' }, [h('label', { text: 'ჯგუფი *' }), group]),
    h('div', { class: 'field' }, [h('label', { text: 'სემესტრი *' }), semester]),
    h('div', { class: 'field' }, [h('label', { text: 'კურსი *' }), course]),
    h('div', { class: 'field' }, [h('label', { text: 'სასწავლო წელი *' }), year]),
    h('div', { class: 'field' }, [h('label', { text: 'შეჭრილია თუ არა *' }), shech]),
  ];
  if (deptSel) fields.push(h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), deptSel]));

  const saveBtn = h('button', { text: existing ? 'განახლება' : 'დამატება' });
  const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
  const modal = openModal({ title: existing ? 'სტუდენტის რედაქტირება' : 'სტუდენტის დამატება', content: h('div', { class: 'grid grid-2' }, fields), footer: [cancelBtn, saveBtn], width: '760px' });
  cancelBtn.addEventListener('click', () => modal.close());

  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    if (!firstName.value.trim() || !lastName.value.trim() || !group.value.trim() ||
        !semester.value.trim() || !course.value.trim() || !year.value.trim() || !shech.value) {
      toast('შეავსეთ ყველა სავალდებულო ველი (*).', 'error'); return;
    }
    const departmentId = canChooseDept ? (deptSel.value || null) : state.me.departmentId;
    const data = {
      firstName: firstName.value.trim(), lastName: lastName.value.trim(),
      phone: phone.value.trim(), group: group.value.trim(),
      semester: semester.value.trim(), course: course.value.trim(),
      academicYear: year.value.trim(), isShechrili: shech.value === 'yes',
      departmentId,
    };
    try {
      if (existing) { await api.updateStudent(existing.id, data); toast('სტუდენტი განახლდა.', 'success'); }
      else { await api.createStudent(data, state.me.uid); toast('სტუდენტი დაემატა.', 'success'); }
      modal.close(); viewStudents(host);
    } catch (e) { toast(e.message || 'ვერ შეინახა', 'error'); }
  }));
}

// =========================================================================
// UCEEM CAMPAIGNS (admin)
// =========================================================================
async function viewUceem(host) {
  clear(host);
  const [campaigns, users] = await Promise.all([api.listCampaigns(), api.listUsers()]);
  const staff = users.filter((u) => u.active !== false);

  const title = h('input', { type: 'text', placeholder: 'კამპანიის სახელი (სურვილისამებრ)' });
  const deptSel = selectEl('uc-dept', deptOptions(false), state.me.departmentId || '');
  const year = h('input', { type: 'text', placeholder: 'მაგ., 2025-2026' });
  const semSel = selectEl('uc-sem', [{ value: '', label: 'აირჩიეთ სემესტრი' }].concat(
    ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((s) => ({ value: s, label: s }))));
  const group = h('input', { type: 'text', placeholder: 'ჯგუფი (სურვილისამებრ)' });

  // staff picker
  const chosen = new Map();
  const staffSel = selectEl('uc-staff', [{ value: '', label: 'აირჩიეთ თანამშრომელი' }]
    .concat(staff.map((u) => ({ value: u.uid, label: `${u.lastName} ${u.firstName} — ${E.roleLabel(u.role)}` }))));
  const chosenHost = h('div', { class: 'row', style: 'margin-top:8px' });
  function renderChosen() {
    clear(chosenHost);
    if (!chosen.size) { chosenHost.appendChild(h('span', { class: 'muted', text: 'შესაფასებელი თანამშრომლები არ არის არჩეული.' })); return; }
    chosen.forEach((t, uid) => chosenHost.appendChild(h('span', { class: 'pill' }, [
      `${t.name} (${E.roleLabel(t.role)}) `,
      h('button', { class: 'sm ghost', style: 'padding:2px 6px', text: '×', onClick: () => { chosen.delete(uid); renderChosen(); } }),
    ])));
  }
  const addStaffBtn = h('button', { class: 'ghost', text: 'დამატება', onClick: () => {
    const uid = staffSel.value; if (!uid) return;
    const u = staff.find((x) => x.uid === uid);
    chosen.set(uid, { userId: uid, name: `${u.lastName} ${u.firstName}`, role: u.role });
    staffSel.value = ''; renderChosen();
  } });
  renderChosen();

  const createBtn = h('button', { text: 'კამპანიის შექმნა' });
  createBtn.addEventListener('click', guardButton(createBtn, async () => {
    if (!deptSel.value) { toast('აირჩიეთ დეპარტამენტი.', 'error'); return; }
    if (!chosen.size) { toast('დაამატეთ მინიმუმ ერთი შესაფასებელი თანამშრომელი.', 'error'); return; }
    try {
      await api.createCampaign({
        title: title.value.trim() || null, departmentId: deptSel.value,
        academicYear: year.value.trim() || null, semester: semSel.value || null,
        group: group.value.trim() || null, targets: [...chosen.values()], active: true,
      }, state.me.uid);
      toast('კამპანია შეიქმნა.', 'success');
      viewUceem(host);
    } catch (e) { toast(e.message || 'ვერ შეიქმნა', 'error'); }
  }));

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'UCEEM კამპანიის შექმნა' }),
      h('small', { class: 'muted', text: 'ანონიმური შეფასების პროცესი სემესტრის ბოლოს' })]),
    h('div', { class: 'body stack' }, [
      h('div', { class: 'grid grid-3' }, [
        h('div', { class: 'field' }, [h('label', { text: 'სახელი' }), title]),
        h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი *' }), deptSel]),
        h('div', { class: 'field' }, [h('label', { text: 'სასწავლო წელი' }), year]),
        h('div', { class: 'field' }, [h('label', { text: 'სემესტრი' }), semSel]),
        h('div', { class: 'field' }, [h('label', { text: 'ჯგუფი' }), group]),
      ]),
      h('div', { class: 'field' }, [h('label', { text: 'შესაფასებელი თანამშრომლები' }),
        h('div', { class: 'row' }, [staffSel, addStaffBtn]), chosenHost]),
      h('div', { class: 'row' }, [createBtn]),
    ]),
  ]));

  const rows = campaigns.map((c) => h('tr', {}, [
    h('td', { text: c.title || '—' }),
    h('td', { text: c.departmentId ? deptName(c.departmentId) : '—' }),
    h('td', { text: [c.academicYear, c.semester && (c.semester + ' სემ.'), c.group && ('ჯგ. ' + c.group)].filter(Boolean).join(' · ') || '—' }),
    h('td', { text: (c.targets || []).map((t) => `${t.name} (${E.roleLabel(t.role)})`).join(', ') || '—' }),
    h('td', { class: 'num' }, [h('span', { class: `pill ${c.active ? 'badge-ok' : 'badge-off'}`, text: c.active ? 'აქტიური' : 'დახურული' })]),
    h('td', { class: 'num' }, [h('div', { class: 'btn-group' }, [
      h('button', { class: 'sm secondary', text: 'UCEEM ლინკის კოპირება', onClick: () => copyCampaignLink(c) }),
      h('button', {
        class: 'sm ' + (c.active ? 'bad' : 'secondary'), text: c.active ? 'დახურვა' : 'გახსნა',
        onClick: async () => { await api.setCampaignActive(c.id, !c.active); toast('განახლდა.', 'success'); viewUceem(host); },
      }),
    ])]),
  ]));
  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: `კამპანიები (${campaigns.length})` })]),
    h('div', { class: 'body table-scroll' }, [
      campaigns.length
        ? h('table', {}, [h('thead', {}, [h('tr', {}, ['სახელი', 'დეპარტამენტი', 'კონტექსტი', 'თანამშრომლები', 'სტატუსი', 'მოქმედება'].map((t, i) => h('th', { class: i >= 4 ? 'num' : '', text: t })))]), h('tbody', {}, rows)])
        : h('div', { class: 'empty-note', text: 'კამპანია ჯერ არ შექმნილა.' }),
    ]),
  ]));
}

function campaignUrl(campaign) {
  const base = location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '').replace(/\?.*$/, '');
  const clean = base.endsWith('/') ? base : base + '/';
  const id = typeof campaign === 'string' ? campaign : campaign.id;
  const publicKey = typeof campaign === 'string' ? '' : (campaign.publicKey || '');
  return `${clean}uceem.html?c=${encodeURIComponent(id)}${publicKey ? `&k=${encodeURIComponent(publicKey)}` : ''}`;
}
async function copyCampaignLink(campaign) {
  if (!campaign.publicKey) {
    toast('ამ ძველ კამპანიას დაცული ბმულის key არ აქვს. შექმენით ახალი კამპანია.', 'error');
    return;
  }
  const url = campaignUrl(campaign);
  try { await navigator.clipboard.writeText(url); toast('ბმული დაკოპირდა.', 'success'); }
  catch (_) { window.prompt('დააკოპირეთ ბმული:', url); }
}
async function copyUceemLinkForContext(departmentId) {
  try {
    const campaigns = await api.listCampaigns();
    const match = campaigns.find((c) => c.active && (!departmentId || c.departmentId === departmentId));
    if (!match) { toast('ამ დეპარტამენტისთვის აქტიური კამპანია ვერ მოიძებნა. შექმენით UCEEM კამპანიების გვერდზე.', 'error'); return; }
    await copyCampaignLink(match);
  } catch (e) { toast(e.message || 'ვერ მოხერხდა', 'error'); }
}

// =========================================================================
// UCEEM RESULTS (admin) — aggregated, anonymous
// =========================================================================
async function viewUceemResults(host) {
  clear(host);
  const [responses, campaigns] = await Promise.all([api.listUceemResponses(), api.listCampaigns()]);
  const fDept = selectEl('r-dept', deptOptions(true), '');
  const fYear = h('input', { type: 'text', placeholder: 'სასწავლო წელი' });
  const fSem = h('input', { type: 'text', placeholder: 'სემესტრი' });
  const fGroup = h('input', { type: 'text', placeholder: 'ჯგუფი' });
  const fRole = selectEl('r-role', [{ value: '', label: 'ყველა როლი' }].concat(E.ROLES.map((r) => ({ value: r.value, label: r.label }))), '');
  const targetsAll = [];
  const seen = new Set();
  responses.forEach((r) => { if (r.targetUserId && !seen.has(r.targetUserId)) { seen.add(r.targetUserId); targetsAll.push({ id: r.targetUserId, name: r.targetName, role: r.targetRole }); } });
  const fTarget = selectEl('r-target', [{ value: '', label: 'ყველა თანამშრომელი' }].concat(targetsAll.map((t) => ({ value: t.id, label: `${t.name || t.id} (${E.roleLabel(t.role)})` }))), '');

  const resultHost = h('div', { id: 'uc-res' });
  function run() {
    const norm = (s) => (s || '').toString().toLowerCase();
    const filtered = responses.filter((r) =>
      (!fDept.value || r.departmentId === fDept.value) &&
      (!fYear.value.trim() || norm(r.academicYear) === norm(fYear.value)) &&
      (!fSem.value.trim() || norm(r.semester) === norm(fSem.value)) &&
      (!fGroup.value.trim() || norm(r.group) === norm(fGroup.value)) &&
      (!fRole.value || r.targetRole === fRole.value) &&
      (!fTarget.value || r.targetUserId === fTarget.value));
    renderUceemAggregate(resultHost, filtered);
  }
  const runBtn = h('button', { class: 'secondary', text: 'ფილტრი', onClick: run });
  const clearBtn = h('button', { class: 'ghost', text: 'გასუფთავება', onClick: () => {
    fDept.value = ''; fYear.value = ''; fSem.value = ''; fGroup.value = ''; fRole.value = ''; fTarget.value = ''; run();
  } });

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'UCEEM შედეგები' }),
      h('small', { class: 'muted', text: 'აგრეგირებული და ანონიმური — რომელმა სტუდენტმა შეავსო, არ ჩანს' })]),
    h('div', { class: 'body' }, [
      h('div', { class: 'filters' }, [
        h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), fDept]),
        h('div', { class: 'field' }, [h('label', { text: 'სასწავლო წელი' }), fYear]),
        h('div', { class: 'field' }, [h('label', { text: 'სემესტრი' }), fSem]),
        h('div', { class: 'field' }, [h('label', { text: 'ჯგუფი' }), fGroup]),
        h('div', { class: 'field' }, [h('label', { text: 'თანამშრომლის როლი' }), fRole]),
        h('div', { class: 'field' }, [h('label', { text: 'შესაფასებელი თანამშრომელი' }), fTarget]),
      ]),
      h('div', { class: 'row', style: 'margin-top:12px' }, [runBtn, clearBtn]),
    ]),
  ]));
  host.appendChild(resultHost);
  run();
}

function renderUceemAggregate(hostEl, responses) {
  clear(hostEl);
  if (!responses.length) {
    hostEl.appendChild(h('div', { class: 'card' }, [h('div', { class: 'body' }, [h('div', { class: 'empty-note', text: 'ამ ფილტრით პასუხი ვერ მოიძებნა.' })])]));
    return;
  }
  // Group by target staff.
  const byTarget = new Map();
  responses.forEach((r) => {
    const k = r.targetUserId || '—';
    if (!byTarget.has(k)) byTarget.set(k, { name: r.targetName, role: r.targetRole, list: [] });
    byTarget.get(k).list.push(r);
  });

  byTarget.forEach((grp) => {
    const n = grp.list.length;
    // aggregate section totals -> average per respondent, then percentages
    const secSum = { A1: 0, A2: 0, B1: 0, B2: 0 }; let totalSum = 0;
    grp.list.forEach((r) => {
      const cs = r.calculatedScores || {};
      totalSum += cs.total || 0;
      ['A1', 'A2', 'B1', 'B2'].forEach((s) => { secSum[s] += (cs.sections && cs.sections[s] ? cs.sections[s].total : 0); });
    });
    const avgTotal = totalSum / n;
    const secMax = { A1: 55, A2: 30, B1: 30, B2: 10 };
    const secAvg = {}; const secPct = {};
    ['A1', 'A2', 'B1', 'B2'].forEach((s) => { secAvg[s] = secSum[s] / n; secPct[s] = E.uceemPct(secAvg[s], secMax[s]); });
    const pTotal = E.uceemPct(avgTotal, E.UCEEM_TOTAL_MAX);
    const band = E.uceemBand(pTotal);

    const kpi = h('div', { class: 'kpi' }, [
      kbox('პასუხების რაოდენობა', String(n)),
      kbox('საერთო ქულა (საშ.)', `${avgTotal.toFixed(1)} / ${E.UCEEM_TOTAL_MAX}`),
      kbox('პროცენტი', `${pTotal}%`),
      kbox('ინტერპრეტაცია', band[0]),
    ]);
    const subTable = h('div', { class: 'table-scroll' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, ['ქვეკომპონენტი', 'საშ. ქულა', 'მაქს.', '%', 'კომენტარი'].map((t) => h('th', { text: t })))]),
      h('tbody', {}, ['A1', 'A2', 'B1', 'B2'].map((s) => h('tr', {}, [
        h('td', { text: s }),
        h('td', { class: 'num', text: secAvg[s].toFixed(1) }),
        h('td', { class: 'num', text: String(secMax[s]) }),
        h('td', { class: 'num', text: secPct[s] + '%' }),
        h('td', { text: E.uceemSubComment(s, secPct[s]) }),
      ]))),
    ])]);

    hostEl.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'section-title' }, [
        h('div', {}, [h('h3', { text: `${grp.name || '—'}` }), h('small', { class: 'muted', text: E.roleLabel(grp.role) })]),
      ]),
      h('div', { class: 'body stack' }, [
        kpi,
        h('div', { class: 'card', style: 'margin:0' }, [h('div', { class: 'body' }, [
          h('div', { class: 'muted', html: `<strong>${band[0]}</strong> — ${band[1]}` })])]),
        subTable,
      ]),
    ]));
  });
}

// =========================================================================
// PROFILE — change own password
// =========================================================================
async function viewProfile(host) {
  clear(host);
  const cur = h('input', { type: 'password', placeholder: 'მიმდინარე პაროლი' });
  const n1 = h('input', { type: 'password', placeholder: 'ახალი პაროლი' });
  const n2 = h('input', { type: 'password', placeholder: 'ახალი პაროლის გამეორება' });
  const saveBtn = h('button', { text: 'პაროლის შეცვლა' });
  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    if (!cur.value || !n1.value) { toast('შეავსეთ ველები.', 'error'); return; }
    if (n1.value !== n2.value) { toast('ახალი პაროლები არ ემთხვევა.', 'error'); return; }
    try {
      await api.changeUserPassword(state.me.uid, cur.value, n1.value);
      toast('პაროლი შეიცვალა.', 'success');
      cur.value = n1.value = n2.value = '';
    } catch (e) { toast(e.message || 'ვერ შეიცვალა', 'error'); }
  }));

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'პროფილი' })]),
    h('div', { class: 'body' }, [
      h('div', { class: 'kpi', style: 'margin-bottom:16px' }, [
        kbox('სახელი გვარი', `${state.me.firstName} ${state.me.lastName}`),
        kbox('მომხმარებელი', state.me.username || '—'),
        kbox('როლი', E.roleLabel(state.me.role)),
        kbox('დეპარტამენტი', state.me.departmentId ? deptName(state.me.departmentId) : '—'),
      ]),
      h('h3', { text: 'პაროლის შეცვლა' }),
      h('div', { class: 'grid grid-3', style: 'margin-top:8px' }, [
        h('div', { class: 'field' }, [h('label', { text: 'მიმდინარე პაროლი' }), cur]),
        h('div', { class: 'field' }, [h('label', { text: 'ახალი პაროლი' }), n1]),
        h('div', { class: 'field' }, [h('label', { text: 'გამეორება' }), n2]),
      ]),
      h('div', { class: 'row', style: 'margin-top:12px' }, [saveBtn]),
    ]),
  ]));
}
