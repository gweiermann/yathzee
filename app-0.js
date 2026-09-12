const STORAGE_KEY = 'kniffel-mobile-v1';
const CATEGORIES = [
  ['ones', 'Einser', '1er'], ['twos', 'Zweier', '2er'], ['threes', 'Dreier', '3er'],
  ['fours', 'Vierer', '4er'], ['fives', 'Fünfer', '5er'], ['sixes', 'Sechser', '6er'],
  ['threeKind', 'Dreierpasch', '3er-Pasch'], ['fourKind', 'Viererpasch', '4er-Pasch'],
  ['fullHouse', 'Full House', 'Full House'], ['smallStraight', 'Kleine Straße', 'Kl. Straße'],
  ['largeStraight', 'Große Straße', 'Gr. Straße'], ['kniffel', 'Kniffel', 'Kniffel'], ['chance', 'Chance', 'Chance']
];
const UPPER = [
  ['ones', '1er', 1], ['twos', '2er', 2], ['threes', '3er', 3],
  ['fours', '4er', 4], ['fives', '5er', 5], ['sixes', '6er', 6]
];
const LOWER = [
  ['threeKind', '3er P.'], ['fourKind', '4er P.'], ['fullHouse', 'FH'],
  ['smallStraight', 'Kl. Str.'], ['largeStraight', 'Gr. Str.'], ['kniffel', 'Kniffel'], ['chance', 'Chance']
];

const icon = (name, size = 20) => {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
    chevron: '<path d="M6 15l6-6 6 6"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

const emptyScores = () => Object.fromEntries(CATEGORIES.map(([key]) => [key, null]));
const freshDice = () => Array.from({ length: 5 }, () => ({ value: 1, locked: false }));
const freshState = () => ({ version: 1, phase: 'setup', players: [], currentPlayer: 0, dice: freshDice(), rolls: 0 });

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.players)) return freshState();
    parsed.players = parsed.players.map(player => ({
      ...player,
      scores: { ...emptyScores(), ...(player.scores || {}) },
      lastSubmitted: player.lastSubmitted ?? null
    }));
    return parsed;
  } catch { return freshState(); }
}

let state = loadState();
let rolling = false;
let drawerOpen = false;
let drawerMode = 'view';
let pendingConfirm = null;
let endDrawerOpen = false;
let rollTimer = null;
let transitionTimer = null;
let revealTimers = [];
let revealStage = 0;
let revealTicker = 0;

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const esc = (v) => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function scoreDice(category, dice) {
  const counts = Array(7).fill(0);
  dice.forEach(d => counts[d]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  const uniques = [...new Set(dice)].sort((a, b) => a - b);
  const hasRun = length => {
    for (let start = 1; start <= 7 - length; start++) {
      if (Array.from({ length }, (_, i) => start + i).every(n => uniques.includes(n))) return true;
    }
    return false;
  };
  const map = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
  if (map[category]) return counts[map[category]] * map[category];
  if (category === 'threeKind') return counts.some(c => c >= 3) ? sum : 0;
  if (category === 'fourKind') return counts.some(c => c >= 4) ? sum : 0;
  if (category === 'fullHouse') return counts.includes(3) && counts.includes(2) ? 25 : 0;
  if (category === 'smallStraight') return hasRun(4) ? 30 : 0;
  if (category === 'largeStraight') return hasRun(5) ? 40 : 0;
  if (category === 'kniffel') return counts.includes(5) ? 50 : 0;
  return sum;
}

function upperDelta(scores) {
  return UPPER.reduce((d, [key,, value]) => scores[key] === null ? d : d + scores[key] - value * 3, 0);
}
function upperSubtotal(scores) { return UPPER.reduce((sum, [key]) => sum + (scores[key] ?? 0), 0); }
function bonusFor(scores) { return upperSubtotal(scores) >= 63 ? 35 : 0; }
function lowerSubtotal(scores) {
  return CATEGORIES.filter(([key]) => !UPPER.some(([u]) => u === key)).reduce((sum, [key]) => sum + (scores[key] ?? 0), 0);
}
function totalFor(scores) {
  return upperSubtotal(scores) + bonusFor(scores) + lowerSubtotal(scores);
}
function allFilled(scores) { return CATEGORIES.every(([key]) => scores[key] !== null); }

function dieHtml(die, idx, mini = false) {
  const pipPositions = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
  const pips = Array.from({length: 9}, (_, i) => `<span class="pip ${pipPositions[die.value].includes(i+1) ? 'shown' : ''}"></span>`).join('');
  return `<button type="button" class="die ${die.locked ? 'locked' : ''} ${rolling && !die.locked ? 'rolling' : ''}" data-die="${idx}" aria-label="${die.value} ${die.locked ? 'gesperrt' : 'frei'}" ${rolling || mini ? 'disabled' : ''}><span class="pip-grid" aria-hidden="true">${pips}</span>${die.locked && !mini ? `<span class="lock-badge">${icon('lock', 12)}</span>` : ''}</button>`;
}

const TABLE_LABELS = {
  ones: '1er', twos: '2er', threes: '3er', fours: '4er', fives: '5er', sixes: '6er',
  threeKind: '3er-P.', fourKind: '4er-P.', fullHouse: 'FH',
  smallStraight: 'Kl. Str.', largeStraight: 'Gr. Str.', kniffel: 'Kniffel', chance: 'Chance'
};

function uniquePlayerLabels() {
  const names = state.players.map(player => player.name.trim() || '?');
  const normalized = names.map(name => name.toLocaleLowerCase('de'));
  return names.map((name, index) => {
    const chars = Array.from(name);
    let short = name;
    for (let length = 1; length <= chars.length; length++) {
      const prefix = chars.slice(0, length).join('');
      const normalizedPrefix = prefix.toLocaleLowerCase('de');
      if (normalized.every((other, otherIndex) => otherIndex === index || !other.startsWith(normalizedPrefix))) {
        short = prefix;
        break;
      }
    }
    const duplicates = normalized.map((other, otherIndex) => other === normalized[index] ? otherIndex : -1).filter(otherIndex => otherIndex >= 0);
    if (duplicates.length > 1) short = `${chars[0] || '?'}${duplicates.indexOf(index) + 1}`;
    return short;
  });
}

function compactStatusHtml(scores) {
  const delta = upperDelta(scores);
  const scoreChip = ([key, label]) => {
    const isSet = scores[key] !== null;
    const canSubmit = state.rolls > 0 && !rolling && !isSet;
    return `<button type="button" class="status-chip ${isSet ? 'set' : 'open'}" ${canSubmit ? `data-quick-score="${key}"` : 'disabled'} aria-label="${esc(label)}${canSubmit ? ' eintragen' : isSet ? ' bereits eingetragen' : ''}">${label}</button>`;
  };
  return `<section class="status-card" aria-label="Kniffel-Zettel Status">
    <div class="status-row upper-status-row">
      ${UPPER.map(scoreChip).join('')}
      <div class="status-chip delta-chip" aria-label="Abweichung im oberen Block">${delta > 0 ? '+' : ''}${delta}</div>
    </div>
    <div class="status-row lower-status-row">
      ${LOWER.map(scoreChip).join('')}
    </div>
  </section>`;
}

