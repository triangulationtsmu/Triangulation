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
    items.push({ id: 'uceem', label: 'UCEEM ბმული' });
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
const ASSESSMENT_TEMPLATE_FILES = {
  mini_cex: 'Mini_CEX_template.html',
  cbd: 'CBD_template.html',
  dops: 'DOPS_template.html',
  msf: 'MSF_template.html',
};

// =========================================================================
// WORKSPACE  (dept -> year/semester -> group -> students -> eval buttons)
// =========================================================================
async function viewWorkspace(host) {
  clear(host);
  const deptSel = selectEl('ws-dept', deptOptions(true), '');
  const firstInput = h('input', { type: 'text', id: 'ws-first', placeholder: 'სახელი' });
  const lastInput = h('input', { type: 'text', id: 'ws-last', placeholder: 'გვარი' });
  const yearInput = selectEl('ws-year', academicYearOptions(new Date().getFullYear(), 12, true), '');
  const semSel = selectEl('ws-sem', [{ value: '', label: 'ყველა სემესტრი' }].concat(
    ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((s) => ({ value: s, label: s + ' სემესტრი' }))));
  const groupInput = h('input', { type: 'text', id: 'ws-group', placeholder: 'ჯგუფის ნომერი/დასახელება' });

  const listHost = h('div', { id: 'ws-list' }, [h('div', { class: 'empty-note', text: 'აირჩიეთ პარამეტრები და დააჭირეთ „სტუდენტების ჩვენებას“.' })]);

  const loadBtn = h('button', { text: 'სტუდენტების ჩვენება' });
  const loadGuarded = guardButton(loadBtn, async () => {
    await loadWorkspaceStudents(listHost, {
      departmentId: deptSel.value || null,
      firstName: firstInput.value.trim(),
      lastName: lastInput.value.trim(),
      group: groupInput.value.trim(),
      semester: semSel.value, academicYear: yearInput.value.trim(),
    });
  });
  loadBtn.addEventListener('click', loadGuarded);

  const adminUceemBtn = state.me.isAdmin
    ? h('button', { class: 'secondary', text: 'UCEEM ლინკის კოპირება', onClick: () => copyUceemLinkForContext() })
    : null;

  const filtersCard = h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'სამუშაო სივრცე' }),
      h('small', { class: 'muted', text: 'დეპარტამენტი → სასწავლო წელი/სემესტრი → ჯგუფი → სტუდენტები' })]),
    h('div', { class: 'body' }, [
      h('div', { class: 'filters' }, [
        h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), deptSel]),
        h('div', { class: 'field' }, [h('label', { text: 'სახელი' }), firstInput]),
        h('div', { class: 'field' }, [h('label', { text: 'გვარი' }), lastInput]),
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

async function loadWorkspaceStudents(listHost, { departmentId, firstName, lastName, group, semester, academicYear }) {
  clear(listHost);
  listHost.appendChild(h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' სტუდენტები იტვირთება…']));
  let students = await api.queryStudents({ departmentId, group: group || null });
  const norm = (s) => (s || '').toString().toLowerCase();
  students = students.filter((s) =>
    (!firstName || norm(s.firstName).includes(norm(firstName))) &&
    (!lastName || norm(s.lastName).includes(norm(lastName))) &&
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
      h('small', { class: 'muted', text: departmentId ? deptName(departmentId) : 'ყველა დეპარტამენტი' })]),
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
    ['Mini-CEX', () => openTemplateEvalForm('mini_cex', student)],
    ['CBD', () => openTemplateEvalForm('cbd', student)],
    ['DOPS', () => openTemplateEvalForm('dops', student)],
    ['MSF', () => openTemplateEvalForm('msf', student)],
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

function openStandaloneTool(fileName) {
  window.open(new URL(fileName, location.href).href, '_blank', 'noopener');
}

function roleForTemplate(role) {
  const map = {
    curator: 'კურატორი',
    doctor: 'ექიმი',
    department_head: 'დეპარტამენტის ხელმძღვანელი',
    nurse: 'ექთანი',
    lecturer: 'ლექტორი',
    assessor: 'სხვა შესაბამისი შემფასებელი',
  };
  return map[role] || E.roleLabel(role);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
async function openTemplateEvalForm(type, student) {
  const fileName = ASSESSMENT_TEMPLATE_FILES[type];
  if (!fileName) return openEvalForm(type, student);
  if (!['department_head', 'curator', 'doctor', 'nurse', 'lecturer', 'assessor'].includes(state.me.role) && !state.me.isAdmin) {
    toast('შეფასების შევსების უფლება არ გაქვთ.', 'error'); return;
  }
  const content = h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']);
  const modal = openModal({ title: `${E.FORMS[type].label} — ${student.lastName} ${student.firstName}`, content, width: '1180px' });
  const onMessage = async (event) => {
    const data = event.data || {};
    if (data.source !== 'triangulation-template-save' || data.token !== token) return;
    try {
      await saveTemplateEvaluation(type, student, data.payload || {});
      toast('შეფასება Firestore-ში შენახულია.', 'success');
      window.removeEventListener('message', onMessage);
      modal.close();
    } catch (e) {
      toast(e.message || 'შენახვა ვერ მოხერხდა.', 'error');
    }
  };
  const token = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.addEventListener('message', onMessage);
  try {
    const html = await (await fetch(fileName, { cache: 'no-store' })).text();
    clear(modal.body);
    const iframe = h('iframe', { class: 'tool-frame', title: E.FORMS[type].label });
    modal.body.appendChild(iframe);
    iframe.srcdoc = html.replace('</body>', templateBridgeScript(type, student, token) + '</body>');
  } catch (e) {
    window.removeEventListener('message', onMessage);
    clear(modal.body);
    modal.body.appendChild(h('div', { class: 'empty-note', text: 'ფორმის ჩატვირთვა ვერ მოხერხდა.' }));
  }
}
function templateBridgeScript(type, student, token) {
  const meta = {
    token,
    type,
    studentName: `${student.lastName} ${student.firstName}`,
    department: student.departmentId ? deptName(student.departmentId) : deptName(state.me.departmentId),
    evaluatorName: `${state.me.firstName} ${state.me.lastName}`,
    evaluatorRole: roleForTemplate(state.me.role),
    group: student.group || '',
    semester: student.semester || '',
    curation: student.curation || '',
    curationStart: student.curationStart || '',
    curationEnd: student.curationEnd || '',
    date: todayIso(),
  };
  return `<script>
(function(){
 const META=${JSON.stringify(meta)};
 function setValue(id,value,lock){
   const el=document.getElementById(id); if(!el) return;
   if(el.tagName==='SELECT' && value && ![...el.options].some(o=>o.value===value || o.textContent===value)){
     const opt=document.createElement('option'); opt.value=value; opt.textContent=value; el.appendChild(opt);
   }
   el.value=value||''; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
   if(lock) el.disabled=true;
 }
 function ensureRoleSelect(){
   let role=document.getElementById('role');
   if(role) return role;
   const anchor=document.getElementById('assessor') || document.getElementById('rater');
   if(!anchor || !anchor.parentElement) return null;
   const label=document.createElement('label');
   label.textContent='შემფასებლის როლი';
   role=document.createElement('select');
   role.id='role';
   ['','კურატორი','ექიმი','ექთანი','დეპარტამენტის ხელმძღვანელი','ლექტორი','სხვა შესაბამისი შემფასებელი'].forEach(text=>{
     const opt=document.createElement('option'); opt.value=text; opt.textContent=text || 'აირჩიეთ'; role.appendChild(opt);
   });
   anchor.insertAdjacentElement('afterend', role);
   anchor.insertAdjacentElement('afterend', label);
   return role;
 }
 function init(){
   ensureRoleSelect();
   setValue('trainee', META.studentName, true);
   setValue('studentName', META.studentName, true);
   setValue('assessor', META.evaluatorName, false);
   setValue('rater', META.evaluatorName, false);
   setValue('setting', META.department, true);
   setValue('dept', META.department, true);
   setValue('role', META.evaluatorRole, false);
   setValue('group', META.group, true);
   setValue('semester', META.semester, true);
   setValue('curation', META.curation, true);
   setValue('rotation', META.curation, true);
   setValue('curationStart', META.curationStart, true);
   setValue('rotationStart', META.curationStart, true);
   setValue('curationEnd', META.curationEnd, true);
   setValue('rotationEnd', META.curationEnd, true);
   setValue('date', META.date, false);
   window.saveData=saveFirestore;
   const saveBtn=[...document.querySelectorAll('button')].find(b=>/შენახ/.test(b.textContent));
   if(saveBtn) saveBtn.textContent='შენახვა';
   if(typeof calc==='function') calc();
 }
 function collect(){
   const values={}; document.querySelectorAll('input,textarea,select').forEach(el=>{ if(el.id) values[el.id]=el.value; });
   const answers={}; document.querySelectorAll('select.score').forEach(el=>{ if(el.id) answers[el.id]=el.value; });
   const scores={
     total:Number((document.getElementById('totalScore')||{}).textContent||0),
     completed:Number((document.getElementById('completed')||{}).textContent||0),
     average:Number((document.getElementById('average')||{}).textContent||0),
     judgment:(document.getElementById('judgment')||{}).textContent||''
   };
   return {values,answers,scores,summary:{
     caseName: values.case_name || values.caseName || '',
     strengths: values.strengths || '',
     improve: values.improve || '',
     plan: values.plan || '',
     followup: values.followup || '',
     priorities: values.priorities || '',
     evaluatorName: values.assessor || values.rater || values.evaluator || '',
     evaluatorRole: values.role || ''
   }};
 }
 function saveFirestore(){
   if(typeof calc==='function') calc();
   parent.postMessage({source:'triangulation-template-save',token:META.token,payload:collect()}, '*');
 }
 window.addEventListener('DOMContentLoaded', init);
 setTimeout(init, 50);
})();
<\/script>`;
}
async function saveTemplateEvaluation(type, student, payload) {
  const form = E.FORMS[type];
  const scores = payload.scores || {};
  if (Number(scores.completed || 0) < form.domains.length) {
    throw new Error('შეავსეთ ყველა დომენი (1-8).');
  }
  const summary = payload.summary || {};
  const evaluatorName = String(summary.evaluatorName || '').trim() || `${state.me.firstName} ${state.me.lastName}`;
  const evaluatorParts = evaluatorName.split(/\s+/).filter(Boolean);
  const evaluatorFirstName = evaluatorParts.slice(0, -1).join(' ') || evaluatorName;
  const evaluatorLastName = evaluatorParts.length > 1 ? evaluatorParts.at(-1) : '';
  const evaluatorRole = String(summary.evaluatorRole || '').trim() || roleForTemplate(state.me.role);
  await api.createEvaluation({
    studentId: student.id,
    type,
    departmentId: student.departmentId || state.me.departmentId || null,
    group: student.group || null,
    semester: student.semester || null,
    course: student.course || null,
    academicYear: student.academicYear || null,
    evaluatorUid: state.me.uid,
    evaluatorFirstName,
    evaluatorLastName,
    evaluatorRole,
    answers: payload.answers || {},
    scores,
    summary,
    formValues: payload.values || {},
  });
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
  const modal = openModal({ title: `WBA Summary — ${student.lastName} ${student.firstName}`, content, width: '1180px' });
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
  await renderStandaloneReport(modal, 'WBA.html', `<script>
    (function(){
      const state=${JSON.stringify({
        student: {
          name: `${student.lastName} ${student.firstName}`,
          group: student.group || '',
          rotation: student.curation || '',
          rotationStart: student.curationStart || '',
          rotationEnd: student.curationEnd || '',
        },
        entries,
      })};
      function boot(){
        if(typeof applyState==='function') applyState(state);
        if(typeof showRadar==='function') showRadar();
      }
      window.addEventListener('DOMContentLoaded', boot);
      window.addEventListener('load', boot);
      setTimeout(boot, 80);
      setTimeout(boot, 250);
      setTimeout(boot, 700);
    })();
  <\/script>`);
}

// =========================================================================
// MSF RESUME  (per student: MSF)
// =========================================================================
async function openMsfResume(student) {
  const content = h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']);
  const modal = openModal({ title: `MSF Resume — ${student.lastName} ${student.firstName}`, content, width: '1180px' });
  let msfEvals = [];
  try { msfEvals = await api.listEvaluationsByStudent(student.id, 'msf'); }
  catch (e) { console.error(e); }

  const entries = msfEvals.map(E.msfEntryFromEvaluation);
  await renderStandaloneReport(modal, 'MSF Resume.html', `<script>
    (function(){
      const student=${JSON.stringify({
        studentName: `${student.lastName} ${student.firstName}`,
        group: student.group || '',
        semester: student.semester || '',
        curation: student.curation || '',
        curationStart: student.curationStart || '',
        curationEnd: student.curationEnd || '',
      })};
      const entries=${JSON.stringify(entries)};
      function boot(){
        if(typeof els !== 'undefined'){
          els.studentName.value=student.studentName||'';
          els.group.value=student.group||'';
          els.semester.value=student.semester||'';
          els.curation.value=student.curation||'';
          els.curationStart.value=student.curationStart||'';
          els.curationEnd.value=student.curationEnd||'';
        }
        if(typeof msfEntries !== 'undefined') msfEntries=entries;
        if(typeof renderTable==='function') renderTable();
        if(entries.length && typeof renderRadarChart==='function') renderRadarChart();
        if(entries.length && typeof generateResume==='function') generateResume();
      }
      window.addEventListener('DOMContentLoaded', boot);
      window.addEventListener('load', boot);
      setTimeout(boot, 80);
      setTimeout(boot, 250);
      setTimeout(boot, 700);
    })();
  <\/script>`);
}

async function renderStandaloneReport(modal, fileName, bridgeScript) {
  try {
    const html = await (await fetch(fileName, { cache: 'no-store' })).text();
    clear(modal.body);
    const iframe = h('iframe', { class: 'tool-frame', title: fileName });
    modal.body.appendChild(iframe);
    iframe.srcdoc = html.replace('</body>', bridgeScript + '</body>');
  } catch (e) {
    clear(modal.body);
    modal.body.appendChild(h('div', { class: 'empty-note', text: 'ანგარიშის ჩატვირთვა ვერ მოხერხდა.' }));
  }
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
      h('button', { class: 'sm ghost', text: 'რედაქტ.', onClick: () => openUserForm(host, u) }),
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
      h('button', { class: 'sm bad', text: 'წაშლა', onClick: async () => {
        if (u.uid === state.me.uid) { toast('საკუთარი ანგარიშის წაშლა შეუძლებელია.', 'error'); return; }
        const ok = await confirmDialog(`ნამდვილად წავშალო მომხმარებელი „${u.firstName} ${u.lastName}“?`);
        if (!ok) return;
        try { await api.deleteUserAccount(u.uid); toast('მომხმარებელი წაიშალა.', 'success'); viewUsers(host); }
        catch (e) { toast(e.message || 'ვერ წაიშალა', 'error'); }
      } }),
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

function openUserForm(host, existing = null) {
  const username = h('input', { type: 'text', placeholder: 'username', value: existing?.username || '' });
  const password = h('input', { type: 'text', placeholder: 'პაროლი' });
  const firstName = h('input', { type: 'text', value: existing?.firstName || '' });
  const lastName = h('input', { type: 'text', value: existing?.lastName || '' });
  const roleSel = selectEl('nu-role', E.ROLES.map((r) => ({ value: r.value, label: r.label })), existing?.role || 'curator');
  const deptSel = selectEl('nu-dept', deptOptions(true), existing?.departmentId || '');
  const activeSel = selectEl('nu-active', [{ value: 'true', label: 'აქტიური' }, { value: 'false', label: 'გათიშული' }],
    existing ? (existing.active !== false ? 'true' : 'false') : 'true');

  const body = h('div', { class: 'grid grid-2' }, [
    h('div', { class: 'field' }, [h('label', { text: 'მომხმარებელი (username) *' }), username]),
    existing ? null : h('div', { class: 'field' }, [h('label', { text: 'პაროლი *' }), password]),
    h('div', { class: 'field' }, [h('label', { text: 'სახელი *' }), firstName]),
    h('div', { class: 'field' }, [h('label', { text: 'გვარი *' }), lastName]),
    h('div', { class: 'field' }, [h('label', { text: 'როლი *' }), roleSel]),
    h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), deptSel]),
    h('div', { class: 'field' }, [h('label', { text: 'აქტიურია თუ არა' }), activeSel]),
  ].filter(Boolean));
  const saveBtn = h('button', { text: existing ? 'შენახვა' : 'შექმნა' });
  const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
  const modal = openModal({ title: existing ? 'მომხმარებლის რედაქტირება' : 'ახალი მომხმარებელი', content: body, footer: [cancelBtn, saveBtn], width: '760px' });
  cancelBtn.addEventListener('click', () => modal.close());

  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    const data = {
      username: username.value.trim(), password: password.value,
      firstName: firstName.value.trim(), lastName: lastName.value.trim(),
      role: roleSel.value, departmentId: deptSel.value || null, active: activeSel.value === 'true',
    };
    if (!data.username || (!existing && !data.password) || !data.firstName || !data.lastName || !data.role) {
      toast('შეავსეთ ყველა სავალდებულო ველი (*).', 'error'); return;
    }
    if (existing?.uid === state.me.uid && data.active === false) {
      toast('საკუთარი ანგარიშის გათიშვა შეუძლებელია.', 'error'); return;
    }
    try {
      if (existing) { await api.updateUserAccount(existing.uid, data); toast('მომხმარებელი განახლდა.', 'success'); }
      else { await api.createUserAccount(data, state.me.uid); toast('მომხმარებელი შეიქმნა.', 'success'); }
      modal.close(); viewUsers(host);
    } catch (e) { toast(e.message || 'ვერ შეინახა', 'error'); }
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
  const curationInput = h('input', { type: 'text', placeholder: 'კურაციის დასახელება' });
  const curationStartInput = h('input', { type: 'date' });
  const curationEndInput = h('input', { type: 'date' });
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
        h('div', { class: 'field' }, [h('label', { text: 'კურაცია *' }), curationInput]),
        h('div', { class: 'field' }, [h('label', { text: 'კურაციის დაწყება *' }), curationStartInput]),
        h('div', { class: 'field' }, [h('label', { text: 'კურაციის დასრულება *' }), curationEndInput]),
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
    if (!deptSel.value || !yearSel.value || !curationInput.value.trim() || !curationStartInput.value || !curationEndInput.value) {
      toast('შეავსეთ დეპარტამენტი, სასწავლო წელი და კურაციის ველები.', 'error'); return;
    }
    if (!parsed || !parsed.students.length) { toast('PDF-დან სტუდენტები ვერ ამოიცნო.', 'error'); return; }
    const groupName = nameInput.value.trim() || `ჯგუფი ${parsed.group || ''}`.trim();
    const studentRows = parsed.students.map((s) => ({
      ...s,
      departmentId: deptSel.value,
      group: parsed.group || groupName,
      semester: parsed.semester,
      course: parsed.course,
      academicYear: yearSel.value,
      curation: curationInput.value.trim(),
      curationStart: curationStartInput.value,
      curationEnd: curationEndInput.value,
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
        curation: curationInput.value.trim(),
        curationStart: curationStartInput.value,
        curationEnd: curationEndInput.value,
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
  const curation = h('input', { type: 'text', value: existing?.curation || '', placeholder: 'კურაციის დასახელება' });
  const curationStart = h('input', { type: 'date', value: existing?.curationStart || '' });
  const curationEnd = h('input', { type: 'date', value: existing?.curationEnd || '' });
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
    h('div', { class: 'field' }, [h('label', { text: 'კურაცია *' }), curation]),
    h('div', { class: 'field' }, [h('label', { text: 'კურაციის დაწყება *' }), curationStart]),
    h('div', { class: 'field' }, [h('label', { text: 'კურაციის დასრულება *' }), curationEnd]),
    h('div', { class: 'field' }, [h('label', { text: 'შეჭრილია თუ არა *' }), shech]),
  ];
  if (deptSel) fields.push(h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), deptSel]));

  const saveBtn = h('button', { text: existing ? 'განახლება' : 'დამატება' });
  const cancelBtn = h('button', { class: 'ghost', text: 'გაუქმება' });
  const modal = openModal({ title: existing ? 'სტუდენტის რედაქტირება' : 'სტუდენტის დამატება', content: h('div', { class: 'grid grid-2' }, fields), footer: [cancelBtn, saveBtn], width: '760px' });
  cancelBtn.addEventListener('click', () => modal.close());

  saveBtn.addEventListener('click', guardButton(saveBtn, async () => {
    if (!firstName.value.trim() || !lastName.value.trim() || !group.value.trim() ||
        !semester.value.trim() || !course.value.trim() || !year.value.trim() ||
        !curation.value.trim() || !curationStart.value || !curationEnd.value || !shech.value) {
      toast('შეავსეთ ყველა სავალდებულო ველი (*).', 'error'); return;
    }
    const departmentId = canChooseDept ? (deptSel.value || null) : state.me.departmentId;
    const data = {
      firstName: firstName.value.trim(), lastName: lastName.value.trim(),
      phone: phone.value.trim(), group: group.value.trim(),
      semester: semester.value.trim(), course: course.value.trim(),
      academicYear: year.value.trim(), isShechrili: shech.value === 'yes',
      curation: curation.value.trim(), curationStart: curationStart.value, curationEnd: curationEnd.value,
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
  const url = publicUceemUrl();
  const copyBtn = h('button', { text: 'UCEEM ლინკის კოპირება', onClick: copyUceemLinkForContext });
  const openBtn = h('button', { class: 'secondary', text: 'ფორმის გახსნა', onClick: () => window.open(url, '_blank', 'noopener') });

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'UCEEM საჯარო ბმული' }),
      h('small', { class: 'muted', text: 'სტუდენტს უგზავნით ამ ბმულს. ფორმა პირდაპირ იხსნება.' })]),
    h('div', { class: 'body stack' }, [
      h('div', { class: 'field' }, [h('label', { text: 'ბმული' }), h('input', { type: 'text', value: url, readonly: 'true' })]),
      h('div', { class: 'row' }, [copyBtn, openBtn]),
      h('div', { class: 'empty-note', text: 'სტუდენტი ფორმაში ირჩევს დეპარტამენტს, კურაციას, სემესტრს და ჯგუფს. სახელი/გვარი არ მოითხოვება.' }),
    ]),
  ]));
}

function publicUceemUrl() {
  const base = location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '').replace(/\?.*$/, '');
  const clean = base.endsWith('/') ? base : base + '/';
  return `${clean}uceem.html`;
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
async function copyUceemLinkForContext() {
  const url = publicUceemUrl();
  try { await navigator.clipboard.writeText(url); toast('UCEEM ბმული დაკოპირდა.', 'success'); }
  catch (_) { window.prompt('დააკოპირეთ ბმული:', url); }
}

// =========================================================================
// UCEEM RESULTS (admin) — aggregated, anonymous
// =========================================================================
async function viewUceemResults(host) {
  clear(host);
  const [responses, students] = await Promise.all([api.listUceemResponses(), api.queryStudents({})]);
  const normalizedResponses = responses.map((r) => ({ ...r, curation: uceemResponseCuration(r) }));
  const contextRows = [...normalizedResponses, ...students];
  const uniq = (key) => [...new Set(contextRows.map((r) => String(r[key] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ka'));
  const fDept = selectEl('r-dept', deptOptions(true), '');
  const fYear = selectEl('r-year', [{ value: '', label: 'ყველა სასწავლო წელი' }].concat(uniq('academicYear').map((v) => ({ value: v, label: v }))), '');
  const fCuration = selectEl('r-curation', [{ value: '', label: 'ყველა კურაცია' }].concat(uniq('curation').map((v) => ({ value: v, label: v }))), '');
  const fSem = selectEl('r-sem', [{ value: '', label: 'ყველა სემესტრი' }].concat(uniq('semester').map((v) => ({ value: v, label: v }))), '');
  const fGroup = selectEl('r-group', [{ value: '', label: 'ყველა ჯგუფი' }].concat(uniq('group').map((v) => ({ value: v, label: v }))), '');
  const fRole = selectEl('r-role', [{ value: '', label: 'ყველა როლი' }].concat(E.ROLES.map((r) => ({ value: r.value, label: r.label }))), '');
  const targetsAll = [];
  const seen = new Set();
  responses.forEach((r) => { if (r.targetUserId && !seen.has(r.targetUserId)) { seen.add(r.targetUserId); targetsAll.push({ id: r.targetUserId, name: r.targetName, role: r.targetRole }); } });
  const fTarget = selectEl('r-target', [{ value: '', label: 'ყველა თანამშრომელი' }].concat(targetsAll.map((t) => ({ value: t.id, label: `${t.name || t.id} (${E.roleLabel(t.role)})` }))), '');

  const resultHost = h('div', { id: 'uc-res' });
  function run() {
    const norm = (s) => (s || '').toString().toLowerCase();
    const filtered = normalizedResponses.filter((r) =>
      (!fDept.value || r.departmentId === fDept.value) &&
      (!fYear.value || norm(r.academicYear) === norm(fYear.value)) &&
      (!fCuration.value || norm(r.curation) === norm(fCuration.value)) &&
      (!fSem.value || norm(r.semester) === norm(fSem.value)) &&
      (!fGroup.value || norm(r.group) === norm(fGroup.value)) &&
      (!fRole.value || r.targetRole === fRole.value) &&
      (!fTarget.value || r.targetUserId === fTarget.value));
    renderUceemAggregate(resultHost, filtered);
  }
  const runBtn = h('button', { class: 'secondary', text: 'ფილტრი', onClick: run });
  const clearBtn = h('button', { class: 'ghost', text: 'გასუფთავება', onClick: () => {
    fDept.value = ''; fYear.value = ''; fCuration.value = ''; fSem.value = ''; fGroup.value = ''; fRole.value = ''; fTarget.value = ''; run();
  } });

  host.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'UCEEM შედეგები' }),
      h('small', { class: 'muted', text: 'აგრეგირებული და ანონიმური — რომელმა სტუდენტმა შეავსო, არ ჩანს' })]),
    h('div', { class: 'body' }, [
      h('div', { class: 'filters' }, [
        h('div', { class: 'field' }, [h('label', { text: 'დეპარტამენტი' }), fDept]),
        h('div', { class: 'field' }, [h('label', { text: 'სასწავლო წელი' }), fYear]),
        h('div', { class: 'field' }, [h('label', { text: 'კურაცია' }), fCuration]),
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
  hostEl.appendChild(renderUceemCorrelation(responses));

  // New direct UCEEM responses are grouped by learning context; older campaign
  // responses still group by target staff so historical data remains readable.
  const byTarget = new Map();
  responses.forEach((r) => {
    const k = r.targetUserId || [r.departmentId || '', r.curation || '', r.semester || '', r.group || ''].join('|');
    if (!byTarget.has(k)) byTarget.set(k, { name: r.targetName, role: r.targetRole, sample: r, list: [] });
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
        h('div', {}, [
          h('h3', { text: grp.name || uceemContextTitle(grp.sample) }),
          h('small', { class: 'muted', text: grp.name ? E.roleLabel(grp.role) : 'ანონიმური სასწავლო გარემოს შეფასება' }),
        ]),
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
function uceemResponseCuration(r) {
  if (r.curation) return r.curation;
  const parts = String(r.campaignId || '').split('|');
  return parts[0] === 'uceem-context' ? (parts[2] || '') : '';
}
function uceemContextTitle(r) {
  return [
    r.departmentId ? deptName(r.departmentId) : '',
    r.curation || '',
    r.semester ? `${r.semester} სემ.` : '',
    r.group ? `ჯგ. ${r.group}` : '',
  ].filter(Boolean).join(' · ') || 'UCEEM კონტექსტი';
}
function renderUceemCorrelation(responses) {
  const groups = new Map();
  responses.forEach((r) => {
    const key = [r.departmentId || '', r.curation || '', r.semester || '', r.group || ''].join('|');
    if (!groups.has(key)) groups.set(key, { sample: r, list: [] });
    groups.get(key).list.push(r);
  });
  const rows = [...groups.values()].map((grp) => {
    const n = grp.list.length;
    const avg = grp.list.reduce((sum, r) => sum + Number(r.calculatedScores?.total || 0), 0) / n;
    const pct = E.uceemPct(avg, E.UCEEM_TOTAL_MAX);
    const band = E.uceemBand(pct);
    return { ...grp, n, avg, pct, band };
  }).sort((a, b) => b.pct - a.pct);

  const allAvg = responses.reduce((sum, r) => sum + Number(r.calculatedScores?.total || 0), 0) / responses.length;
  const allPct = E.uceemPct(allAvg, E.UCEEM_TOTAL_MAX);
  return h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('h2', { text: 'UCEEM სტატისტიკა და კორელაცია' }),
      h('small', { class: 'muted', text: 'კონტექსტების შედარება: დეპარტამენტი / კურაცია / სემესტრი / ჯგუფი' })]),
    h('div', { class: 'body stack' }, [
      h('div', { class: 'kpi' }, [
        kbox('პასუხები სულ', String(responses.length)),
        kbox('კონტექსტები', String(rows.length)),
        kbox('საერთო საშუალო', `${allAvg.toFixed(1)} / ${E.UCEEM_TOTAL_MAX}`),
        kbox('საერთო პროცენტი', `${allPct}%`),
      ]),
      h('div', { class: 'table-scroll' }, [h('table', {}, [
        h('thead', {}, [h('tr', {}, ['დეპარტამენტი', 'კურაცია', 'სემესტრი', 'ჯგუფი', 'პასუხები', 'საშ. ქულა', '%', 'ინტერპრეტაცია']
          .map((t, i) => h('th', { class: i >= 4 ? 'num' : '', text: t })))]),
        h('tbody', {}, rows.map((row) => h('tr', {}, [
          h('td', { text: row.sample.departmentId ? deptName(row.sample.departmentId) : '—' }),
          h('td', { text: row.sample.curation || '—' }),
          h('td', { text: row.sample.semester || '—' }),
          h('td', { text: row.sample.group || '—' }),
          h('td', { class: 'num', text: String(row.n) }),
          h('td', { class: 'num', text: row.avg.toFixed(1) }),
          h('td', { class: 'num', text: `${row.pct}%` }),
          h('td', { text: row.band[0] }),
        ]))),
      ])]),
    ]),
  ]);
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
