// Public, anonymous UCEEM form. No student identity is requested or stored.
import { listDepartments, queryStudents, createUceemResponse } from './api.js';
import { h, toast, guardButton, clear } from './ui.js';
import {
  UCEEM_SECTIONS, UCEEM_FIXED_SCALE_LABELS, UCEEM_TOTAL_ITEMS,
  computeUceemScores, uceemPct, uceemBand, uceemSubComment,
} from './engines.js';

const root = () => document.getElementById('uceem-root');
let departments = [];
let students = [];
let selectors = {};
let scoreNodes = {};

boot();

async function boot() {
  const r = root();
  clear(r);
  r.appendChild(h('div', { class: 'loading-overlay' }, [h('span', { class: 'spinner' }), ' იტვირთება…']));
  try {
    [departments, students] = await Promise.all([listDepartments(), queryStudents({})]);
    students = students.filter((s) => s.groupArchived !== true);
    renderForm();
  } catch (e) {
    console.error(e);
    clear(r);
    r.appendChild(h('div', { class: 'empty-note', text: 'ფორმის ჩატვირთვა ვერ მოხერხდა.' }));
  }
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ka'));
}
function selectedStudents() {
  return students.filter((s) =>
    (!selectors.department.value || s.departmentId === selectors.department.value) &&
    (!selectors.curation.value || s.curation === selectors.curation.value) &&
    (!selectors.semester.value || s.semester === selectors.semester.value) &&
    (!selectors.group.value || s.group === selectors.group.value));
}
function refreshDependentOptions() {
  const deptId = selectors.department.value;
  const deptStudents = students.filter((s) => !deptId || s.departmentId === deptId);
  fillSelect(selectors.curation, uniqueSorted(deptStudents.map((s) => s.curation)), 'აირჩიეთ კურაცია');

  const curationStudents = deptStudents.filter((s) => !selectors.curation.value || s.curation === selectors.curation.value);
  fillSelect(selectors.semester, uniqueSorted(curationStudents.map((s) => s.semester)), 'აირჩიეთ სემესტრი');

  const semesterStudents = curationStudents.filter((s) => !selectors.semester.value || s.semester === selectors.semester.value);
  fillSelect(selectors.group, uniqueSorted(semesterStudents.map((s) => s.group)), 'აირჩიეთ ჯგუფი');
}
function fillSelect(select, values, placeholder) {
  const current = select.value;
  clear(select);
  select.appendChild(h('option', { value: '', text: placeholder }));
  values.forEach((value) => select.appendChild(h('option', { value, text: value })));
  select.value = values.includes(current) ? current : '';
}

function renderForm() {
  const r = root();
  clear(r);

  const deptOptions = departments
    .filter((d) => d.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'ka'));
  selectors.department = h('select', { id: 'dept' });
  selectors.department.appendChild(h('option', { value: '', text: 'აირჩიეთ დეპარტამენტი' }));
  deptOptions.forEach((d) => selectors.department.appendChild(h('option', { value: d.id, text: d.name })));
  selectors.curation = h('select', { id: 'rotation' });
  selectors.semester = h('select', { id: 'semester' });
  selectors.group = h('select', { id: 'group' });

  const contextCard = h('div', { class: 'card no-print' }, [
    h('div', { class: 'p24 grid grid-4' }, [
      h('div', {}, [h('label', { text: 'დეპარტამენტი' }), selectors.department]),
      h('div', {}, [h('label', { text: 'კურაცია' }), selectors.curation]),
      h('div', {}, [h('label', { text: 'სემესტრი' }), selectors.semester]),
      h('div', {}, [h('label', { text: 'ჯგუფი' }), selectors.group]),
    ]),
    h('div', { class: 'p24', style: 'padding-top:0' }, [
      h('label', { text: 'ლაიკერტის ფიქსირებული სკალა' }),
      h('div', { class: 'fixed-scale' }, UCEEM_FIXED_SCALE_LABELS.map((label, i) =>
        h('div', { class: 'choice' }, [h('strong', { text: String(i + 1) }), h('span', { text: label })]))),
    ]),
  ]);
  r.appendChild(contextCard);

  [selectors.department, selectors.curation, selectors.semester].forEach((el) => el.addEventListener('change', refreshDependentOptions));
  refreshDependentOptions();

  const sectionsHost = h('div', { id: 'formSections' });
  UCEEM_SECTIONS.forEach((sec) => {
    const items = sec.items.map((txt, idx) => {
      const code = `${sec.id}.${idx + 1}`;
      const scale = h('div', { class: 'scale' }, [1, 2, 3, 4, 5].map((val) => {
        const radio = h('input', { type: 'radio', name: `score_${code}`, value: String(val), onChange: calculateAll });
        return h('label', { class: 'choice' }, [radio, h('strong', { text: String(val) }), h('span', { text: UCEEM_FIXED_SCALE_LABELS[val - 1] })]);
      }));
      return h('div', { class: 'item' }, [
        h('div', { class: 'item-top' }, [
          h('div', { class: 'item-code', text: code }),
          h('div', {}, [h('label', { text: 'პუნქტის ტექსტი' }), h('div', { class: 'item-text', text: txt })]),
        ]),
        scale,
      ]);
    });
    sectionsHost.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'section-title' }, [h('div', {}, [h('h2', { text: sec.title }), h('small', { text: `მაქსიმუმი: ${sec.max} ქულა` })])]),
      h('div', { class: 'p24', style: 'padding-bottom:0' }, [h('div', { class: 'note', text: sec.desc })]),
      h('div', { class: 'items' }, items),
    ]));
  });
  r.appendChild(sectionsHost);
  r.appendChild(resultsCard());

  const submitBtn = h('button', { text: 'გაგზავნა' });
  r.appendChild(h('div', { class: 'toolbar no-print' }, [submitBtn]));
  submitBtn.addEventListener('click', guardButton(submitBtn, submit));
  calculateAll();
}

function resultsCard() {
  scoreNodes = {
    total: h('span', { text: '0' }),
    a1: h('span', { text: '0' }),
    a2: h('span', { text: '0' }),
    b1: h('span', { text: '0' }),
    b2: h('span', { text: '0' }),
    totalPct: h('div', { class: 'footer-note', text: '0%' }),
    a1Pct: h('div', { class: 'footer-note', text: '0%' }),
    a2Pct: h('div', { class: 'footer-note', text: '0%' }),
    b1Pct: h('div', { class: 'footer-note', text: '0%' }),
    b2Pct: h('div', { class: 'footer-note', text: '0%' }),
    answered: h('span', { text: '0' }),
    missing: h('div', { class: 'footer-note', text: 'არასრული მონაცემები' }),
    interp: h('div', { class: 'note', text: 'შეფასების დასაწყებად მონიშნეთ პუნქტები.' }),
    sub: h('div', { style: 'margin-top:14px' }),
  };
  return h('div', { class: 'card' }, [
    h('div', { class: 'section-title' }, [h('div', {}, [h('h2', { text: 'შედეგები' }), h('small', { text: 'სრულდება ავტომატურად. აუცილებელია ყველა პუნქტის შეფასება.' })])]),
    h('div', { class: 'p24' }, [
      h('div', { class: 'results-grid' }, [
        resultBox('საერთო ქულა', scoreNodes.total, ' / 125', scoreNodes.totalPct),
        resultBox('A1 ქულა', scoreNodes.a1, ' / 55', scoreNodes.a1Pct),
        resultBox('A2 ქულა', scoreNodes.a2, ' / 30', scoreNodes.a2Pct),
        resultBox('B1 ქულა', scoreNodes.b1, ' / 30', scoreNodes.b1Pct),
        resultBox('B2 ქულა', scoreNodes.b2, ' / 10', scoreNodes.b2Pct),
      ]),
      h('div', { class: 'interp' }, [
        h('div', { class: 'interp-card' }, [h('h3', { text: 'ინტერპრეტაცია' }), scoreNodes.interp, scoreNodes.sub]),
        h('div', { class: 'interp-card' }, [h('h3', { text: 'სრულყოფა' }), h('div', { class: 'result-box', style: 'padding:12px' }, [
          h('div', { class: 'k', text: 'შევსებული პუნქტები' }),
          h('div', { class: 'v' }, [scoreNodes.answered, ' / 25']),
          scoreNodes.missing,
        ])]),
      ]),
    ]),
  ]);
}
function resultBox(label, valueNode, suffix, pctNode) {
  return h('div', { class: 'result-box' }, [
    h('div', { class: 'k', text: label }),
    h('div', { class: 'v' }, [valueNode, suffix]),
    pctNode,
  ]);
}
function collectAnswers() {
  const answers = {};
  UCEEM_SECTIONS.forEach((sec) => sec.items.forEach((_, idx) => {
    const code = `${sec.id}.${idx + 1}`;
    const checked = document.querySelector(`input[name="score_${code}"]:checked`);
    if (checked) answers[code] = Number(checked.value);
  }));
  return answers;
}
function calculateAll() {
  const scores = computeUceemScores(collectAnswers());
  const sec = scores.sections || {};
  const pTotal = uceemPct(scores.total, 125);
  const pA1 = uceemPct(sec.A1?.total || 0, 55);
  const pA2 = uceemPct(sec.A2?.total || 0, 30);
  const pB1 = uceemPct(sec.B1?.total || 0, 30);
  const pB2 = uceemPct(sec.B2?.total || 0, 10);
  scoreNodes.total.textContent = String(scores.total);
  scoreNodes.a1.textContent = String(sec.A1?.total || 0);
  scoreNodes.a2.textContent = String(sec.A2?.total || 0);
  scoreNodes.b1.textContent = String(sec.B1?.total || 0);
  scoreNodes.b2.textContent = String(sec.B2?.total || 0);
  scoreNodes.totalPct.textContent = pTotal + '%';
  scoreNodes.a1Pct.textContent = pA1 + '%';
  scoreNodes.a2Pct.textContent = pA2 + '%';
  scoreNodes.b1Pct.textContent = pB1 + '%';
  scoreNodes.b2Pct.textContent = pB2 + '%';
  scoreNodes.answered.textContent = String(scores.answered);
  scoreNodes.missing.textContent = scores.answered === UCEEM_TOTAL_ITEMS ? 'ყველა პუნქტი შევსებულია' : `დარჩენილია ${UCEEM_TOTAL_ITEMS - scores.answered} პუნქტი`;
  const band = uceemBand(pTotal);
  scoreNodes.interp.innerHTML = `<strong>${band[0]}</strong><br>${band[1]}`;
  scoreNodes.sub.innerHTML = `
    <div class="note"><strong>A1:</strong> ${uceemSubComment('A1', pA1)}</div>
    <div class="note" style="margin-top:10px"><strong>A2:</strong> ${uceemSubComment('A2', pA2)}</div>
    <div class="note" style="margin-top:10px"><strong>B1:</strong> ${uceemSubComment('B1', pB1)}</div>
    <div class="note" style="margin-top:10px"><strong>B2:</strong> ${uceemSubComment('B2', pB2)}</div>`;
  return scores;
}
async function submit() {
  if (!selectors.department.value || !selectors.curation.value || !selectors.semester.value || !selectors.group.value) {
    toast('აირჩიეთ დეპარტამენტი, კურაცია, სემესტრი და ჯგუფი.', 'error'); return;
  }
  const contextStudents = selectedStudents();
  if (!contextStudents.length) { toast('არჩეული კონტექსტისთვის სტუდენტები ვერ მოიძებნა.', 'error'); return; }
  const answers = collectAnswers();
  const scores = calculateAll();
  if (scores.answered < UCEEM_TOTAL_ITEMS) {
    const ok = confirm(`შეავსეთ ${scores.answered}/${UCEEM_TOTAL_ITEMS} პუნქტი. გსურთ გაგზავნა მაინც?`);
    if (!ok) return;
  }
  if (scores.answered === 0) { toast('მინიმუმ ერთი პასუხი აუცილებელია.', 'error'); return; }
  await createUceemResponse({
    campaignId: ['uceem-context', selectors.department.value, selectors.curation.value, selectors.semester.value, selectors.group.value].join('|'),
    targetUserId: null,
    targetRole: null,
    targetName: null,
    departmentId: selectors.department.value,
    academicYear: contextStudents[0].academicYear || null,
    semester: selectors.semester.value,
    group: selectors.group.value,
    answers,
    calculatedScores: scores,
  });
  clear(root());
  root().appendChild(h('div', { class: 'card' }, [h('div', { class: 'p24' }, [
    h('h2', { text: 'მადლობა!' }),
    h('div', { class: 'note', text: 'თქვენი ანონიმური UCEEM შეფასება გაიგზავნა.' }),
  ])]));
}
