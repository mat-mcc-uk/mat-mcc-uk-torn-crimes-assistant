const assert = require('assert');
const { RULES, Logic } = require('./crimes-assistant.user.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const bar = s => s.split('').map(c => ({ n: 'neutral', l: 'low', m: 'medium', h: 'high', t: 'temptation', s: 'sensitivity', c: 'concern', z: 'hesitation', f: 'fail' }[c]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);

t('age parsing', () => {
  assert.strictEqual(Logic.parseAgeHours('37 days, 1 hour'), 889);
  assert.strictEqual(Logic.parseAgeHours('18 days, 14 hours'), 446);
  assert.strictEqual(Logic.parseAgeHours('5 hours'), 5);
});

t('sale tiers', () => {
  assert.strictEqual(Logic.saleTier(50).current.low, 100);
  assert.strictEqual(Logic.saleTier(50).toNext, 51);
  assert.strictEqual(Logic.saleTier(1550).current.low, 160);
  assert.strictEqual(Logic.saleTier(1550).toNext, 8450);
  assert.strictEqual(Logic.saleTier(10000).next, null);
  assert.strictEqual(Logic.saleTier(0).current, null);
});

t('skimmer advice thresholds', () => {
  assert.strictEqual(Logic.skimmerAdvice(3).level, 'bad');
  assert.strictEqual(Logic.skimmerAdvice(7).level, 'ok');
  assert.strictEqual(Logic.skimmerAdvice(13).level, 'good');
  assert.ok(/Honour/.test(Logic.skimmerAdvice(656).text));
});

t('plain landing', () => {
  const c = bar('nnlmhf');
  assert.deepStrictEqual(Logic.resolveLanding(c, 3), { index: 3, type: 'medium', via: null });
  assert.strictEqual(Logic.resolveLanding(c, 5).type, 'fail');
});

t('temptation skips hazards to the next safe cell', () => {
  const c = bar('ntfcnh');
  const r = Logic.resolveLanding(c, 1);
  assert.strictEqual(r.index, 4);
  assert.strictEqual(r.type, 'neutral');
});

t('temptation with nowhere to go is a fail', () => {
  assert.strictEqual(Logic.resolveLanding(bar('ntff'), 1).type, 'fail');
});

t('sensitivity shifts left to neutral, skipping rewards', () => {
  const r = Logic.resolveLanding(bar('nlms'), 3);
  assert.strictEqual(r.index, 0);
  assert.strictEqual(r.type, 'sensitivity');
});

t('sensitivity with no neutral behind is a fail', () => {
  assert.strictEqual(Logic.resolveLanding(bar('lms'), 2).type, 'fail');
});

t('overshoot clamps to the last cell', () => {
  assert.strictEqual(Logic.resolveLanding(bar('nnh'), 9).type, 'high');
});

t('response probabilities are uniform and sum to 1', () => {
  const c = bar('nnfmhn');
  const p = Logic.evaluateResponse(c, 0, { min: 2, max: 5 });
  close(p.fail, 0.25); close(p.medium, 0.25); close(p.high, 0.25); close(p.neutral, 0.25);
  close(p.neutral + p.low + p.medium + p.high + p.concern + p.hesitation + p.sensitivity + p.fail, 1);
});

t('backward ranges work', () => {
  const p = Logic.evaluateResponse(bar('hnnn'), 3, { min: -3, max: -2 });
  close(p.high, 0.5); close(p.neutral, 0.5);
});

t('recommend prefers reward under the fail threshold', () => {
  const c = bar('nnnffhhhnn');
  const opts = [
    { name: 'Soft', range: { min: 1, max: 3 } },     // 1/3 fail
    { name: 'Strong', range: { min: 5, max: 7 } },   // all high
    { name: 'Back', range: { min: -1, max: -1 } },
  ];
  const r = Logic.recommend(c, 0 + 1, opts.map(o => o), 0.05);
  assert.strictEqual(r.safeChoiceExists, true);
  assert.notStrictEqual(r.pick.name, 'Soft');
});

t('recommend falls back to the lowest fail chance', () => {
  const c = bar('nffnff');
  const r = Logic.recommend(c, 0, [
    { name: 'A', range: { min: 1, max: 2 } },   // 100% fail
    { name: 'B', range: { min: 2, max: 3 } },   // 50% fail
  ], 0.05);
  assert.strictEqual(r.safeChoiceExists, false);
  assert.strictEqual(r.pick.name, 'B');
});

t('suspicion paints from the left and spares the pip', () => {
  const out = Logic.applySuspicion(bar('nnnnn'), 1, 3);
  assert.deepStrictEqual(out, bar('fnffn'));
  assert.strictEqual(Logic.applySuspicion(bar('n'.repeat(20)), 19, 50).filter(x => x === 'fail').length, RULES.scamming.suspicionCap);
});

t('abandon flags', () => {
  assert.strictEqual(Logic.shouldAbandon(bar('nnfff'), 0), 'No reward cells left');
  assert.strictEqual(Logic.shouldAbandon(bar('nnhnn'), 0), null);
  assert.strictEqual(Logic.shouldAbandon(bar('hncff'), 2), 'No safe path ahead');
});

t('payout', () => {
  assert.strictEqual(Logic.scamPayout('Investment', 'Affluent', 'high'), 6900000);
  assert.strictEqual(Logic.scamPayout('Delivery', 'Young Adult', 'low'), 560);
  assert.strictEqual(Logic.scamPayout('Nope', 'Senior', 'low'), null);
});

t('burglary confidence bands', () => {
  assert.strictEqual(Logic.burglarySuccess(10), 0.70);
  assert.strictEqual(Logic.burglarySuccess(35), 0.85);
  assert.strictEqual(Logic.burglarySuccess(50), 0.90);
  assert.strictEqual(Logic.burglarySuccess(100), 0.985);
});

t('rule data is complete', () => {
  assert.strictEqual(Object.keys(RULES.burglary.targets).length, 34);
  assert.strictEqual(Object.keys(RULES.scamming.basePayout).length, 11);
  assert.strictEqual(Object.keys(RULES.cardskimming.locations).length, 8);
});

t('burglary names and aliases', () => {
  assert.strictEqual(Logic.burglaryTarget('Funeral Parlor').name, 'Funeral Directors');
  assert.strictEqual(Logic.burglaryTarget('Liquor Store').casings, '2');
  assert.strictEqual(Logic.burglaryTarget('Moon Base'), null);
});

t('burglary advice', () => {
  const tg = Logic.burglaryTarget('Liquor Store');
  assert.strictEqual(Logic.burglaryAdvice(0, 'Unknown', tg).level, 'bad');
  assert.strictEqual(Logic.burglaryAdvice(35, 'Unknown', tg).level, 'ok');
  assert.strictEqual(Logic.burglaryAdvice(55, 'Unknown', tg).level, 'good');
  assert.strictEqual(Logic.burglaryAdvice(0, 'All clear', tg).level, 'good');
  assert.strictEqual(Logic.burglaryAdvice(90, 'Too dangerous', tg).level, 'bad');
});

t('arson location table', () => {
  assert.strictEqual(Object.keys(RULES.arson.locations).length, 118);
  assert.strictEqual(RULES.arson.locations['Tool Shed'], '35');
  assert.strictEqual(RULES.arson.locations['Data Center'], '51');
});

t('arson requirement parsing', () => {
  const r = Logic.arsonRequirements(['Cover-up', 'More than 75% damage required']);
  assert.strictEqual(r.min, 75); assert.strictEqual(r.total, false);
  assert.strictEqual(Logic.arsonRequirements(['Vendetta', 'Total destruction required']).total, true);
  assert.strictEqual(Logic.arsonRequirements(['Business', 'Accidental cause requested']).lowSuspicion, true);
  assert.strictEqual(Logic.arsonRequirements(['Vendetta', 'Planted evidence requested']).evidence, true);
});

t('arson job verdicts', () => {
  // Shack: rurality 4 (240s), flammability 5 (2%/s, 50s burn). Total destruction is comfortable.
  const shack = Logic.arsonJob('Shack', 1, ['Vendetta', 'Total destruction required']);
  assert.strictEqual(shack.level, 'good'); assert.strictEqual(shack.burn, 50); assert.strictEqual(shack.starters, 2);
  // Beach Hut: 120s response, 50s burn.
  assert.strictEqual(Logic.arsonJob('Beach Hut', 1, ['Intimidation', 'Total destruction required']).level, 'good');
  // Travel Agent: rurality 1 (30s), flammability 3 (1.2%/s): about 36% in time.
  const ta = Logic.arsonJob('Travel Agent', 2, ['Vendetta']);
  assert.strictEqual(ta.cap, 36); assert.strictEqual(ta.level, 'ok');
  // Bank total destruction: 30s response, 0.8%/s. Cannot finish without help.
  assert.strictEqual(Logic.arsonJob('Bank', 3, ['Business', 'Total destruction required']).level, 'bad');
  // Bazaar total destruction: 60s response, 63s burn. Falls short.
  assert.strictEqual(Logic.arsonJob('Bazaar', 1, ['X', 'Total destruction required']).level, 'bad');
  // Unknown location still gives starter advice.
  const barn = Logic.arsonJob('Barn', 3, []);
  assert.strictEqual(barn.known, false); assert.strictEqual(barn.starters, 4);
  assert.strictEqual(Logic.arsonJob('Aircraft Hangar', 5, []).starters, 5);
});

const live = (() => {   // the bar captured from a real Family scam target
  const c = new Array(50).fill('neutral');
  const fill = (type, start, size) => { for (let i = start; i < start + size; i++) c[i] = type; };
  fill('sensitivity', 8, 7); fill('low', 15, 3); fill('fail', 25, 6); fill('low', 31, 1); fill('medium', 32, 1);
  fill('high', 33, 7); fill('medium', 40, 1); fill('low', 41, 1); fill('sensitivity', 45, 4); fill('fail', 49, 1);
  return c;
})();

t('scam options follow the displacement table', () => {
  const o = Logic.scamOptions('Family', 0);
  assert.strictEqual(o.length, 18);
  assert.deepStrictEqual(o[0].range, { min: 10, max: 19 });
  assert.deepStrictEqual(o[2].range, { min: -2, max: -4 });
  assert.deepStrictEqual(Logic.scamOptions('Investment', 0)[0].range, { min: 5, max: 9 });
  assert.strictEqual(Logic.scamOptions('Family', 4).length, 6);
});

t('live bar: opening move avoids the sensitivity block', () => {
  const plan = Logic.scamPlan(live, 0, 'Family', 0);
  // Strong forward from cell 0 lands on sensitivity half the time. Soft forward is clean.
  const strong = plan.all.find(o => o.name === 'Strong forward' && o.accelerate === 0);
  close(strong.sensitivity, 0.5); close(strong.low, 0.3); close(strong.fail, 0);
  assert.strictEqual(plan.pick.fail <= 0.05, true);
  assert.strictEqual(plan.canCapitalise, null);
  assert.strictEqual(plan.abandon, null);
  console.log('    pick from 0:', plan.pick.accelerate ? 'Accelerate x' + plan.pick.accelerate + ' then' : '', plan.pick.name, 'value', plan.pick.value.toFixed(2));
});

t('live bar: never recommends a move into the fail block when a safe one exists', () => {
  for (let pos = 0; pos < 49; pos++) {
    if (live[pos] === 'fail' || live[pos] === 'sensitivity') continue;
    const plan = Logic.scamPlan(live, pos, 'Family', 0);
    if (plan.safeChoiceExists) assert.ok(plan.pick.fail <= 0.05, 'pos ' + pos);
  }
});

t('live bar: capitalise flag on reward cells', () => {
  assert.strictEqual(Logic.scamPlan(live, 35, 'Family', 0).canCapitalise, 'high');
  assert.strictEqual(Logic.scamPlan(live, 16, 'Family', 0).canCapitalise, 'low');
});

t('banked Accelerate stacks change the ranges, and lookahead resets them', () => {
  // With 1 stack banked on a tier-1 scam, Strong forward moves 15 to 29.
  const p1 = Logic.scamPlan(live, 16, 'Family', 1);
  const strong = p1.all.find(o => o.name === 'Strong forward' && o.accelerate === 0);
  assert.deepStrictEqual(strong.range, { min: 15, max: 29 });
  close(strong.fail, 0);                       // lands on 31 to 45
  assert.strictEqual(p1.all.length, 15);       // stacks 1 to 5, three responses each
  // From cell 0 with 1 stack, Strong forward reaches the fail block (25 to 29).
  const p0 = Logic.scamPlan(live, 0, 'Family', 1);
  const s0 = p0.all.find(o => o.name === 'Strong forward' && o.accelerate === 0);
  close(s0.fail, 5 / 15);
  assert.ok(p0.pick.fail <= 0.05);
  // At 5 stacks no further Accelerate is offered.
  assert.ok(Logic.scamPlan(live, 0, 'Family', 5).all.every(o => o.accelerate === 0));
});

t('arson badges read in plain words', () => {
  const j = n => Logic.arsonJob(...n);
  assert.ok(/^Easy/.test(j(['Tool Shed', 1, ['Cover-up']]).label));
  assert.ok(/^Partial .* 36%/.test(j(['Travel Agent', 2, ['Vendetta']]).label));
  assert.ok(/^Hard .*Thermite/.test(j(['Bank', 3, ['Business', 'Total destruction required']]).label));
  assert.ok(/look accidental/.test(j(['Arms Warehouse', 4, ['Business', 'Accidental cause requested']]).label));
  assert.ok(/plant evidence/.test(j(['Motorcycle Club', 3, ['Vendetta', 'Planted evidence requested']]).label));
  assert.ok(/^No data/.test(j(['Barn', 3, []]).label));
  // No jargon codes in what the player reads.
  for (const job of [j(['Tool Shed', 1, []]), j(['Bank', 3, ['X', 'Total destruction required']])]) {
    assert.ok(!/\bF\d|\bR\d/.test(job.label + job.detail.join(' ')));
    assert.ok(job.detail.length >= 3);
    assert.ok(job.detail.some(d => /^To start: Place/.test(d)));
  }
});

t('arson hover tips stay short enough for the game tooltip', () => {
  const reqSets = [[], ['X', 'Total destruction required'], ['X', 'More than 75% damage required'],
    ['X', 'Accidental cause requested', 'Planted evidence requested'], ['X', 'High visibility requested', 'Total destruction required']];
  let longest = 0;
  for (const name of Object.keys(RULES.arson.locations)) for (const reqs of reqSets) for (const areas of [1, 5]) {
    const tip = Logic.arsonJob(name, areas, reqs).tip;
    assert.ok(tip && tip.length <= 260, name + ': ' + (tip && tip.length));
    longest = Math.max(longest, tip.length);
  }
  console.log('    longest tip:', longest, 'characters');
});

console.log('\n' + n + ' tests passed');
