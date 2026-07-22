// Public, unauthenticated anonymous UCEEM form.
import { getCampaign, createUceemResponse } from './api.js';
import { h, toast, guardButton, clear } from './ui.js';
import {
  UCEEM_SECTIONS, UCEEM_FIXED_SCALE_LABELS, UCEEM_TOTAL_ITEMS, roleLabel,
  computeUceemScores,
} from './engines.js';

const root = () => document.getElementById('uceem-root');
const params = new URLSearchParams(location.search);
const campaignId = params.get('c');
const done = new Set(); // targetUserId already submitted this session

boot();

async function boot() {
  if (!campaignId) { fail('ბმული არასწორია (კამპანია არ არის მითითებული).'); return; }
  let campaign = null;
  try { campaign = await getCampaign(campaignId); }
  catch (e) { console.error(e); fail('კამპანიის ჩატვირთვა ვერ მოხერხდა.'); return; }
  if (!campaign) { fail('კამპანია ვერ მოიძებნა.'); return; }
  if (campaign.active === false) { fail('ეს კამპანია დახურულია.'); return; }
  renderTargets(campaign);
}

function fail(msg) {
  const r = root(); clear(r);
  r.appendChild(h('div', { class: 'empty-note', text: msg }));
}

function renderTargets(campaign) {
  const r = root(); clear(r);
  const ctx = [campaign.academicYear, campaign.semester && (campaign.semester + ' სემესტრი'), campaign.group && ('ჯგუფი ' + campaign.group)]
    .filter(Boolean).join(' · ');
  r.appendChild(h('div', { class: 'muted', style: 'margin-bottom:12px', text: ctx || '' }));
  r.appendChild(h('h3', { text: 'აირჩიეთ თანამშრომელი შესაფასებლად' }));

  const targets = campaign.targets || [];
  if (!targets.length) { r.appendChild(h('div', { class: 'empty-note', text: 'კამპანიაში შესაფასებელი თანამშრომელი არ არის.' })); return; }

  const listHost = h('div', { style: 'margin-top:10px' });
  targets.forEach((t) => {
    const btn = h('button', {
      class: done.has(t.userId) ? 'ghost' : '',
      text: done.has(t.userId) ? 'შეფასებულია ✓' : 'შეფასება',
      disabled: done.has(t.userId) ? 'true' : null,
      onClick: () => renderForm(campaign, t),
    });
    listHost.appendChild(h('div', { class: 'target-card' }, [
      h('div', {}, [h('strong', { text: t.name || '—' }), h('div', { class: 'muted', text: roleLabel(t.role) })]),
      btn,
    ]));
  });
  r.appendChild(listHost);
}

function renderForm(campaign, target) {
  const r = root(); clear(r);
  r.appendChild(h('div', { class: 'row', style: 'margin-bottom:10px' }, [
    h('button', { class: 'ghost sm', text: '← უკან', onClick: () => renderTargets(campaign) }),
  ]));
  r.appendChild(h('div', { class: 'card', style: 'margin:0 0 14px' }, [h('div', { class: 'body' }, [
    h('h2', { text: `შესაფასებელი: ${target.name || '—'}` }),
    h('div', { class: 'muted', text: `როლი: ${roleLabel(target.role)}` }),
  ])]));

  const inputs = {}; // code -> radios name
  const sectionsHost = h('div', {});
  UCEEM_SECTIONS.forEach((sec) => {
    const items = sec.items.map((txt, idx) => {
      const code = `${sec.id}.${idx + 1}`;
      const scale = h('div', { class: 'uceem-scale' }, [1, 2, 3, 4, 5].map((val) => {
        const radio = h('input', { type: 'radio', name: `s_${code}`, value: String(val) });
        return h('label', { class: 'uceem-choice' }, [radio, h('strong', { text: String(val) }), h('span', { text: UCEEM_FIXED_SCALE_LABELS[val - 1] })]);
      }));
      inputs[code] = true;
      return h('div', { class: 'uceem-item' }, [
        h('span', { class: 'uceem-code', text: code }),
        h('div', { text: txt }),
        scale,
      ]);
    });
    sectionsHost.appendChild(h('div', { class: 'card', style: 'margin:0 0 14px' }, [
      h('div', { class: 'section-title' }, [h('div', {}, [h('h3', { text: sec.title }), h('small', { class: 'muted', text: `მაქსიმუმი: ${sec.max} ქულა` })])]),
      h('div', { class: 'body' }, [h('div', { class: 'muted', style: 'margin-bottom:6px', text: sec.desc }), ...items]),
    ]));
  });
  r.appendChild(sectionsHost);

  const submitBtn = h('button', { text: 'გაგზავნა' });
  r.appendChild(h('div', { class: 'row' }, [submitBtn]));

  submitBtn.addEventListener('click', guardButton(submitBtn, async () => {
    const answers = {};
    let answered = 0;
    Object.keys(inputs).forEach((code) => {
      const checked = document.querySelector(`input[name="s_${code}"]:checked`);
      if (checked) { answers[code] = Number(checked.value); answered++; }
    });
    if (answered < UCEEM_TOTAL_ITEMS) {
      const ok = confirm(`შეავსეთ ${answered}/${UCEEM_TOTAL_ITEMS} პუნქტი. გსურთ გაგზავნა მაინც?`);
      if (!ok) return;
    }
    if (answered === 0) { toast('მინიმუმ ერთი პასუხი აუცილებელია.', 'error'); return; }
    try {
      // Scores computed client-side; payload carries NO respondent identity.
      const calculatedScores = computeUceemScores(answers);
      await createUceemResponse({
        campaignId,
        targetUserId: target.userId,
        targetRole: target.role || null,
        targetName: target.name || null,
        departmentId: campaign.departmentId || null,
        academicYear: campaign.academicYear || null,
        semester: campaign.semester || null,
        group: campaign.group || null,
        answers,
        calculatedScores,
      });
      done.add(target.userId);
      toast('მადლობა! თქვენი ანონიმური შეფასება გაიგზავნა.', 'success');
      renderTargets(campaign);
    } catch (e) {
      console.error(e);
      toast(e.message || 'გაგზავნა ვერ მოხერხდა.', 'error');
    }
  }));
}
