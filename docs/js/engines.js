// =========================================================================
// engines.js — preserved calculation logic from the original HTML tools.
// The formulas, domains, scales, thresholds, radar geometry and resume
// descriptors are copied verbatim from the source files and MUST NOT change.
// =========================================================================

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function formatNum(val) {
  return Number(val || 0).toFixed(2);
}

// -------------------------------------------------------------------------
// Evaluation forms (Mini-CEX / CBD / DOPS / MSF) — 7 domains, scale 1-8.
// average = sum(answered) / completed  (verbatim from templates)
// -------------------------------------------------------------------------
export const FORMS = {
  mini_cex: {
    type: 'mini_cex',
    label: 'Mini-CEX',
    title: 'Mini-Clinical Evaluation Exercise (Mini-CEX) ინსტრუმენტი',
    subtitle: 'სტუდენტის მიერ პაციენტის ფოკუსირებული გასინჯვის პროცესზე დაკვირვების ფორმა',
    caseLabel: 'სიმპტომი/სინდრომი',
    domains: [
      { key: 'history_taking', label: 'ანამნეზის შეკრება', hint: 'პაციენტის მიზანმიმართული, აკურატული და ჰიპოთეზაზე დაფუძნებული გამოკითხვა' },
      { key: 'physical_examination', label: 'ფიზიკური გასინჯვა', hint: 'მიზნობრივი სისტემური გასინჯვა' },
      { key: 'clinical_judgment', label: 'კლინიკური მსჯელობა', hint: 'ინტერპრეტაცია, პრიორიტიზება და ადეკვატური დასკვნა' },
      { key: 'communication', label: 'კომუნიკაცია', hint: 'მკაფიო ურთიერთობა, ემპათია, პაციენტზე ორიენტირებული ინტერაქცია' },
      { key: 'professionalism', label: 'პროფესიონალიზმი', hint: 'პატივისცემა, ეთიკურობა, ნდობა, სიმშვიდე/თავშეკავებულობა' },
      { key: 'organization_efficiency', label: 'ორგანიზებულობა/ეფექტიანობა', hint: 'პროცესის უწყვეტობა, პრიორიტეტების განსაზღვრა, დროის გონივრული გამოყენება' },
      { key: 'overall_competence', label: 'ზოგადი კომპეტენცია', hint: 'ამ კონკრეტული შემთხვევის ზოგადი შეფასება' },
    ],
    textFields: [
      { key: 'strengths', label: 'რა შესრულდა კარგად', area: true },
      { key: 'improve', label: 'რა უნდა გაუმჯობესდეს', area: true },
      { key: 'plan', label: 'შემდგომი ნაბიჯები', area: true },
      { key: 'followup', label: 'რეკომენდებული ზედამხედველობის დონე / შემდგომი შეფასება', area: false },
    ],
    judgment: (avg, completed) => {
      if (completed === 0) return 'შეფასებები არ არის';
      if (avg >= 7) return 'მძლავრი უნარები';
      if (avg >= 5) return 'მისაღები / საჭიროებს გარეგან მხარდაჭერას';
      return 'საჭიროებს მნიშვნელოვან გარეგან მხარდაჭერას';
    },
  },
  cbd: {
    type: 'cbd',
    label: 'CBD',
    title: 'Case-Based Discussion (CBD) ფორმა',
    subtitle: 'შემთხვევაზე დაფუძნებული განხილვის ფორმა',
    caseLabel: 'შემთხვევა',
    domains: [
      { key: 'data_gathering_and_synthesis', label: 'მონაცემების შეგროვება და სინთეზი', hint: 'ძირითადი ფაქტების გამოყოფა და პრობლემის სწორად ჩამოყალიბება' },
      { key: 'differential_diagnosis', label: 'დიფერენციული დიაგნოზი', hint: 'შესაძლო დიაგნოზების ჩამოყალიბება და პრიორიტეტიზაცია' },
      { key: 'investigation_strategy', label: 'კვლევის სტრატეგია', hint: 'ადეკვატური ტესტების და მათი თანმიმდევრობის განსაზღვრა' },
      { key: 'management_plan', label: 'მართვის გეგმა', hint: 'მტკიცებულებაზე დაფუძნებული, უსაფრთხო და განხორციელებადი გეგმის ჩამოყალიბება' },
      { key: 'risk_assessment_and_escalation', label: 'რისკების შეფასება და ესკალაცია', hint: 'არასტაბილური მდგომარეობის ამოცნობის და დახმარების საჭიროების განსაზღვრის უნარი' },
      { key: 'documentation_and_follow_through', label: 'დოკუმენტირება და კონფიდენციალობა', hint: 'მკაფიო, ზუსტი ჩანაწერები და ინფორმაციის კონფიდენციალობის უზრუნველყოფა' },
      { key: 'overall_case_reasoning', label: 'კლინიკური აზროვნების ზოგადი შეფასება', hint: 'კონკრეტული შემთხვევის კოგნიტიური ანალიზის ზოგადი შეფასება' },
    ],
    textFields: [
      { key: 'strengths', label: 'რა შესრულდა კარგად', area: true },
      { key: 'improve', label: 'რა უნდა გაუმჯობესდეს', area: true },
      { key: 'plan', label: 'შემდგომი ნაბიჯები', area: true },
      { key: 'followup', label: 'რეკომენდებული ზედამხედველობის დონე / შემდგომი შეფასება', area: false },
    ],
    judgment: (avg, completed) => {
      if (completed === 0) return 'შეფასებები არ არის';
      if (avg >= 7) return 'კლინიკური აზროვნების მძლავრი უნარი';
      if (avg >= 5) return 'მისაღები / საჭიროებს გარეგან მხარდაჭერას';
      return 'საჭიროებს მნიშვნელოვან გარეგან მხარდაჭერას';
    },
  },
  dops: {
    type: 'dops',
    label: 'DOPS',
    title: 'Direct Observation of Procedural Skills (DOPS) ფორმა',
    subtitle: 'პროცედურული უნარების პირდაპირი დაკვირვების ფორმა',
    caseLabel: 'შემთხვევა / პროცედურა',
    domains: [
      { key: 'preparation_and_consent', label: 'მომზადება და ინფორმირებული თანხმობა', hint: 'პროცედურის ჩვენება/უკუჩვენებები, პაციენტის ინსტრუქტაჟი და თანხმობა, ინფექციის კონტროლი' },
      { key: 'equipment_setup', label: 'აპარატურის მომზადება', hint: 'აღჭურვილობის ადეკვატური მზადება გამოყენებისთვის' },
      { key: 'technical_execution', label: 'ტექნიკური შესრულება', hint: 'უსაფრთხო და ეფექტური საფეხურეობრივი ტექნიკა' },
      { key: 'asepsis_safety', label: 'უსაფრთხოება', hint: 'უსაფრთხოების უზრუნველყოფა, მონიტორინგი, სიტუაციური სიფხიზლე' },
      { key: 'communication_during_procedure', label: 'კომუნიკაცია პროცედურის დროს', hint: 'ეტაპების შესრულების ადეკვატური განმარტება და სათანადო პასუხები/რეაგირება' },
      { key: 'post_procedure_care', label: 'პოსტპროცედურული ეტაპი', hint: 'დოკუმენტაცია, მონიტორინგი, შემდგომი მოვლის გეგმა' },
      { key: 'overall_procedural_competence', label: 'კომპეტენტურობა', hint: 'პროცედურის შესრულების უნარი' },
    ],
    textFields: [
      { key: 'strengths', label: 'რა შესრულდა კარგად', area: true },
      { key: 'improve', label: 'რა უნდა გაუმჯობესდეს', area: true },
      { key: 'plan', label: 'შემდგომი ნაბიჯები', area: true },
      { key: 'followup', label: 'რეკომენდებული ზედამხედველობის დონე / შემდგომი შეფასება', area: false },
    ],
    judgment: (avg, completed) => {
      if (completed === 0) return 'შეფასებები არ არის';
      if (avg >= 7) return 'მაღალი კომპეტენცია';
      if (avg >= 5) return 'მისაღები / საჭიროებს გარეგან მხარდაჭერას';
      return 'საჭიროებს მნიშვნელოვან გარეგან მხარდაჭერას';
    },
  },
  msf: {
    type: 'msf',
    label: 'MSF',
    title: 'Multi-Source Feedback (MSF) ანუ 360° უკუკავშირის ფორმა',
    subtitle: 'სხვადასხვა წყაროდან მიღებული უკუკავშირის ორიგინალური ფორმა',
    caseLabel: null,
    domains: [
      { key: 'professionalism', label: 'პროფესიონალიზმი', hint: 'პროფესიული ქცევის სტანდარტების (პატივისცემა, სანდოობა, ეთიკა, კონფიდენციალობა) დაცვა' },
      { key: 'communication_with_patients', label: 'პაციენტებთან კომუნიკაცია', hint: 'ეფექტური კომუნიკაცია პაციენტთან (სიცხადე, ემპათია, მოსმენა)' },
      { key: 'communication_with_team', label: 'კომუნიკაცია გუნდთან', hint: 'ინფორმაციის გაზიარება, ადეკვატური რეაგირება, თანამშრომლობა' },
      { key: 'teamwork', label: 'გუნდური მუშაობა', hint: 'ეფექტური ინტერდისციპლინური მუშაობა' },
      { key: 'organization', label: 'ორგანიზებულობა', hint: 'სანდოობა, დროის ეფექტური გამოყენება, დავალებების/ამოცანების შესრულება' },
      { key: 'clinical_responsibility', label: 'კლინიკური პასუხისმგებლობა', hint: 'საკუთარი შესაძლებლობების/უფლებამოსილებების საზღვრების ცოდნა და ესკალაციის ადეკვატური უნარი' },
      { key: 'leadership_where_appropriate', label: 'ლიდერობა საჭიროების შემთხვევაში', hint: 'პაციენტის მართვის კოორდინაცია კომპეტენციის/უფლებამოსილებების საკუთარი დონის შესაბამისად' },
    ],
    textFields: [
      { key: 'strengths', label: 'ძლიერი მხარეები', area: true },
      { key: 'priorities', label: 'განვითარების პრიორიტეტები', area: true },
    ],
    judgment: (avg, completed) => {
      if (completed === 0) return 'შეფასებები არ არის';
      if (avg >= 7) return 'მაღალი პროფესიონალიზმი';
      if (avg >= 5) return 'მისაღები დონის პროფესიონალიზმი';
      return 'საჭიროებს პროფესიული უნარების განვითარებას';
    },
  },
};

// Compute scores for one evaluation exactly like the source templates.
export function computeEvalScores(type, answers) {
  const form = FORMS[type];
  let total = 0, completed = 0;
  form.domains.forEach((d) => {
    const raw = answers[d.key];
    const v = raw === '' || raw === undefined || raw === null ? null : Number(raw);
    if (v !== null && !Number.isNaN(v)) { total += v; completed += 1; }
  });
  const average = completed ? Number((total / completed).toFixed(2)) : 0;
  const judgment = form.judgment(average, completed);
  return { total, completed, average, judgment };
}

// -------------------------------------------------------------------------
// WBA Summary engine — from WBA.html (verbatim rules)
//   nonZeroAverage: mean of values > 0 (zeros excluded)
//   overall: mean of non-zero {miniAvg, cbdAvg, dopsAvg}
// Each evaluation contributes its own average as one data point for its type.
// -------------------------------------------------------------------------
export function nonZeroAverage(values) {
  const filtered = values.filter((v) => Number(v) > 0);
  if (filtered.length === 0) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

export function wbaBuildEntries(evaluations) {
  // Preserve the WBA "entry per case" concept: one entry per source
  // evaluation, its average placed in the matching column.
  return evaluations
    .filter((e) => ['mini_cex', 'cbd', 'dops'].includes(e.type))
    .map((e) => ({
      caseName: (e.summary && e.summary.caseName) || FORMS[e.type].label,
      mini: e.type === 'mini_cex' ? Number(e.scores.average) : 0,
      cbd: e.type === 'cbd' ? Number(e.scores.average) : 0,
      dops: e.type === 'dops' ? Number(e.scores.average) : 0,
      type: e.type,
    }));
}

export function wbaGetAverages(entries) {
  if (entries.length === 0) return { mini: 0, cbd: 0, dops: 0, overall: 0 };
  const avg = {
    mini: nonZeroAverage(entries.map((r) => r.mini)),
    cbd: nonZeroAverage(entries.map((r) => r.cbd)),
    dops: nonZeroAverage(entries.map((r) => r.dops)),
  };
  const parts = [avg.mini, avg.cbd, avg.dops].filter((v) => v > 0);
  avg.overall = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  return avg;
}

export function drawWbaRadar(canvas, avg) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const data = [
    { title: 'Mini-CEX', value: avg.mini },
    { title: 'CBD', value: avg.cbd },
    { title: 'DOPS', value: avg.dops },
  ];
  const cx = canvas.width / 2, cy = canvas.height / 2 + 30;
  const radius = 220, levels = 8, maxValue = 8;

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 28px Calibri'; ctx.textAlign = 'center';
  ctx.fillText('WBA რადარული დიაგრამა', cx, 42);
  ctx.font = '16px Calibri'; ctx.fillStyle = '#475569';
  ctx.fillText('საშუალო ქულები: Mini-CEX, CBD, DOPS', cx, 68);

  for (let level = 1; level <= levels; level++) {
    const r = radius * (level / levels);
    ctx.beginPath();
    data.forEach((_, i) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * i / data.length);
      const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.strokeStyle = '#dbe3ef'; ctx.lineWidth = 1; ctx.stroke();
    const tickValue = (maxValue / levels) * level;
    ctx.fillStyle = '#64748b'; ctx.font = '13px Calibri'; ctx.textAlign = 'left';
    ctx.fillText(tickValue.toFixed(0), cx + 8, cy - r + 4);
  }
  data.forEach((axis, i) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / data.length);
    const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.2; ctx.stroke();
    const lx = cx + Math.cos(angle) * (radius + 58), ly = cy + Math.sin(angle) * (radius + 58);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 16px Calibri'; ctx.textAlign = 'center';
    ctx.fillText(axis.title, lx, ly);
    ctx.fillStyle = '#475569'; ctx.font = '14px Calibri';
    ctx.fillText(formatNum(axis.value), lx, ly + 20);
  });
  ctx.beginPath();
  data.forEach((axis, i) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / data.length);
    const vr = radius * (axis.value / maxValue);
    const x = cx + Math.cos(angle) * vr, y = cy + Math.sin(angle) * vr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(29,78,216,0.22)'; ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 3;
  ctx.fill(); ctx.stroke();
  data.forEach((axis, i) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / data.length);
    const vr = radius * (axis.value / maxValue);
    const x = cx + Math.cos(angle) * vr, y = cy + Math.sin(angle) * vr;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = '#0f766e'; ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 14px Calibri'; ctx.textAlign = 'center';
    ctx.fillText(formatNum(axis.value), x, y - 12);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#0f172a'; ctx.font = 'bold 16px Calibri';
  ctx.fillText('აღნიშვნები:', 40, canvas.height - 90);
  ctx.font = '15px Calibri'; ctx.fillStyle = '#334155';
  ctx.fillText('• Mini-CEX — Mini-Clinical Evaluation Exercise', 40, canvas.height - 62);
  ctx.fillText('• CBD — Case-Based Discussion', 40, canvas.height - 38);
  ctx.fillText('• DOPS — Direct Observation of Procedural Skills', 40, canvas.height - 14);
}

// -------------------------------------------------------------------------
// MSF Resume engine — from "MSF Resume.html" (verbatim)
//   7 domains, average = sum / count, descriptor thresholds <5 / <7 / else
// -------------------------------------------------------------------------
export const MSF_DOMAINS = [
  { key: 'professionalism', label: 'პროფესიონალიზმი' },
  { key: 'patientCommunication', label: 'პაციენტებთან კომუნიკაცია' },
  { key: 'teamCommunication', label: 'კომუნიკაცია გუნდთან' },
  { key: 'teamwork', label: 'მულტიდისციპლინური გუნდური მუშაობა' },
  { key: 'organization', label: 'ორგანიზებულობა' },
  { key: 'clinicalResponsibility', label: 'კლინიკური პასუხისმგებლობა' },
  { key: 'leadership', label: 'ლიდერული უნარები' },
];

// Map an MSF evaluation (template keys) to the resume domain keys.
export function msfEntryFromEvaluation(e) {
  const a = e.answers || {};
  const evaluatorName = `${e.evaluatorFirstName || ''} ${e.evaluatorLastName || ''}`.trim();
  const evaluatorRole = e.evaluatorRole || '';
  return {
    id: e.id,
    evaluator: evaluatorName ? `${evaluatorName}${evaluatorRole ? ` (${evaluatorRole})` : ''}` : (evaluatorRole || '—'),
    professionalism: Number(a.professionalism || 0),
    patientCommunication: Number(a.patientCommunication || a.communication_with_patients || 0),
    teamCommunication: Number(a.teamCommunication || a.communication_with_team || 0),
    teamwork: Number(a.teamwork || 0),
    organization: Number(a.organization || 0),
    clinicalResponsibility: Number(a.clinicalResponsibility || a.clinical_responsibility || 0),
    leadership: Number(a.leadership || a.leadership_where_appropriate || 0),
  };
}

export function msfCalculateAverages(entries) {
  const averages = {};
  if (!entries.length) { MSF_DOMAINS.forEach((d) => (averages[d.key] = 0)); return averages; }
  MSF_DOMAINS.forEach((domain) => {
    const sum = entries.reduce((acc, item) => acc + Number(item[domain.key] || 0), 0);
    averages[domain.key] = sum / entries.length;
  });
  return averages;
}

export function msfFormatNumber(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const rounded = Number(value).toFixed(2);
  return rounded.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function getDescriptorText(key, avg) {
  if (key === 'professionalism') {
    if (avg < 5) return 'პროფესიული ქცევის სტანდარტების (პატივისცემა, სანდოობა, ეთიკა, კონფიდენციალობა) დაცვის მნიშვნელოვანი ხარვეზები. მუდმივად საჭიროებს მნიშვნელოვან გარეგან დახმარებას და მითითებებს.';
    if (avg < 7) return 'ძირითდად იცავს პროფესიული ქცევის სტანდარტებს (პატივისცემა, სანდოობა, ეთიკა, კონფიდენციალობა). პერიოდულად საჭიროებს გარეგან დახმარებას და მითთებებს.';
    return 'იდეალურად იცავს პროფესიული ქცევის სტანდარტებს (პატივისცემა, სანდოობა, ეთიკა, კონფიდენციალობა). არ ან იშვიათად საჭიროებს გარეგან დახმარებას და მითთებებს.';
  }
  if (key === 'patientCommunication') {
    if (avg < 5) return 'პაციენტთან კომუნიკაცია არაეფექტურია. ურთიერთობებს არ ახასიათებს სიცხადე, ემპათია; უჭირს პაციენტის მოსმენა.';
    if (avg < 7) return 'პაციენტთან კომუნიკაცია უმეტესწილად ეფექტურია. პერიოდულად საჭიროებს გარედან აქცენტირებას/მითითებებს კომუნიკაციის სიცხადის, ემპათიის და პაციენტის მოსმენის თაობაზე.';
    return 'გამოირჩევა პაციენტთან კომუნიკაციის ადეკვატური უნარით. ურთიერთობების ფორმები მკაფიო და ცხადი; არის ემპათიური და გულისყურით უსმენს პაციენტს.';
  }
  if (key === 'teamCommunication') {
    if (avg < 5) return 'აქვს სამედიცინო გუნდის შიგნით ინფორმაციის გაზიარების პრობლემა, ურთიერთობებში არაადეკვატურია და უჭირს თანამშრომლობა.';
    if (avg < 7) return 'პერიოდულად აქვს სამედიცინო გუნდის შიგნით ინფორმაციის გაზიარების უმნიშვნელო პრობლემები. ძირითადად შეუძლია ადეკვატური თანამშრომლობა.';
    return 'გამოირჩევა სამედიცინო გუნდის წევრებთან სრულყოფილი კომუნიკაციის უნარებით, ინფორმაციის გაზიარების, ადეკვატური რეაგირების და თანამშრომლობის თვალსაზრისით.';
  }
  if (key === 'teamwork') {
    if (avg < 5) return 'აქვს მულტიდისციპლინური გუნდური მუშაობის მნიშვნელოვანი პრობლემები.';
    if (avg < 7) return 'გააჩნია მულტიდისციპლინური გუნდური მუშაობის ძირითადი უნარები, თუმცა პერიოდულად საჭიროებს გარეგან დახმარებას და მითითებებს.';
    return 'გამოირჩევა მულტიდისციპლინური გუნდური მუშაობის ადეკვატური უნარებით, დახმარების/მითითებების საჭიროების გარეშე ან უმნიშვნელო დახმარებით.';
  }
  if (key === 'organization') {
    if (avg < 5) return 'არაორგანიზებულია. არ შეუძლია დროის ეფექტური გამოყენება; დავალებების/ამოცანების, ძირითადად, ვერ ასრულებს ან ასრულებს მნიშვნელოვანი გარეგანი დახმარებით/მითითებით.';
    if (avg < 7) return 'აქვს ორგანიზებულობის გარკვეულიი ხარვეზები. საჭიროებს გარკვეულ გარეგან დახმარებას/მითითებებს დროის ეფექტური გამოყენების და დავალებების/ამოცანების შესრულების თვალსაზრისით.';
    return 'გამოირჩევა საუკეთესო ორგანიზებულობით და სანდოობით, ეფექტურად იყენებს დროს. დროულად და იდეალურად ასრულებს დავალებებს და ამოცანებს.';
  }
  if (key === 'clinicalResponsibility') {
    if (avg < 5) return 'ვერ საზღვრავს საკუთარ შესაძლებლობებს, ნაკლები წარმოდგენა აქვს საკუთარი უფლებამოსილებების/კომპეტენციების თაობაზე. ადეკვატურად ვერ რეაგირებს კლინიკური ესკალაციის საჭიროებებზე.';
    if (avg < 7) return 'ძირითადად იცის საკუთარი შესაძლებლობების, უფლებამოსილებების და კომპეტენციების ზღვარი. ძირითდად ადეკვატურად რეაგირებს კლინიკური ესკალაციის აუცილებლობაზე. საჭიროებს გარეგან დახმარებას და მითთებებს.';
    return 'გაცნობიერებული აქვს საკუთარი შესაძლებლობების, უფლებამოსილებების და კომპეტენციების ზღვარი. ყოველთვის ადეკვატურად რეაგირებს კლინიკური ესკალაციის საჭიროებებზე.';
  }
  if (key === 'leadership') {
    if (avg < 5) return 'არ ახდენს ლიდერული უნარების დემონსტრირებას. მნიშვნელოვან გარეგან დახმარებას და მითითებებს საჭიროებს პაციენტის მართვის კოორდინაციის თვალსაზრისით.';
    if (avg < 7) return 'აქვს ლიდერობის გარკვეული ხარვეზები. პერიოდულად საჭიროებს გარეგან დახმარებას და მითითებებს საკუთარი კომპეტენციის ფარგლებში პაციენტის მართვის კოორდინაციის თვალსაზრისით.';
    return 'აქვს ლიდერის გამხატული თვისებები. შეუძლია საკუთარი კომპეტენციის ფარგლებში კოორდინაცია გაუწიოს პაციენტის მართვის პრცესს, გარეგანი დახმარების გარეშე ან მინიმალური მითითებებით.';
  }
  return '';
}

export function drawMsfRadar(canvas, averages) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  const cx = width / 2, cy = height / 2 + 18;
  const radius = 250, maxValue = 8, levels = 8, count = MSF_DOMAINS.length;

  ctx.save(); ctx.translate(cx, cy);
  for (let level = 1; level <= levels; level++) {
    const r = radius * (level / levels);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * i / count);
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < count; i++) {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / count);
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.beginPath();
  MSF_DOMAINS.forEach((domain, i) => {
    const value = Math.max(0, Math.min(maxValue, averages[domain.key]));
    const r = radius * (value / maxValue);
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / count);
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(15,118,110,0.20)'; ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 3;
  ctx.fill(); ctx.stroke();
  MSF_DOMAINS.forEach((domain, i) => {
    const value = Math.max(0, Math.min(maxValue, averages[domain.key]));
    const r = radius * (value / maxValue);
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / count);
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = '#1d4ed8'; ctx.fill();
  });
  ctx.restore();
  // axis labels
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 14px Calibri'; ctx.textAlign = 'center';
  MSF_DOMAINS.forEach((domain, i) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * i / count);
    const lx = cx + Math.cos(angle) * (radius + 40), ly = cy + Math.sin(angle) * (radius + 40);
    ctx.fillText(`${msfFormatNumber(averages[domain.key])}`, lx, ly);
  });
}

// -------------------------------------------------------------------------
// UCEEM engine — from uceem_style_georgian_tool.html (verbatim)
// -------------------------------------------------------------------------
export const UCEEM_FIXED_SCALE_LABELS = [
  'არ ვეთანხმები', 'ნაწილობრივ ვეთანხმები', 'ნეიტრალური შეფასება მაქვს',
  'ძირითადად ვეთანხმები', 'სრულად ვეთანხმები',
];

export const UCEEM_SECTIONS = [
  {
    id: 'A1', title: 'A1 — სწავლის შესაძლებლობები და კურაციის ხარისხი', max: 55,
    desc: 'ეს ქვეკომპონენტი ასახავს რამდენად ეფექტურად იღებს სტუდენტი მონაწილეობას რეალურ კლინიკურ საქმიანობაში და რამდენად ხარისხიანია კურაციის პროცესი.',
    items: [
      'ჩემი დავალებები/ამოცანები შეესაბამებოდა სწავლის მიზნებს',
      'მე აქტიურად და ეფექტურად ვიყავი ჩართული კლინიკურ საქმიანობაში',
      'ჩემი დავალებები/ამოცანები ადეკვატურ გამოწვევას წარმოადგენდა ჩემი ცოდნის და პროფესიული უნარებისთვის',
      'მქონდა კლინიკურ პროცესებში აქტიური ჩართულობის საკმარისი ხელშეწყობა',
      'ყოველთვის მქონდა კონსტრუქციული უკუკავშირი კურატორის მხრიდან',
      'მე ყოველთვის მქონდა კურატორისთვის ნებისმიერი კითხვის დასმის საშუალება',
      'კურატორთან შეხვედრებზე თავისუფლად შემეძლო ჩემი ქმედებების დასაბუთება',
      'კურაციის პერიოდში საგრძნობლად გავიუმჯობესე პრობლემების გადაჭრის უნარები',
      'კურაციის პერიოდში წარმატებით მოვახერხე ჩემი ცოდნის პრაქტიკული რეალიზაცია',
      'კურაციის პერიოდში მეძლეოდა სხვა სტუდენტებთან ერთობლივ/კოლეგიალურ სწავლებაში ჩართულობის შესანიშნავი საშუალება',
      'კურაციის პერიოდში მქონდა საკუთარი სწავლების პროცესის მართვაში ჩართულობის შეგრძნება',
    ],
  },
  {
    id: 'A2', title: 'A2 — სტუდენტის მიღებისთვის მზადყოფნა', max: 30,
    desc: 'ეს ქვეკომპონენტი აფასებს სტუდენტთა ინიციალურ ინფორმირებულობას და იმ გაცნობით ღონისძიებებს, რომლებიც სტუდენტს უადვილებს კლინიკურ სივრცეში ადაპტაციას.',
    items: [
      'კურაციის დაწყებისთანავე მივიღე სასარგებლო გაცნობითი მითითებები და ინსტრუქციები',
      'კურაციის დაწყებისთანავე კურატორი დამხვდა სრულ მზადყოფნაში',
      'მე ყოველთვის შემეძლო დახმარების მიზნით მიმემართა ჩემი კურატორისთვის',
      'მე სათანადო წვდომა მქონდა კურაციის პროცესზე',
      'კურატორი კარგად იყო მომზადებული სასწავლო პროცესის მართვისთვის',
      'კურატორი ზედმიწევნით კარგად იცნობდა სასწავლო მიზნებს',
    ],
  },
  {
    id: 'B1', title: 'B1 — ურთიერთობები სამუშაო გარემოში და სტუდენტთა ჩართულობა', max: 30,
    desc: 'ეს ქვეკომპონენტი ასახავს დეპარტამენტის სამედიცინო გუნდში სტუდენტის ინტეგრაციის ხარისხს და შესაძლებლობებს.',
    items: [
      'მე ადეკვატური წვდომა მქონდა დეპარტამენტის ტექნოლოგიურ რესურსებთან',
      'კურაციის ფიზიკური სივრცე შეესაბამებოდა სტუდენტთა რაოდენობას',
      'დეპარტამენტის თანამშრომელთა დამოკიდებულება სტუდენტების მიმართ იყო პოზიტიური',
      'მე თავს ინტეგრირებულად ვგრძნობდი დეპარტამენტის თანამშრომელთა გუნდში',
      'მე თავს კომფორტულად ვგრძნობდი დეპარტამენტის თანამშრომლებთან საერთო სივრცეებში',
      'დეპარტამენტის თანამშრომლებთან ჩემი კომუნიკაცია დადებითად შეიძლება შეფასდეს',
    ],
  },
  {
    id: 'B2', title: 'B2 — თანასწორობა', max: 10,
    desc: 'ეს ქვეკომპონენტი ასახავს სტუდენტის მიმართ სამართლიან, პატივისცემზე დაფუძნებულ და არადისკრიმინაციულ დამოკიდებულებას.',
    items: [
      'დეპარტამენტში ურთიერთობები ემყარება თანასწორობას, კულტურული განსხვავებების მიუხედავად',
      'დეპარტამენტში ურთიერთობები ემყარება თანასწორობას, სქესის მიუხედავად',
    ],
  },
];
export const UCEEM_TOTAL_MAX = UCEEM_SECTIONS.reduce((s, sec) => s + sec.max, 0);
export const UCEEM_TOTAL_ITEMS = UCEEM_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);

export function uceemPct(score, max) { return max ? Math.round((score / max) * 1000) / 10 : 0; }

// Client-side UCEEM scoring (Spark: no Cloud Function). Mirrors the fixed
// structure; validates 1-5 and ignores unanswered items.
export function computeUceemScores(answers) {
  const sections = {}; let total = 0, answered = 0;
  UCEEM_SECTIONS.forEach((sec) => {
    let secTotal = 0, secAnswered = 0;
    sec.items.forEach((_, idx) => {
      const raw = answers[`${sec.id}.${idx + 1}`];
      if (raw === undefined || raw === null || raw === '') return;
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 1 || v > 5) return;
      secTotal += v; secAnswered += 1;
    });
    sections[sec.id] = { total: secTotal, answered: secAnswered, max: sec.max };
    total += secTotal; answered += secAnswered;
  });
  return { total, totalMax: UCEEM_TOTAL_MAX, answered, sections };
}

export function uceemBand(p) {
  if (p < 50) return ['მნიშვნელოვნად გასაუმჯობესებელი!', 'კლინიკურ სასწავლო გარემოში მრავლად ჩანს სტრუქტურული ან მხარდაჭერის დეფიციტი! სასურველია მიზნობრივი ცვლილებების დაგეგმვა!'];
  if (p < 65) return ['საშუალოზე დაბალი', 'არსებობს პოზიტიური ელემენტები, თუმცა გარემო არ არის სტაბილურად მხარდამჭერი ან თანმიმდევრული.'];
  if (p < 80) return ['დამაკმაყოფილებელი / კარგი', 'სასწავლო გარემო ძირითადად ფუნქციურია, მაგრამ კვლავ არსებობს გაუმჯობესების კონკრეტული მიმართულებები.'];
  if (p < 90) return ['ძალიან კარგი', 'გარემო აშკარად მხარდამჭერია და სასწავლო პროცესის უმეტეს კომპონენტებში ძლიერი მხარეები ჩანს.'];
  return ['შესანიშნავი', 'გარემო მეტად ხელსაყრელია კლინიკური სწავლისთვის! აუცილებელია პერიოდული მონიტორინგი და ზრუნვა ხარისხის უზრუნველყოფისთვის.'];
}

export function uceemSubComment(secId, p) {
  if (secId === 'A1') {
    if (p < 65) return 'A1 დაბალი ქულა მიუთითებს, რომ დეპარტამენტში არის რეალურ კლინიკურ საქმიანობაში სტუდენტის მონაწილეობის, ზედამხედველობის ან კონსტრუქციული უკუკავშირის დეფიციტი.';
    if (p < 80) return 'A1 საშუალო ქულა მიუთითებს სწავლების არსებულ პოტენციალზე, თუმცა კურაციის პროცესი ანდა სტუდენტთა აქტიური ჩართულობა არათანმიმდევრულია.';
    return 'A1 მაღალი ქულა მიუთითებს სტუდენტის აქტიურ ჩართულობაზე დაფუძნებულ საუკეთესო სასწავლო გარემოზე.';
  }
  if (secId === 'A2') {
    if (p < 65) return 'A2 დაბალი ქულა მიანიშნებს ორგანიზაციული მზადყოფნის პრობლემებზე.';
    if (p < 80) return 'A2 საშუალო ქულა აჩვენებს, "მასპინძლობის" საბაზისო პირობების არსებობაზე, თუმცა აუცილებელია სტუდენტთა უკეთესი ინდუქცია და ინფორმირებულობაზე ზრუნვა.';
    return 'A2 მაღალი ქულა მიუთითებს, რომ სტდენტთა ორიენტაციის პროცესი კარგად არის ორგანიზებული.';
  }
  if (secId === 'B1') {
    if (p < 65) return 'B1 დაბალი ქულა მიუთითებს სტუდენტის არასაკმარის გუნდურ ჩართულობაზე, შეზღუდულ უკუკავშირზე ანდა სუსტ კომუნიკაციურ კულტურაზე.';
    if (p < 80) return 'B1 საშუალო ქულა მიუთითებს სტუდენტის ნაწილობრივ ჩართულობაზე, თუმცა აუცილებელია მისი სოციალური ინტეგრაცია და ინტერაქციის გაძლიერება.';
    return 'B1 მაღალი ქულა მიუთითებს სტუდენტის აქტიურ ჩართულობაზე, კოლეგიალურ ინტერაქციასა და გუნდის წევრად აღიარებაზე.';
  }
  if (secId === 'B2') {
    if (p < 65) return 'B2 დაბალი ქულა განსაკუთრებულ ყურადღებას მოითხოვს, რადგან შეიძლება მიუთითებდეს არასამართლიან და დისკრიმინაციულ გარემოზე!';
    if (p < 80) return 'B2 საშუალო ქულა მიუთითებს, რომ გარემო, ზოგადად, სამართლიანია, თუმცა არათანმიმდევრული.';
    return 'B2 მაღალი ქულა მიუთითებს თანასწორი, პატივისცემაზე დაფუძნებული და უსაფრთხო სასწავლო გარემოს არსებობაზე.';
  }
  return '';
}

// -------------------------------------------------------------------------
// Roles (extensible). Technical value -> Georgian label.
// -------------------------------------------------------------------------
export const ROLES = [
  { value: 'department_head', label: 'დეპარტამენტის ხელმძღვანელი' },
  { value: 'curator', label: 'კურატორი' },
  { value: 'doctor', label: 'ექიმი' },
  { value: 'nurse', label: 'ექთანი' },
  { value: 'lecturer', label: 'ლექტორი' },
  { value: 'assessor', label: 'სხვა უფლებამოსილი შემფასებელი' },
  { value: 'admin', label: 'ადმინისტრატორი' },
];
export function roleLabel(v) {
  const r = ROLES.find((x) => x.value === v);
  return r ? r.label : (v || '—');
}
