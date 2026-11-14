// ==UserScript==
// @name         Torn Crimes 2.0 Assistant
// @namespace    https://github.com/mat-mcc-uk
// @version      0.6.0
// @description  Advice-only hints on the Crimes 2.0 page. Reads the page, never clicks.
// @author       mat-mcc-uk
// @match        https://www.torn.com/page.php?sid=crimes*
// @match        https://www.torn.com/loader.php?sid=crimes*
// @updateURL    https://raw.githubusercontent.com/mat-mcc-uk/mat-mcc-uk-torn-crimes-assistant/main/crimes-assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/mat-mcc-uk/mat-mcc-uk-torn-crimes-assistant/main/crimes-assistant.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* =====================================================================
   * 1. RULE DATA (edit here after a balance patch)
   * ===================================================================== */

  const RULES = {
    cardskimming: {
      // Details per hour and skimmer loss risk, from the Card Skimming guide.
      locations: {
        'Gas Station':      { rate: 0.4,  risk: 'lowest' },
        'Bus Station':      { rate: 0.6,  risk: 'very low' },
        'Post Office':      { rate: 0.75, risk: 'low' },
        'Subway Station':   { rate: 0.9,  risk: 'minor' },
        'College Campus':   { rate: 1.1,  risk: 'moderate' },
        'Airport Terminal': { rate: 1.3,  risk: 'high' },
        'Bank Branch':      { rate: 1.7,  risk: 'high' },
        'Casino Lobby':     { rate: 2.15, risk: 'very high' },
      },
      breakEvenDetails: 7,    // recover matches install on skill per nerve
      parityDetails: 13,      // recover matches install on raw skill
      honourDetails: 250,     // Zero Liability
      saleTiers: [            // price per detail when sold in one go
        { min: 1,     low: 100, high: 160 },
        { min: 101,   low: 130, high: 190 },
        { min: 1001,  low: 160, high: 220 },
        { min: 10000, low: 190, high: 250 }, // also the Line of Credit honour
      ],
    },

    scamming: {
      marks: { 'Young Adult': 1, 'Middle-Aged': 1.25, 'Senior': 1.5, 'Professional': 3, 'Affluent': 10 },
      capitalise: { low: { cash: 1, skill: 1.5 }, medium: { cash: 2, skill: 2.5 }, high: { cash: 3, skill: 3.5 } },
      basePayout: {
        'Delivery': 560, 'Prize': 8825, 'Family': 15460, 'Charity': 25615, 'Tech support': 32800,
        'Vacation': 37950, 'Tax': 80000, 'Advance-fee': 67000, 'Job': 93000, 'Romance': 110000, 'Investment': 230000,
      },
      suspicionCap: 8,
      defaultMaxFail: 0.05,
      // Skill needed to unlock each scam, which sets its displacement tier.
      unlock: {
        'Delivery': 1, 'Family': 1, 'Prize': 1, 'Charity': 20, 'Tech support': 20, 'Vacation': 40, 'Tax': 40,
        'Advance-fee': 60, 'Job': 60, 'Romance': 80, 'Investment': 80,
      },
      // Cells moved per response: displacement[tier][accelerate stacks] = [strong, soft, back], each [min, max].
      // Read from the Scamming guide's table. Back moves left.
      displacement: {
        1:  [[[10,19],[3,7],[2,4]], [[15,29],[5,11],[3,6]], [[18,35],[6,13],[4,7]], [[21,39],[6,14],[4,8]], [[22,42],[7,15],[4,9]], [[23,44],[7,16],[5,9]]],
        20: [[[8,15],[3,7],[2,4]],  [[12,23],[5,11],[3,6]], [[15,28],[6,13],[4,7]], [[16,31],[6,14],[4,8]], [[18,33],[7,15],[4,9]], [[18,35],[7,16],[5,9]]],
        40: [[[7,13],[3,6],[2,4]],  [[11,20],[5,9],[3,6]],  [[13,24],[6,11],[4,7]], [[14,27],[6,12],[4,8]], [[15,29],[7,13],[4,9]], [[16,30],[7,14],[5,9]]],
        60: [[[6,11],[2,4],[2,4]],  [[9,17],[3,6],[3,6]],   [[11,20],[4,7],[4,7]],  [[12,23],[4,8],[4,8]],  [[13,24],[4,9],[4,9]],  [[14,25],[5,9],[5,9]]],
        80: [[[5,9],[2,3],[2,3]],   [[8,14],[3,5],[3,5]],   [[9,17],[4,6],[4,6]],   [[10,19],[4,6],[4,6]],  [[11,20],[4,7],[4,7]],  [[12,21],[5,7],[5,7]]],
      },
      // Planner weights: what each landing is worth. Rewards use the skill gain of capitalising there.
      value: { low: 1.5, medium: 2.5, high: 3.5, fail: -4, concern: -1.5, hesitation: -0.5, sensitivity: -0.5 },
      discount: 0.8,
    },

    burglary: {
      // [key item, unlock skill, casings the guide recommends]
      targets: {
        'Tool Shed': ['Lockpicks', 1, '1'], 'Beach Hut': ['Jemmy', 1, '1'], 'Bungalow': ['Window Breaker', 1, '1-2'],
        'Mobile Home': ['Rope', 1, '1'], 'Cottage': ['Window Breaker', 3, '2'], 'Apartment': ['Credit Card', 14, '4-6'],
        'Suburban Home': ['Window Breaker', 22, '1-2'], 'Secluded Cabin': ['Jemmy', 30, '1'], 'Farmhouse': ['Window Breaker', 38, '2-3'],
        'Lake House': ['Jemmy', 46, '3+'], 'Luxury Villa': ['Window Breaker', 69, '4+'], 'Manor House': ['Lockpicks', 100, '4-6'],
        'Funeral Directors': ['Lockpicks', 25, '2-3'], 'Self-Storage Facility': ['Skeleton Key', 25, '6+'], 'Postal Office': ['Credit Card', 25, '5+'],
        'Market': ['Jemmy', 25, '4-6'], 'Cleaning Agency': ['Jemmy', 27, '2'], 'Barbershop': ['Lockpicks', 35, '1-2'],
        'Liquor Store': ['Skeleton Key', 43, '2'], 'Dentists Office': ['Credit Card', 47, '1-2'], 'Chiropractors': ['Window Breaker', 56, '1-2'],
        'Recruitment Agency': ['Window Breaker', 77, '4-6'], 'Advertising Agency': ['Skeleton Key', 100, '4-6'],
        'Dockside Warehouse': ['Lockpicks', 50, '7+'], 'Farm Storage Unit': ['Jemmy', 50, '4-6'], 'Shipyard': ['Jemmy', 50, '8+'],
        'Printing Works': ['Window Breaker', 52, '4-6'], 'Brewery': ['Rope', 60, '8+'], 'Truckyard': ['Skeleton Key', 68, '1-2'],
        'Old Factory': ['Window Breaker', 76, '1'], 'Slaughterhouse': ['Credit Card', 84, '1-2'], 'Paper Mill': ['Skeleton Key', 92, '2-3'],
        'Foundry': ['Jemmy', 96, '2-3'], 'Fertilizer Plant': ['Lockpicks', 100, '2-3'],
      },
      // Names the game uses that differ from the guide's.
      aliases: {
        'Funeral Parlor': 'Funeral Directors', 'Funeral Home': 'Funeral Directors', 'Self Storage': 'Self-Storage Facility',
        'Post Office': 'Postal Office', 'Cleaning Firm': 'Cleaning Agency', 'Dentist Office': 'Dentists Office',
        'Chiropractor': 'Chiropractors', 'Temp Agency': 'Recruitment Agency', 'Ad Agency': 'Advertising Agency',
        'Docklands': 'Dockside Warehouse', 'Farm Storage': 'Farm Storage Unit',
      },
      burgleAtConfidence: 50,
    },

    disposal: {
      // Safety of each method per job, from the Disposal guide. s = safe (95%+), m = fairly safe (90-95%),
      // u = unsafe (80-90%), r = risky (60-80%), d = dangerous (under 60%), x = not possible, ? = no data.
      // Order: Abandon, Bury, Burn, Sink, Dissolve.
      methods: ['Abandon', 'Bury', 'Burn', 'Sink', 'Dissolve'],
      nerve: [6, 8, 10, 12, 14],
      jobs: {
        'General Waste': 'usmrd', 'Broken Appliance': 'urxsd', 'Old Furniture': 'ursud', 'Building Debris': 'urxsx',
        'Vehicle': 'uxmsx', 'Documents': 'rusdd', 'Industrial Waste': 'duxsx', 'Biological Waste': 'dursx',
        'Murder Weapon': '??xsd', 'Firearm': '?uxmd', 'Body Part': '???ms', 'Dead Body': '????s',
      },
      // What each method consumes or requires. Job-specific extras are listed under the job name.
      needs: { Bury: 'Shovel', Burn: 'Gas Can', Dissolve: 'Hydrochloric Acid' },
      jobNeeds: {
        'Vehicle': { Sink: 'Bricks', Abandon: 'Bleach and Paper Towels' },
        'Murder Weapon': { Abandon: 'Bleach and Paper Towels' },
        'Building Debris': { '*': 'Wheelbarrow' }, 'Industrial Waste': { '*': 'Wheelbarrow' },
        'Biological Waste': { '*': 'Disposable Mask' },
        'Firearm': { '*': 'Double Cut File', Abandon: 'Handkerchief' },
        'Body Part': { Bury: 'Shovel and Lye' },
        'Dead Body': { Sink: 'Anchor and Rope', Bury: 'Shovel and Lye', Dissolve: 'Bonesaw and 5 Hydrochloric Acid' },
      },
    },

    shoplifting: {
      // tier: 1 = fine with security on, 2 = better with security down, 3 = avoid while guards patrol
      stores: {
        "Sally's Sweet Shop": { tier: 1, note: 'safest store for skill' },
        "Bits 'n' Bobs": { tier: 1, note: 'good for skill' },
        'TC Clothing': { tier: 2, note: 'low value loot' },
        'Super Store': { tier: 2, note: 'low value loot' },
        'Pharmacy': { tier: 2, note: 'worth it only with security down' },
        'Cyber Force': { tier: 2, note: 'computer parts drop more with security down' },
        'Jewelry Store': { tier: 3, note: 'only with both measures down' },
        "Big Al's Gun Shop": { tier: 3, note: 'special ammo needs security down' },
      },
    },

    forgery: {
      // [unlock skill, steps, guide safety, risky step numbers]
      projects: {
        "Driver's License": [1, 4, 'safe', []], 'Parking Permit': [1, 4, 'safe', []], 'Concert Ticket': [1, 4, 'fairly safe', [3]],
        'License Plate': [25, 6, 'risky', [4]], 'Birth Certificate': [25, 5, 'unsafe', [4]], 'Diploma': [25, 4, 'fairly safe', [3, 4]],
        'Skeleton Key': [50, 4, 'risky', [3]], 'Prescription': [50, 4, 'safe', []], 'Travel Visa': [50, 5, 'unsafe', [3]],
        'ID Badge': [50, 5, 'unsafe', [3, 4, 5]], 'Bank Check': [75, 6, 'unsafe', [3, 4, 5]], 'Police Badge': [75, 7, 'risky', [4, 6]],
        'ATM Key': [75, 6, 'risky', [3, 5]], 'Passport': [75, 12, 'unsafe', [3, 4, 7, 8, 12]],
      },
    },

    bootlegging: {
      genres: ['Action', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Thriller', 'Sci-Fi'],
      // How fast each genre sells relative to the others.
      demand: { 'Action': 10, 'Fantasy': 7, 'Comedy': 7, 'Drama': 5.5, 'Thriller': 4, 'Horror': 3, 'Romance': 3, 'Sci-Fi': 2 },
      cinephile: 10000,   // sales of each genre for the Cinephile honour
    },

    hustling: {
      games: { 'Cornhole': 7, 'Snail Racing': 9, 'Find the Lady': 11, 'Shell Game': 12 },
      // Attention and suspicion read 0 to 100 (a percentage of each member's bar).
      buildTo: 60,      // below this, build attention by losing
      winDownTo: 40,    // win back down to about here
      cashOutSuspicion: 60,   // once suspicion passes this, win them out
      heartCashOut: 85,       // with a heart, keep going until suspicion is this high
      snakeOil: 100000,       // one bet of this wins the Snake Oil honour
      shillSkill: 60, pickpocketSkill: 80,
    },

    graffiti: {
      // Best spray colour per district, from the Graffiti guide. The guide rates this data as low confidence.
      districts: {
        'East Side': { cash: 'purple', rep: 'red' }, 'West Side': { cash: 'green', rep: 'blue' },
        'North Side': { cash: 'green', rep: 'orange' }, 'Residential District': { cash: 'white', rep: 'blue' },
        'Red-Light District': { cash: 'green', rep: 'pink' }, 'Financial District': { cash: 'black', rep: 'red' },
        'City Center': { cash: 'green', rep: 'blue' },
      },
      maxTags: 500,   // tags for 5-star reputation
    },

    arson: {
      // 'Location': 'RF' where R = rurality 1-5 and F = flammability 1-5, 0 = not yet known.
      // Source: the Arson guide's quick reference sheet.
      locations: {
        'Bazaar': '24', 'Beach Hut': '35', 'Firework Store': '20', 'Fishing Hut': '55', 'Forgery Workshop': '53', 'Hunting Lodge': '54',
        'Lifeguard Hut': '34', 'Mobile Home': '34', 'Restroom': '31', 'Self Storage Container': '43', 'Shack': '45', 'Tool Shed': '35',
        'Yurt': '35', 'Adult Store': '23', 'Apartment': '13', 'Arcade': '24', 'Barbershop': '22', 'Bookies': '14',
        'Bordello': '34', 'Bungalow': '33', 'Cafe': '34', 'Candle Shop': '25', 'Chiropractors Office': '22', 'Cleaning Agency': '33',
        'Clock Tower': '14', 'Clothing Store': '14', 'Community Center': '14', 'Cottage': '44', 'Cyber Cafe': '12', 'Dental Surgery': '20',
        'Detective Agency': '23', 'Diner': '43', 'Drugs Lab': '34', 'Flower Shop': '23', 'Funeral Parlor': '34', 'Game Shop': '22',
        'Gas Station': '25', 'Hair Salon': '22', 'Hardware Store': '34', 'Homeless Camp': '24', 'Jewelry Store': '23', 'Lingerie Store': '23',
        'Liquor Store': '24', 'Loanshark Office': '23', 'Mechanic Shop': '34', 'Music Store': '23', 'Pharmacy': '23', 'Police Safehouse': '23',
        'Printing Store': '25', 'Suburban Home': '33', 'Tattoo Parlor': '24', 'Toy Shop': '24', 'Travel Agent': '13', 'Art Gallery': '24',
        'Bank': '12', 'Barn': '00', 'Bowling Alley': '14', 'Car Showroom': '24', 'Car Wash': '32', 'Cinema': '15',
        'Distillery': '45', 'Farmhouse': '54', 'Fire Station': '21', 'Furniture Store': '35', 'Grocery Store': '23', 'Gym': '12',
        'Laboratory': '53', 'Lakehouse': '43', 'Law Firm': '23', 'Library': '35', 'Medical Center': '23', 'Motorcycle Club': '44',
        'Newspaper Office': '14', 'Nightclub': '14', 'Office Block': '13', 'Penthouse': '13', 'Pest Control Hub': '24', 'Police Station': '13',
        'Private Security': '22', 'Pub': '24', 'Recording Studio': '44', 'Restaurant': '14', 'Strip Club': '13', 'Subway': '23',
        'Townhouse': '23', 'Ad Agency': '13', 'Arms Warehouse': '45', 'Bus Terminal': '12', 'Chemical Plant': '55', 'Church': '34',
        'College': '23', 'Fertilizer Plant': '55', 'Hotel': '24', 'Luxury Villa': '43', 'Manor House': '43', 'Paper Mill': '45',
        'Post Office': '24', 'Raceway': '25', 'Ranch': '54', 'Recycling Facility': '45', 'Slaughterhouse': '42', 'Supermarket': '24',
        'Theater': '25', 'Warehouse': '44', 'Aircraft Hangar': '55', 'Casino': '14', 'Castle': '52', 'Cruise Line': '14',
        'Data Center': '51', 'Electrical Substation': '41', 'Factory': '44', 'Foundry': '42', 'Hospital': '13', 'Palace': '53',
        'Shopping Mall': '14', 'Sports Arena': '14', 'TV Studio': '23', 'Waste Facility': '55',
      },
      responseTime: [30, 60, 120, 240, 480],   // seconds for responders to arrive, by rurality
      burnRate: [0.4, 0.8, 1.2, 1.6, 2.0],     // max destruction % per second, by flammability
      maxLiquidStarters: 5,
    },
  };

  /* =====================================================================
   * 2. PURE LOGIC (no DOM, covered by test.js)
   * ===================================================================== */

  const Logic = {
    /* ---------- Card Skimming ---------- */

    parseAgeHours(text) {
      // "37 days, 1 hour" -> 889
      let hours = 0;
      const d = /(\d+)\s*day/.exec(text), h = /(\d+)\s*hour/.exec(text), m = /(\d+)\s*min/.exec(text);
      if (d) hours += +d[1] * 24;
      if (h) hours += +h[1];
      if (m) hours += +m[1] / 60;
      return hours;
    },

    saleTier(count) {
      const tiers = RULES.cardskimming.saleTiers;
      let current = null, next = null;
      for (const t of tiers) {
        if (count >= t.min) current = t; else if (!next) next = t;
      }
      return { current, next, toNext: next ? next.min - count : 0 };
    },

    skimmerAdvice(details) {
      const r = RULES.cardskimming;
      if (details >= r.honourDetails) return { level: 'good', text: 'Honour ready (250+)' };
      if (details >= r.parityDetails) return { level: 'good', text: 'Worth recovering' };
      if (details >= r.breakEvenDetails) return { level: 'ok', text: 'Break-even' };
      return { level: 'bad', text: 'Leave it (' + (r.breakEvenDetails - details) + ' to break-even)' };
    },

    /* ---------- Scamming ---------- */

    // Cell types: neutral, low, medium, high, temptation, sensitivity, concern, hesitation, fail
    isReward(t) { return t === 'low' || t === 'medium' || t === 'high'; },

    // Where the pip ends up after landing on index i, and what happens there.
    resolveLanding(cells, i) {
      const last = cells.length - 1;
      if (i > last) i = last;   // assumption: overshoot clamps to the final cell
      if (i < 0) i = 0;
      const t = cells[i];
      if (t === 'temptation') {
        for (let j = i + 1; j <= last; j++) {
          if (cells[j] === 'neutral' || Logic.isReward(cells[j])) return { index: j, type: cells[j], via: 'temptation' };
        }
        return { index: i, type: 'fail', via: 'temptation' };
      }
      if (t === 'sensitivity') {
        for (let j = i - 1; j >= 0; j--) {
          if (cells[j] === 'neutral') return { index: j, type: 'sensitivity', via: 'sensitivity' };
        }
        return { index: i, type: 'fail', via: 'sensitivity' };
      }
      return { index: i, type: t, via: null };
    },

    // range = {min, max} in cells, signed (negative moves left). Uniform over integers.
    evaluateResponse(cells, pos, range) {
      const p = { neutral: 0, low: 0, medium: 0, high: 0, concern: 0, hesitation: 0, sensitivity: 0, fail: 0 };
      const lo = Math.min(range.min, range.max), hi = Math.max(range.min, range.max);
      const n = hi - lo + 1;
      for (let d = lo; d <= hi; d++) {
        const r = Logic.resolveLanding(cells, pos + d);
        p[r.type] += 1 / n;
      }
      p.reward = p.low + p.medium + p.high;
      // Weighted by the skill gain each capitalisation tier gives.
      p.score = p.low * 1.5 + p.medium * 2.5 + p.high * 3.5;
      return p;
    },

    // options = [{name, range}]. Returns options sorted best first, with a pick.
    recommend(cells, pos, options, maxFail) {
      if (maxFail === undefined) maxFail = RULES.scamming.defaultMaxFail;
      const scored = options.map(o => Object.assign({ name: o.name }, Logic.evaluateResponse(cells, pos, o.range)));
      const safe = scored.filter(s => s.fail <= maxFail);
      const pool = safe.length ? safe : scored;
      pool.sort((a, b) => safe.length
        ? (b.score - a.score) || (a.concern - b.concern) || (a.fail - b.fail)
        : (a.fail - b.fail) || (b.score - a.score));
      return { pick: pool[0], safeChoiceExists: safe.length > 0, all: scored };
    },

    // Response options for a scam at a given number of Accelerate stacks already banked.
    // Each extra Accelerate is one more response, so plans with more of them are listed too.
    scamOptions(scam, stacks) {
      const S = RULES.scamming;
      const tier = S.displacement[S.unlock[scam] || 1];
      const names = ['Strong forward', 'Soft forward', 'Backward'];
      const out = [];
      for (let a = stacks || 0; a <= 5; a++) {
        tier[a].forEach(([min, max], i) => {
          const sign = i === 2 ? -1 : 1;
          out.push({ name: names[i], button: i, accelerate: a - (stacks || 0), range: { min: sign * min, max: sign * max } });
        });
      }
      return out;
    },

    // Expected value of standing at `pos` with `depth` responses of lookahead (no further Accelerates).
    scamValue(cells, pos, base, depth, memo) {
      if (depth <= 0) return 0;
      const key = pos + ':' + depth;
      if (memo[key] !== undefined) return memo[key];
      let best = 0;   // doing nothing more is always allowed
      for (const o of base) best = Math.max(best, Logic.scamOptionValue(cells, pos, o, base, depth, memo));
      return (memo[key] = best);
    },

    scamOptionValue(cells, pos, option, base, depth, memo) {
      const V = RULES.scamming.value, g = RULES.scamming.discount;
      const lo = Math.min(option.range.min, option.range.max), hi = Math.max(option.range.min, option.range.max);
      let total = 0;
      for (let d = lo; d <= hi; d++) {
        const r = Logic.resolveLanding(cells, pos + d);
        if (Logic.isReward(r.type)) total += V[r.type];
        else if (r.type === 'neutral') total += g * Logic.scamValue(cells, r.index, base, depth - 1, memo);
        else if (r.type === 'sensitivity') total += V.sensitivity + g * Logic.scamValue(cells, r.index, base, depth - 1, memo);
        else total += V[r.type];
      }
      return total / (hi - lo + 1) - 0.15 * (option.accelerate || 0);
    },

    // Full plan for one target: every option scored with three responses of lookahead.
    scamPlan(cells, pos, scam, stacks, maxFail) {
      if (maxFail === undefined) maxFail = RULES.scamming.defaultMaxFail;
      const options = Logic.scamOptions(scam, stacks);
      // Lookahead uses unboosted ranges: the boost is spent by the next response.
      const base = Logic.scamOptions(scam, 0).filter(o => o.accelerate === 0);
      const memo = {};
      const scored = options.map(o => Object.assign({}, o, Logic.evaluateResponse(cells, pos, o.range),
        { value: Logic.scamOptionValue(cells, pos, o, base, 3, memo) }));
      const safe = scored.filter(o => o.fail <= maxFail);
      const pool = (safe.length ? safe : scored).slice();
      pool.sort((a, b) => safe.length ? b.value - a.value : (a.fail - b.fail) || (b.value - a.value));
      const here = cells[pos];
      return {
        pick: pool[0], safeChoiceExists: safe.length > 0, all: scored,
        canCapitalise: Logic.isReward(here) ? here : null,
        abandon: Logic.shouldAbandon(cells, pos),
      };
    },

    // Suspicion paints `level` more cells red from the left on each action, never the pip's cell.
    applySuspicion(cells, pos, level) {
      const out = cells.slice();
      let left = Math.min(Math.max(level, 0), RULES.scamming.suspicionCap);
      for (let i = 0; i < out.length && left > 0; i++) {
        if (i === pos || out[i] === 'fail') continue;
        out[i] = 'fail';
        left--;
      }
      return out;
    },

    shouldAbandon(cells, pos) {
      const ahead = cells.slice(pos);
      if (!cells.some(Logic.isReward)) return 'No reward cells left';
      if (cells[pos] === 'concern' && cells.slice(0, Math.min(pos, 10)).every(c => c === 'fail')) return 'Concern with high suspicion';
      if (!ahead.some(c => c === 'neutral' || Logic.isReward(c) || c === 'temptation')) return 'No safe path ahead';
      return null;
    },

    scamPayout(scam, mark, tier) {
      const s = RULES.scamming;
      const base = s.basePayout[scam], m = s.marks[mark], c = s.capitalise[tier];
      if (!base || !m || !c) return null;
      return Math.round(base * m * c.cash);
    },

    /* ---------- Disposal ---------- */

    disposalAdvice(job) {
      const D = RULES.disposal;
      const code = D.jobs[job];
      if (!code) return null;
      const rank = { s: 5, m: 4, u: 3, r: 2, d: 1, '?': 0, x: -1 };
      const word = { s: 'safe', m: 'fairly safe', u: 'unsafe', r: 'risky', d: 'dangerous', '?': 'untested', x: 'not possible' };
      const methods = D.methods.map((name, i) => ({ name, index: i, code: code[i], rank: rank[code[i]], safety: word[code[i]], nerve: D.nerve[i] }));
      // Safest wins. Among equally safe methods the dearer one wins, because jobs are capped daily and nerve is not.
      const best = methods.slice().sort((a, b) => (b.rank - a.rank) || (b.nerve - a.nerve))[0];
      const extra = D.jobNeeds[job] || {};
      const needs = [extra[best.name] || D.needs[best.name], extra['*']].filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);
      return { best, methods, needs, avoid: methods.filter(m => m.code === 'd').map(m => m.name) };
    },

    /* ---------- Shoplifting ---------- */

    // status = the row's security label, e.g. "Status: 3 Cameras disabled, Guard patrolling"
    shopliftAdvice(store, status, notoriety) {
      const info = RULES.shoplifting.stores[store] || { tier: 2, note: '' };
      const parts = (status || '').replace(/^Status:\s*/i, '').split(/,\s*/).filter(Boolean);
      const active = p => /recording|patrolling|enabled|\bon\b|active/i.test(p) && !/disabled|break|away|offline|off\b/i.test(p);
      const on = parts.filter(active), off = parts.filter(p => !active(p));
      const guardsOn = on.some(p => /guard/i.test(p)), guardsOff = off.some(p => /guard/i.test(p));
      const hot = /very high|high/i.test(notoriety || ''), warm = /moderate|medium/i.test(notoriety || '');
      let level, text;
      if (hot) { level = 'bad'; text = 'Notoriety high: let it cool, 1% per 5 minutes'; }
      else if (parts.length && !on.length) { level = 'good'; text = 'All security down: go now'; }
      else if (guardsOff) { level = 'good'; text = 'Guard away: go now, the window is 10 to 15 minutes'; }
      else if (off.length) { level = guardsOn ? 'ok' : 'good'; text = off.join(', ').replace(/\d+\s*/, '') + ': less notoriety per theft' + (guardsOn ? ', guard still on' : ''); }
      else if (info.tier === 1) { level = 'ok'; text = 'Security on, but ' + info.note; }
      else if (info.tier === 3 || guardsOn) { level = 'bad'; text = 'Wait: ' + info.note; }
      else { level = 'ok'; text = 'Security on: ' + info.note; }
      if (warm && level !== 'bad') text += ' \u00b7 notoriety building';
      return { level, text, on: on.length, off: off.length };
    },

    /* ---------- Forgery ---------- */

    forgeryRoute(skill) {
      const fast = skill < 50 ? "Driver's License" : skill < 90 ? 'Travel Visa' : 'Passport';
      const cheap = skill < 60 ? "Driver's License" : skill < 80 ? 'Birth Certificate' : 'License Plate';
      const next = skill < 50 ? 'Travel Visas open at 50.' : skill < 90 ? 'Passports become worthwhile near 90.' : '';
      return { fast, cheap, next };
    },

    forgeryStep(project, step) {
      const key = Object.keys(RULES.forgery.projects).find(k => k.toLowerCase().replace(/[^a-z]/g, '') === (project || '').toLowerCase().replace(/[^a-z]/g, ''));
      if (!key) return null;
      const [, steps, safety, risky] = RULES.forgery.projects[key];
      return { project: key, steps, safety, risky: risky.includes(step), last: step === steps };
    },

    /* ---------- Bootlegging ---------- */

    // sold and stock are {genre: number}
    bootlegPlan(sold, stock) {
      const B = RULES.bootlegging;
      const short = B.genres.map(g => ({ genre: g, left: Math.max(0, B.cinephile - (sold[g] || 0)) })).filter(x => x.left > 0)
        .sort((a, b) => b.left - a.left);
      // Days of stock = stock divided by demand. Copy the genre that runs out first.
      const cover = B.genres.map(g => ({ genre: g, cover: (stock[g] || 0) / B.demand[g] })).sort((a, b) => a.cover - b.cover);
      const allEmpty = B.genres.every(g => !(stock[g] > 0));
      // With nothing in stock, favour genres still short for the honour, then the best sellers.
      const copyNext = allEmpty && short.length ? short[0].genre : cover[0].genre;
      return { short, copyNext, allEmpty, honourDone: short.length === 0 };
    },

    /* ---------- Hustling ---------- */

    // label e.g. "Audience member 1 of 2, attention 7  suspicion 0  wealth 4 out of 12"
    hustlingMember(label) {
      if (!label) return null;
      const n = re => { const m = re.exec(label); return m ? +m[1] : null; };
      const att = n(/attention\s+(\d+)/i), sus = n(/suspicion\s+(\d+)/i), wealth = n(/wealth\s+(\d+)/i);
      if (att === null) return null;
      return { attention: att, suspicion: sus === null ? 0 : sus, wealth };
    },

    // members: parsed members. flags.heart: a member whose favourite is the game in play (betting phase only).
    // Returns the next bet action for the live game and why.
    hustlingAdvice(members, flags) {
      const H = RULES.hustling;
      flags = flags || {};
      if (!members.length) return { action: null, text: 'Gather an audience to begin.' };
      const heart = members.find(m => m.heart) || (flags.heartIndex != null ? members[flags.heartIndex] : null);
      const hi = heart || members.reduce((a, b) => b.attention > a.attention ? b : a);
      // Cash-out phase: suspicion high enough that attention is capped.
      const cap = heart ? H.heartCashOut : H.cashOutSuspicion;
      if (hi.suspicion >= cap) return { action: 'win', target: hi, text: 'Suspicion is high (' + hi.suspicion + '%). Win until they leave.' };
      if (heart) {
        if (heart.attention < 95) return { action: 'lose', target: heart, text: 'They love this game. Lose to build their attention (now ' + heart.attention + '%), then win once or twice.' };
        return { action: 'win', target: heart, text: 'Attention is high (' + heart.attention + '%). Win once or twice, do not empty it, then top up with a loss.' };
      }
      const top = hi.attention;
      if (top < H.buildTo) return { action: 'lose', target: hi, text: 'Attention is low (' + top + '%). Lose to build it above ' + H.buildTo + '% before cashing in.' };
      return { action: 'win', target: hi, text: 'Attention is up (' + top + '%). Win down to about ' + H.winDownTo + '%, then lose to build it again.' };
    },

    /* ---------- Arson ---------- */

    // reqs = the aria-labels of a job's request icons, e.g. ["Vendetta", "Total destruction required"]
    arsonRequirements(reqs) {
      const text = reqs.join(' | ');
      const num = re => { const m = re.exec(text); return m ? +m[1] : null; };
      return {
        total: /total destruction/i.test(text),
        min: num(/more than (\d+)/i),
        max: num(/(?:less than|no more than|maximum of?) (\d+)/i),
        lowSuspicion: /accidental|insurance/i.test(text),
        highSuspicion: /suspicious/i.test(text),
        visibility: /visib/i.test(text),
        evidence: /evidence/i.test(text),
        accelerant: (/(solid|liquid|gaseous)/i.exec(text) || [])[1] || null,
      };
    },

    arsonJob(name, areas, reqs) {
      const A = RULES.arson;
      const code = A.locations[name];
      const req = Logic.arsonRequirements(reqs || []);
      areas = areas || 1;
      const starters = Math.min(areas + 1, A.maxLiquidStarters);
      const secs = n => n >= 120 ? 'about ' + Math.round(n / 60) + ' minutes' : 'about ' + n + ' seconds';
      const detail = [];   // full sentences, shown when the player clicks the badge
      const tags = [];     // short extras appended to the badge

      const fuels = /accidental|insurance/i.test((reqs || []).join(' '))
        ? ' (Kerosene if you have it. Avoid Gasoline here, because it raises suspicion)'
        : ' (Gasoline, or Diesel or Kerosene once you have them)';
      const startLine = 'To start: Place ' + starters + ' liquid fuel' + (starters > 1 ? 's' : '') + fuels + ', then Ignite. ' +
        (areas > 1 ? 'This building has ' + areas + ' areas, and liquids spread across them. ' : '') +
        'More than ' + A.maxLiquidStarters + ' fuels at once raises the risk of a critical failure.';

      if (req.lowSuspicion) { tags.push('look accidental'); detail.push('The client wants it to look like an accident. Gasoline raises suspicion, so use Oxygen, Potassium Nitrate or Kerosene, and add Methane last because it removes suspicion.'); }
      if (req.highSuspicion) { tags.push('look deliberate'); detail.push('The client wants it to look deliberate. Use Gasoline and Magnesium.'); }
      if (req.visibility) { tags.push('be seen'); detail.push('The fire must be highly visible. Use Diesel, Magnesium or the Flamethrower at least four times in total.'); }
      if (req.evidence) { tags.push('plant evidence'); detail.push('You must plant evidence before lighting it. The job names the item when you inquire, and you need one in your inventory.'); }
      if (req.accelerant) { tags.push(req.accelerant.toLowerCase() + ' fuel only'); detail.push('Only ' + req.accelerant.toLowerCase() + ' accelerants are allowed. Any other type fails the job.'); }

      // Torn's own tooltip cuts long text, so the hover tip stays short and points at the click.
      const tipEnd = 'Place ' + starters + ' liquid fuel' + (starters > 1 ? 's' : '') + ', then Ignite. Click the badge for the full explanation.';

      const need = req.total ? 100 : req.min;
      const hasNeed = need !== null && need !== undefined;
      const payLine = req.max !== null ? 'Pay scales with damage up to the ' + req.max + '% limit.'
        : hasNeed ? 'It pays in full once damage passes ' + (req.total ? '100%' : need + '%') + ', and nothing below that.'
        : 'No damage target: pay scales with damage, so more destruction means more money.';

      if (!code || code[0] === '0' || code[1] === '0') {
        detail.unshift('No burn data exists for this location yet, so the script cannot judge its difficulty.');
        detail.push(startLine, payLine);
        const label0 = 'No data \u00b7 try ' + starters + ' fuel' + (tags.length ? ' \u00b7 ' + tags.join(', ') : '');
        return { known: false, level: 'ok', label: label0, tip: label0 + '. ' + tipEnd, detail, req, starters, text: 'No data' };
      }

      const r = +code[0], f = +code[1];
      const response = A.responseTime[r - 1], rate = A.burnRate[f - 1];
      const burn = Math.round(100 / rate);
      // Damage reachable before the fire crew arrives, without Thermite or Magnesium.
      // Assumes the crew sets off the moment you ignite, so the real figure is a little higher.
      const cap = Math.min(100, Math.round(response * rate));
      const speed = ['very slowly', 'slowly', 'at a moderate pace', 'quickly', 'very quickly'][f - 1];
      const where = ['in a busy area', 'in a built-up area', 'in a quiet area', 'in a remote area', 'far from anyone'][r - 1];
      detail.unshift('This building burns ' + speed + ' and sits ' + where + '. Left alone with enough fuel it burns down in ' +
        secs(burn) + '. The fire crew takes ' + secs(response) + ' to arrive, and they stop the fire.');

      let level = 'good', label;
      if (req.max !== null) {
        level = 'ok'; label = 'Careful · stay under ' + req.max + '% damage';
        detail.push('Damage must not pass ' + req.max + '%. Start with one fuel, watch the damage meter, and keep a Blanket ready to Dampen. It gains about ' + rate + '% per second at full burn.');
      } else if (hasNeed && cap < need) {
        level = 'bad'; label = 'Hard · needs ' + need + '%, bring Thermite or Magnesium';
        detail.push('It needs ' + need + '% damage, but the crew arrives when it is only about ' + cap + '% burned. Thermite makes it burn faster. Magnesium keeps it burning after the crew arrives. Without one of them this job will most likely fail.');
      } else if (hasNeed && response - need / rate < 30) {
        level = 'ok'; label = 'Tight · needs ' + need + '%, no time to spare';
        detail.push('It needs ' + need + '% damage. That takes ' + secs(Math.round(need / rate)) + ' against a crew arrival of ' + secs(response) + ', so place all your fuel before igniting and do not wait.');
      } else if (hasNeed) {
        label = 'Easy · needs ' + need + '%, plenty of time';
        detail.push('It needs ' + need + '% damage. That takes ' + secs(Math.round(need / rate)) + ' and the crew needs ' + secs(response) + ', so you have time to add fuel if it stalls.');
      } else if (cap >= 100) {
        label = 'Easy · ' + starters + ' fuel, let it burn';
        detail.push('It can burn down completely before the crew arrives.');
      } else {
        level = cap < 60 ? 'ok' : 'good';
        label = 'Partial · crew arrives at about ' + cap + '% damage';
        detail.push('The crew arrives before it burns down, at about ' + cap + '% damage. That is fine here because the job has no damage target. Thermite or Magnesium would push it higher.');
      }
      if (tags.length) label += ' · ' + tags.join(', ');
      detail.push(startLine, payLine);
      const tip = label + '. Burns down in ' + secs(burn) + ', fire crew arrives in ' + secs(response) + '. ' + tipEnd;
      return { known: true, level, label, tip, detail, req, starters, rurality: r, flammability: f, response, burn, cap, text: label };
    },

    // Live fire state, read from a burning job's row.
    // s = {intensity:'yellow'|'orange'|'red', rising, falling, momentum:int, areas:int,
    //      responder:0-5, arrived:bool, damage:int, max:int|null, total:bool}
    arsonFire(s) {
      const warn = [];
      const red = s.intensity === 'red';
      if (red) warn.push('Red intensity: do not stoke or dampen, it is very likely to crit.');
      if (!red && s.momentum >= 3) warn.push('Momentum is high (' + s.momentum + '): wait for it to fall before stoking, or you may ignite the fuel on yourself.');
      if (s.arrived) warn.push('Responders are here: the fire is being put out. Magnesium slows that.');
      else if (s.responder >= 4) warn.push('Responders almost here (' + s.responder + ' of 5): high jail risk if you stoke or dampen now.');
      if (s.areas === 1) warn.push('Single-area fire: dampening it tends to crit. Stoke or let it burn instead.');
      if (s.max != null && s.damage >= s.max - 3) warn.push('Damage is near the ' + s.max + '% cap (' + s.damage + '%): stop stoking.');
      const safeToStoke = !red && s.momentum < 3 && !s.arrived && s.responder < 4;
      const safeToDampen = !red && s.areas > 1 && !s.arrived && s.responder < 4;
      // One-line verdict for the badge.
      let verdict;
      if (red) verdict = 'Wait: red intensity';
      else if (s.momentum >= 3) verdict = 'Wait for momentum to fall';
      else if (s.arrived || s.responder >= 4) verdict = 'Responders here: leave it';
      else verdict = 'Safe to act · ' + s.intensity + (s.falling ? ' falling' : s.rising ? ' rising' : '');
      return { warnings: warn, safeToStoke, safeToDampen, red, verdict };
    },

    /* ---------- Burglary ---------- */

    burglaryTarget(title) {
      const B = RULES.burglary;
      const name = B.targets[title] ? title
        : B.aliases[title] || Object.keys(B.targets).find(n => title.startsWith(n))
        || B.aliases[Object.keys(B.aliases).find(a => title.startsWith(a))];
      return name ? { name, item: B.targets[name][0], unlock: B.targets[name][1], casings: B.targets[name][2] } : null;
    },

    // status comes from the page: "Unknown", "All clear", "Too dangerous"
    burglaryAdvice(confidence, status, target) {
      const pct = Math.round(Logic.burglarySuccess(confidence) * 100);
      const guide = target ? ' \u00b7 guide: ' + target.casings + ' casings' : '';
      if (/all clear/i.test(status)) return { level: 'good', text: 'Burgle now: all clear guarantees success' };
      if (/danger/i.test(status)) return { level: 'bad', text: 'Locked out: too dangerous, wait 20 to 60 min' };
      if (confidence >= RULES.burglary.burgleAtConfidence) return { level: 'good', text: 'Burgle now \u00b7 about ' + pct + '% success' };
      if (confidence >= 30) return { level: 'ok', text: 'Case once more \u00b7 about ' + pct + '% now' + guide };
      return { level: 'bad', text: 'Case first \u00b7 about ' + pct + '% now' + guide };
    },

    burglarySuccess(confidence) {
      if (confidence >= 100) return 0.985;
      if (confidence >= 40) return 0.90;
      if (confidence >= 30) return 0.85;
      return 0.70;
    },
  };

  // Node (tests) stops here.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RULES, Logic };
    return;
  }

  /* =====================================================================
   * 3. PAGE SHELL
   * ===================================================================== */

  const STORE_KEY = 'cca-settings';
  const settings = Object.assign({ enabled: {} }, JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
  const saveSettings = () => localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  const isOn = id => settings.enabled[id] !== false;

  const css = `
    #cca-bar { margin: 6px 0; padding: 8px 10px; border-radius: 5px; background: #1c2a1c; border: 1px solid #3d6b3d;
               color: #dfe; font-size: 12px; line-height: 1.5; }
    #cca-bar b { color: #9f9; }
    #cca-bar .cca-off { float: right; cursor: pointer; opacity: .6; }
    .cca-wrap { flex-wrap: wrap !important; align-content: center !important; }
    .cca-badge { flex-basis: 100%; width: fit-content; max-width: 100%; margin: 2px 0 0 0; padding: 1px 6px;
                 border-radius: 3px; font-size: 10px; font-weight: normal; white-space: nowrap;
                 overflow: hidden; text-overflow: ellipsis; position: relative; z-index: 3; pointer-events: auto; }
    .cca-badge[data-key] { cursor: pointer; text-decoration: underline dotted; }
    /* Graffiti rows are only 50px tall with hidden overflow, so a wrapped badge clips.
       This one floats in the empty band between the name and the reputation icon. */
    .cca-graffiti { position: absolute; top: 50%; transform: translateY(-50%); right: 118px;
                    max-width: 190px; font-size: 11px; padding: 1px 7px; border-radius: 3px;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    pointer-events: none; z-index: 4; }
    .cca-pick { outline: 2px solid #7f7 !important; outline-offset: 2px; border-radius: 50%; }
    .cca-good { background: #24572a; color: #cfc; }
    .cca-ok   { background: #5a5320; color: #ffc; }
    .cca-bad  { background: #4a2a2a; color: #fbb; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const q = (root, part) => root.querySelector('[class*="' + part + '"]');
  const rows = () => [...document.querySelectorAll('.crime-root [class*="crimeOptionWrapper"]')];
  const money = n => '$' + Math.round(n).toLocaleString('en-GB');
  const num = n => Math.round(n).toLocaleString('en-GB');
  // A row's own title, ignoring anything other scripts (or this one) have added inside the title element.
  const ownText = el => el ? [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : '';
  // Crime skill for the open crime, from the level bar's label ("Crime skill: 84 (64%)").
  const crimeSkill = () => {
    const label = document.querySelector('[class*="currentCrime"] [class*="progressFill"][aria-label]')?.getAttribute('aria-label') || '';
    const m = /Crime skill:\s*(\d+)/i.exec(label);
    return m ? +m[1] : null;
  };
  // Outline a set of elements, touching classes only where they need to change.
  const setPicks = picks => {
    document.querySelectorAll('.cca-pick').forEach(b => { if (!picks.has(b)) b.classList.remove('cca-pick'); });
    picks.forEach(b => { if (!b.classList.contains('cca-pick')) b.classList.add('cca-pick'); });
  };

  function setBar(moduleId, html) {
    let bar = document.getElementById('cca-bar');
    const root = document.querySelector('.crime-root');
    if (!html || !root) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'cca-bar';
      root.parentNode.insertBefore(bar, root);
    }
    const full = '<span class="cca-off" title="Hide hints for this crime">hide</span>' + html;
    if (bar.dataset.html !== full) {
      bar.dataset.html = full;
      bar.innerHTML = full;
      bar.querySelector('.cca-off').addEventListener('click', () => {
        settings.enabled[moduleId] = false; saveSettings(); cleanup();
      });
    }
  }

  function setBadge(row, anchor, level, text, tip) {
    if (!anchor) return;
    let badge = row.querySelector('.cca-badge');
    if (!badge) {
      badge = document.createElement('span');
      anchor.classList.add('cca-wrap');   // puts the badge on its own line under the title
      anchor.appendChild(badge);
    }
    const cls = 'cca-badge cca-' + level;
    if (badge.className !== cls) badge.className = cls;
    if (badge.textContent !== text) badge.textContent = text;
    if (tip !== undefined && badge.title !== tip) badge.title = tip;
  }

  function cleanup() {
    document.getElementById('cca-bar')?.remove();
    document.querySelectorAll('.cca-badge').forEach(b => b.remove());
    document.querySelectorAll('.cca-pick').forEach(b => b.classList.remove('cca-pick'));
    document.querySelectorAll('.cca-graffiti').forEach(b => b.remove());
  }

  /* =====================================================================
   * 4. MODULES
   * ===================================================================== */

  const MODULES = {
    cardskimming: {
      render() {
        const R = RULES.cardskimming;
        let stored = 0, onSkimmers = 0, count = 0, honourReady = 0, perHour = 0;

        for (const row of rows()) {
          const title = (q(row, 'flexGrow')?.textContent || '').trim();
          if (/Sell Card Details/i.test(row.textContent)) {
            const m = /([\d,]+)\s*Card Details/i.exec(row.textContent.replace(/Sell Card Details/i, ''));
            if (m) stored = +m[1].replace(/,/g, '');
            continue;
          }
          const timeEl = q(row, 'timeSection'), statusEl = q(row, 'statusSection');
          if (!timeEl || !statusEl) continue;   // the Install row
          const details = +((/([\d,]+)/.exec(statusEl.textContent) || [0, '0'])[1].replace(/,/g, ''));
          const hours = Logic.parseAgeHours(timeEl.textContent);
          // startsWith, because our own badge sits inside the title element after the first render
          const loc = R.locations[Object.keys(R.locations).find(k => title.startsWith(k))];
          count++; onSkimmers += details;
          if (details >= R.honourDetails) honourReady++;
          if (hours > 0) perHour += details / hours;
          const advice = Logic.skimmerAdvice(details);
          const rate = hours > 0 ? (details / hours).toFixed(2) + '/h' : '';
          const expected = loc ? ' (guide: ' + loc.rate + '/h)' : '';
          setBadge(row, q(row, 'flexGrow'), advice.level, advice.text + (rate ? ' · ' + rate + expected : ''));
        }

        const total = stored + onSkimmers;
        const tier = Logic.saleTier(total);
        const parts = [];
        parts.push('<b>' + total.toLocaleString('en-GB') + '</b> details in play (' + stored.toLocaleString('en-GB') +
          ' stored, ' + onSkimmers.toLocaleString('en-GB') + ' on ' + count + ' skimmers shown).');
        if (tier.current) {
          parts.push('Selling all now: ' + money(total * tier.current.low) + ' to ' + money(total * tier.current.high) + '.');
        }
        if (tier.next) {
          const days = perHour > 0 ? ' About ' + Math.ceil(tier.toNext / perHour / 24) + ' days at your current rate.' : '';
          parts.push('Next price tier at ' + tier.next.min.toLocaleString('en-GB') + ': <b>' + tier.toNext.toLocaleString('en-GB') +
            '</b> to go.' + days + (tier.next.min === 10000 ? ' That sale also earns Line of Credit.' : ''));
        }
        if (honourReady) parts.push('<b>' + honourReady + '</b> skimmer' + (honourReady > 1 ? 's hold' : ' holds') + ' 250+ details: recovering one earns Zero Liability.');

        // The toggler button holds the selected option as "Level<name>"
        const toggler = document.querySelector('.crime-root [class*="dropdownMainWrapper"] button.toggler');
        const picked = (toggler?.textContent || '').trim().replace(/^Level/, '');
        const pl = R.locations[picked];
        if (pl) parts.push('Install target ' + picked + ': ' + pl.rate + ' details/h, ' + pl.risk + ' loss risk.');
        setBar('cardskimming', parts.join(' '));
      },
    },

    scamming: {
      // Zone type comes from a class on the zone element. Neutral zones carry none.
      TYPES: ['sensitivity', 'temptation', 'concern', 'hesitation', 'fail', 'low', 'medium', 'high'],

      readTarget(row) {
        const pipEl = q(row, 'pipPosition');
        if (!pipEl) return null;   // unread reply, or not a target row
        const plain = el => [...el.classList].map(c => c.replace(/_{2,3}[A-Za-z0-9_-]{5}$/, ''));
        const num = (classes, prefix) => { const c = classes.find(x => x.startsWith(prefix)); return c ? parseInt(c.slice(prefix.length), 10) : NaN; };
        const cells = new Array(50).fill(null);
        for (const el of row.querySelectorAll('[class*="zone"]')) {
          const classes = plain(el);
          if (!classes.includes('zone')) continue;
          const start = num(classes, 'start-'), size = num(classes, 'size-');
          if (isNaN(start) || isNaN(size)) continue;
          const type = this.TYPES.find(t => classes.includes(t)) || 'neutral';
          for (let i = start; i < start + size && i < 50; i++) if (cells[i] === null) cells[i] = type;   // first zone wins
        }
        if (cells.some(c => c === null)) return null;
        const pos = num(plain(pipEl), 'state-');
        const mark = (row.querySelector('[class*="tabletAvatar"] [aria-label], [class*="targetPortrait"] [aria-label]')?.getAttribute('aria-label') || '')
          .replace(/\s+(Male|Female)$/i, '');
        return {
          cells, pos: isNaN(pos) ? 0 : pos, mark, stacks: this.readStacks(row),
          scam: (q(row, 'scamMethod')?.textContent || '').trim(),
          email: (row.querySelector('[class*="email_"]')?.textContent || '').trim(),
          buttons: [...row.querySelectorAll('button[class*="responseTypeButton"]')],
        };
      },

      // The game speeds up the response animation with a CSS variable, --times-accelerated,
      // on elements it marks "accelerated". That variable is the banked Accelerate count.
      readStacks(row) {
        const candidates = [...row.querySelectorAll('[class*="accelerated"]'),
          ...row.querySelectorAll('button[class*="responseTypeButton"]'), row];
        for (const el of candidates) {
          const n = parseInt(getComputedStyle(el).getPropertyValue('--times-accelerated'), 10);
          if (n > 0) return Math.min(n, 5);
        }
        return 0;
      },

      cache: {},

      render() {
        const pct = x => Math.round(x * 100) + '%';
        const lines = [];
        let unread = 0;
        const picks = new Set();
        for (const row of rows()) {
          if (/^Read/i.test(row.querySelector('[class*="commitButtonSection"] button')?.getAttribute('aria-label') || '') && q(row, 'emailAndMethod')) { unread++; continue; }
          const t = this.readTarget(row);
          if (!t) continue;
          const sig = t.scam + '|' + t.pos + '|' + t.stacks + '|' + t.cells.join(',');
          const plan = this.cache[sig] || (this.cache[sig] = Logic.scamPlan(t.cells, t.pos, t.scam, t.stacks));
          const p = plan.pick;
          const payout = tier => { const v = Logic.scamPayout(t.scam, t.mark, tier); return v === null ? '?' : money(v); };
          let line = '<b>' + t.email + '</b> (' + t.scam + ', ' + (t.mark || 'unknown mark') + '; pays about ' +
            payout('low') + ' / ' + payout('medium') + ' / ' + payout('high') + '). ';
          if (t.stacks) line += '<b>' + t.stacks + '</b> Accelerate banked. ';
          if (plan.abandon) line += '<b>Consider abandoning:</b> ' + plan.abandon + '. ';
          if (plan.canCapitalise) line += 'On <b>' + plan.canCapitalise + '</b> reward: Capitalise is available now. ';
          const first = p.accelerate ? 'Accelerate ×' + p.accelerate + ', then ' + p.name : p.name;
          line += 'Best move: <b>' + first + '</b> (fail ' + pct(p.fail) + ', reward ' + pct(p.reward) +
            ', sensitivity ' + pct(p.sensitivity) + ', concern ' + pct(p.concern) + ').';
          if (!plan.safeChoiceExists) line += ' No move is under the 5% fail limit.';
          const plain = plan.all.filter(o => o.accelerate === 0 && o !== p)
            .map(o => o.name + ': fail ' + pct(o.fail) + ', reward ' + pct(o.reward));
          if (plain.length) line += ' Others: ' + plain.join('; ') + '.';
          lines.push(line);
          // Outline the button to press first. Accelerate is the fourth response button.
          const target = t.buttons[p.accelerate ? 3 : p.button];
          if (target) picks.add(target);
        }
        setPicks(picks);
        if (unread) lines.push(unread + ' unread repl' + (unread > 1 ? 'ies' : 'y') + ': Read costs no nerve and reveals the bar.');
        setBar('scamming', lines.length ? lines.join('<br>')
          : 'No scam targets yet. Replies depend on your address pool: the guide suggests 10,000 or more.');
      },
    },

    disposal: {
      render() {
        const picks = new Set();
        let jobs = 0, unknown = 0;
        const needs = {};
        for (const row of rows()) {
          const buttons = [...row.querySelectorAll('button[class*="methodButton"][aria-label]')];
          if (!buttons.length) continue;
          jobs++;
          const titleEl = q(row, 'flexGrow');
          const advice = Logic.disposalAdvice(ownText(titleEl) || (titleEl?.textContent || '').trim());
          if (!advice) { unknown++; continue; }
          const b = advice.best;
          const level = b.rank >= 4 ? 'good' : b.rank >= 3 ? 'ok' : 'bad';
          advice.needs.forEach(n => { needs[n] = (needs[n] || 0) + 1; });
          setBadge(row, titleEl, level, 'Best: ' + b.name + ' (' + b.safety + ')' + (advice.needs.length ? ' \u00b7 needs ' + advice.needs.join(', ') : ''),
            advice.methods.map(m => m.name + ': ' + m.safety).join('. ') + '.');
          const target = buttons.find(x => x.getAttribute('aria-label') === b.name);
          if (target) picks.add(target);
        }
        setPicks(picks);
        if (!jobs) { setBar('disposal', 'No disposal jobs left today. New jobs arrive at midnight Torn time.'); return; }
        const list = Object.keys(needs).map(n => n + ' (' + needs[n] + ' job' + (needs[n] > 1 ? 's' : '') + ')');
        setBar('disposal', '<b>' + jobs + '</b> jobs today. The outlined method is the safest for each job; where two are equally safe, the dearer one, since jobs are capped daily and it gives more skill. ' +
          (list.length ? 'Across today\u2019s jobs you need: <b>' + list.join(', ') + '</b>. ' : '') +
          (unknown ? unknown + ' job type' + (unknown > 1 ? 's are' : ' is') + ' not in the guide.' : ''));
      },
    },

    shoplifting: {
      render() {
        let best = null;
        for (const row of rows()) {
          const sec = q(row, 'securityMeasuresSection');
          if (!sec) continue;
          const titleEl = q(row, 'flexGrow');
          const store = ownText(titleEl);
          const notoriety = row.querySelector('[class*="notorietyBar"][aria-label]')?.getAttribute('aria-label') || '';
          const advice = Logic.shopliftAdvice(store, sec.getAttribute('aria-label'), notoriety);
          setBadge(row, titleEl, advice.level, advice.text, 'Security: ' + (sec.getAttribute('aria-label') || '').replace(/^Status:\s*/i, '') + '. Notoriety: ' + notoriety + '.');
          if (advice.level === 'good' && (!best || advice.off > best.off)) best = { store, off: advice.off, text: advice.text };
        }
        setBar('shoplifting', (best ? 'Best right now: <b>' + best.store + '</b> (' + best.text + '). ' : 'No store has security down right now. ') +
          'Cameras drop for 30 to 60 minutes a few times a day, guards take 10 to 15 minute breaks, checkpoints break every 3 to 4 days. ' +
          'Keep notoriety under 60%, or jail time after a critical failure grows sharply.');
      },
    },

    forgery: {
      render() {
        const skill = crimeSkill();
        for (const row of rows()) {
          const m = /Step #(\d+)/.exec(row.textContent);
          if (!m) continue;
          const titleEl = q(row, 'flexGrow');
          const info = Logic.forgeryStep(ownText(titleEl), +m[1]);
          if (!info) { setBadge(row, titleEl, 'ok', 'Not in the guide: no step data'); continue; }
          setBadge(row, titleEl, info.risky ? 'bad' : 'good',
            (info.risky ? 'Step ' + m[1] + ' fails often' : 'Step ' + m[1] + ' is safe') + (info.last ? ' \u00b7 final step' : ' \u00b7 ' + m[1] + ' of ' + info.steps),
            'The guide rates ' + info.project + ' as ' + info.safety + ' overall. A critical failure on the final step costs the most skill.');
        }
        if (skill === null) { setBar('forgery', 'Could not read your Forgery skill.'); return; }
        const r = Logic.forgeryRoute(skill);
        setBar('forgery', 'Forgery skill <b>' + skill + '</b>. For skill, the guide\u2019s fastest project now is <b>' + r.fast + '</b>' +
          (r.cheap !== r.fast ? ', or <b>' + r.cheap + '</b> to save on materials' : '') + '. ' + r.next +
          ' Badges on projects in progress flag the steps that fail often.');
      },
    },

    bootlegging: {
      render() {
        const sold = {}, stock = {};
        for (const el of document.querySelectorAll('.crime-root [aria-label]')) {
          const label = el.getAttribute('aria-label');
          let m = /^(.+?) DVDs sold:\s*([\d,]+)/.exec(label);
          if (m) { sold[m[1]] = +m[2].replace(/,/g, ''); continue; }
          m = /^(.+?) - ([\d,]+) in stock/.exec(label);
          if (m) stock[m[1]] = +m[2].replace(/,/g, '');
        }
        if (!Object.keys(sold).length && !Object.keys(stock).length) { setBar('bootlegging', 'Could not read your DVD counts.'); return; }
        const plan = Logic.bootlegPlan(sold, stock);
        const parts = ['Copy next: <b>' + plan.copyNext + '</b>' + (plan.allEmpty ? ' (nothing in stock)' : ' (it runs out first at normal sales rates)') + '.',
          'Sales run roughly Action 10, Fantasy 7, Comedy 7, Drama 5.5, Thriller 4, Horror 3, Romance 3, Sci-Fi 2, and a mixed stock sells more per attempt.'];
        if (Object.keys(sold).length) {
          parts.push(plan.honourDone ? 'Cinephile honour: every genre has passed 10,000 sales.'
            : 'Cinephile honour (10,000 of each genre), still to sell: ' + plan.short.map(x => '<b>' + x.genre + '</b> ' + num(x.left)).join(', ') + '.');
        }
        setBar('bootlegging', parts.join(' '));
      },
    },

    graffiti: {
      render() {
        const G = RULES.graffiti;
        let short = 0;
        for (const row of rows()) {
          const titleEl = q(row, 'flexGrow');
          const d = G.districts[ownText(titleEl)];
          if (!d) continue;
          const tags = parseInt((q(row, 'tagsCount')?.textContent || '').replace(/,/g, ''), 10);
          const left = isNaN(tags) ? 0 : Math.max(0, G.maxTags - tags);
          if (left) short++;
          // Float a short badge in the gap; clipping a wrapped line is the bug we are fixing.
          titleEl.style.position = 'relative';
          let badge = titleEl.querySelector('.cca-graffiti');
          if (!badge) { badge = document.createElement('span'); badge.className = 'cca-graffiti'; titleEl.appendChild(badge); }
          const level = left ? 'ok' : 'good';
          const cls = 'cca-graffiti cca-' + level;
          if (badge.className !== cls) badge.className = cls;
          const text = 'Cash ' + d.cash + ' · Rep ' + d.rep;
          if (badge.textContent !== text) badge.textContent = text;
          const tip = text + (left ? ' · ' + left + ' tags to 5 stars' : ' · at 5 stars') + '. Colour data is from small samples; the paint mask matters more for cash.';
          if (badge.title !== tip) badge.title = tip;
        }
        setBar('graffiti', 'Each district shows the spray colour the guide found best for cash and for reputation. ' +
          (short ? '<b>' + short + '</b> district' + (short > 1 ? 's are' : ' is') + ' below 500 tags (5 stars). ' : 'Every district is at 5 stars. ') +
          'The city cleans tags over time, fastest in the districts lower down the list. Hover a badge for tags remaining.');
      },
    },

    arson: {
      selected: null,   // "Location|Scenario" of the job whose detail is pinned in the bar

      // Read a burning job's fire state. Returns null if the job is not alight.
      readFire(row, req) {
        const fm = row.querySelector('[class*="fireMeter"]');
        const label = fm ? (fm.getAttribute('aria-label') || '') : '';
        if (!fm || /\boff\b/i.test(label)) return null;
        const intensity = (/(yellow|orange|red)/i.exec(label) || [, ''])[1].toLowerCase();
        if (!intensity) return null;
        const flameCls = [...(row.querySelector('[class*="flame"]')?.classList || [])].join(' ');
        const mo = /momentum(\d+)/.exec(flameCls);
        const areas = parseInt((/slots(\d+)/.exec(fm.className) || [, '1'])[1], 10) || 1;
        const rs = row.querySelector('[class*="responderStatus"]')?.getAttribute('aria-label') || '';
        const rm = /speed (\d+) of 5/i.exec(rs);
        const damage = parseInt((row.querySelector('[class*="percentInFront"]')?.textContent || '0').replace(/[^\d]/g, ''), 10) || 0;
        return {
          intensity, rising: /rising/i.test(label), falling: /falling/i.test(label),
          momentum: mo ? +mo[1] : 0, areas,
          responder: rm ? +rm[1] : 0, arrived: /arriv/i.test(rs),
          damage, max: req ? req.max : null, total: req ? req.total : false,
        };
      },

      render() {
        let jobs = 0, hard = 0, unpreserved = 0, pinned = null, burning = null;
        for (const row of rows()) {
          const head = q(row, 'titleAndScenario');
          if (!head) continue;
          jobs++;
          const scenarioEl = q(head, 'scenario');
          const name = [...head.childNodes].filter(n => n !== scenarioEl && !(n.classList && n.classList.contains('cca-badge')))
            .map(n => n.textContent).join('').trim();
          const scenario = (scenarioEl?.textContent || '').trim();
          const areas = parseInt(row.querySelector('[class*="fireMeter"]')?.getAttribute('aria-label') || '1', 10) || 1;
          const reqs = [...row.querySelectorAll('[class*="requestIcon"][aria-label]')].map(e => e.getAttribute('aria-label'));
          const job = Logic.arsonJob(name, areas, reqs);

          const fire = this.readFire(row, job.req);
          if (fire) {
            const coach = Logic.arsonFire(fire);
            if (!burning) burning = { name, scenario, fire, coach };
            setBadge(row, q(row, 'titleSection') || head, coach.red || coach.warnings.length ? (coach.safeToStoke ? 'ok' : 'bad') : 'good',
              'Burning · ' + fire.damage + '% · ' + coach.verdict, coach.warnings.join('\n') || 'No warnings.');
            continue;
          }

          if (job.level === 'bad') hard++;
          const button = row.querySelector('[class*="commitButtonSection"] button');
          if (/^Inquire/i.test(button?.getAttribute('aria-label') || button?.textContent || '')) unpreserved++;
          setBadge(row, q(row, 'titleSection') || head, job.level, job.label, job.tip);
          const badge = row.querySelector('.cca-badge');
          if (badge && badge.dataset.key !== name + '|' + scenario) badge.dataset.key = name + '|' + scenario;
          if (this.selected === name + '|' + scenario) pinned = { name, scenario, job };
        }
        if (!jobs) { setBar('arson', 'No arson jobs listed.'); return; }

        if (burning) {
          const f = burning.fire, c = burning.coach;
          const resp = f.arrived ? 'responders on scene' : 'responders ' + f.responder + ' of 5';
          const head = '<b>' + burning.name + '</b> burning: ' + f.damage + '% damage, ' + f.intensity +
            (f.falling ? ' falling' : f.rising ? ' rising' : '') + ', momentum ' + f.momentum + ', ' + resp + '.';
          const body = c.warnings.length ? '<br>' + c.warnings.map(w => '• ' + w).join('<br>')
            : '<br>Safe to stoke or dampen now.';
          setBar('arson', head + body);
          return;
        }
        if (pinned) {
          setBar('arson', '<b>' + pinned.name + '</b> (' + pinned.scenario + ')<br>' +
            pinned.job.detail.map(d => '• ' + d).join('<br>') + '<br><i>Click the badge again to close.</i>');
          return;
        }
        const parts = ['<b>' + jobs + '</b> arson jobs. Each badge says how hard the job is: <b>Easy</b>, <b>Partial</b>, <b>Tight</b>, <b>Careful</b> or <b>Hard</b>. ' +
          '<b>Click a badge</b> for the full explanation and what to place.'];
        if (hard) parts.push('<b>' + hard + '</b> will most likely fail without Thermite or Magnesium.');
        if (unpreserved) parts.push('<b>' + unpreserved + '</b> still show Inquire: pressing it costs no nerve and stops the job vanishing at midnight.');
        setBar('arson', parts.join(' '));
      },
    },

    burglary: {
      render() {
        let ready = 0, total = 0;
        for (const row of rows()) {
          const meter = row.querySelector('[aria-label^="Confidence"]');
          if (!meter) continue;   // the Scout row
          total++;
          const titleEl = q(row, 'flexGrow');
          // Read the name from the first text node, so our own badge never pollutes it
          const title = ([...titleEl.childNodes].find(n => n.nodeType === 3 && n.textContent.trim())?.textContent || titleEl.textContent).trim();
          const confidence = parseInt((meter.getAttribute('aria-label').match(/\d+/) || ['0'])[0], 10);
          const status = (row.querySelector('[aria-label^="Status"]')?.getAttribute('aria-label') || '').replace(/^Status:\s*/, '');
          const advice = Logic.burglaryAdvice(confidence, status, Logic.burglaryTarget(title));
          if (advice.level === 'good') ready++;
          setBadge(row, titleEl, advice.level, advice.text);
        }
        setBar('burglary', total
          ? '<b>' + ready + '</b> of ' + total + ' targets ready to burgle. Case to about <b>50%</b> confidence: more casing adds little. Targets expire 72 hours after the last action.'
          : 'No scouted targets. Residential is the cheapest route to skill until 80, then Industrial.');
      },
    },
  };

  // Clicking an Arson badge pins that job's explanation in the hint bar. Capture phase, so the
  // game's own row handlers never see the click.
  document.addEventListener('click', e => {
    const badge = e.target.closest && e.target.closest('.cca-badge[data-key]');
    if (!badge) return;
    e.preventDefault(); e.stopPropagation();
    const A = MODULES.arson;
    A.selected = A.selected === badge.dataset.key ? null : badge.dataset.key;
    tick();
    if (A.selected) document.getElementById('cca-bar')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, true);

  /* =====================================================================
   * 5. ROUTER
   * ===================================================================== */

  function currentCrime() {
    const root = document.querySelector('.crime-root');
    if (!root) return null;
    const cls = [...root.classList].find(c => c.endsWith('-root') && c !== 'crime-root');
    return cls ? cls.replace(/-root$/, '') : null;
  }

  let lastCrime = null, timer = null;
  function tick() {
    const crime = currentCrime();
    if (crime !== lastCrime) { cleanup(); lastCrime = crime; MODULES.arson.selected = null; }
    const mod = crime && MODULES[crime];
    if (!mod || !isOn(crime)) return;
    try { mod.render(); } catch (e) { console.warn('[CCA]', crime, e); }
  }

  // Torn's sidebar timers mutate the page every second, so react only to changes inside
  // the crimes app, and ignore the ones this script makes itself.
  const relevant = m => {
    const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
    if (!el || !el.closest('.crimes-app') || el.closest('#cca-bar, .cca-badge')) return false;
    // Class changes matter only on the scam pip and bar zones (the pip moves by class).
    if (m.type === 'attributes') return el.matches('[class*="pipPosition"], [class*="zone"], [class*="linesAnimation"], [class*="rippleContainer"]');
    return true;
  };
  new MutationObserver(muts => {
    if (!muts.some(relevant)) return;
    clearTimeout(timer);
    timer = setTimeout(tick, 150);
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  tick();

  // Console helper: CCA.reset() turns every module back on.
  window.CCA = {
    RULES, Logic,
    reset() { settings.enabled = {}; saveSettings(); tick(); },
    // CCA.scam() prints what the advisor reads from each scam target, for checking against the page.
    scam() { return rows().map(r => MODULES.scamming.readTarget(r)).filter(Boolean).map(t => ({ email: t.email, scam: t.scam, mark: t.mark, pip: t.pos, stacks: t.stacks, bar: t.cells.map(c => c[0]).join('') })); },
  };
})();
