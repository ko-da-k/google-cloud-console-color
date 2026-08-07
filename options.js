'use strict';

const DEFAULTS = { rules: [], autoTextColor: true };

const MATCH_TYPES = [
  ['exact', '完全一致'],
  ['prefix', '前方一致'],
  ['suffix', '後方一致'],
];

const PALETTE = ['#c5221f', '#e8710a', '#f9ab00', '#1e8e3e', '#1a73e8', '#9334e6'];

const tbody = document.getElementById('rules');
const emptyMessage = document.getElementById('empty');
const autoTextColor = document.getElementById('auto-text-color');
const saveStatus = document.getElementById('status');

// 画面の唯一の状態。DOM から読み戻さずに、ここを更新して render() し直す。
let rules = [];

function createRow(rule, index) {
  const tr = document.createElement('tr');

  const patternCell = tr.insertCell();
  const pattern = document.createElement('input');
  pattern.type = 'text';
  pattern.value = rule.pattern;
  pattern.placeholder = 'my-project-prod';
  pattern.addEventListener('input', () => {
    rules[index].pattern = pattern.value;
  });
  patternCell.appendChild(pattern);

  const matchCell = tr.insertCell();
  const match = document.createElement('select');
  for (const [value, label] of MATCH_TYPES) {
    match.add(new Option(label, value, false, value === rule.matchType));
  }
  match.addEventListener('change', () => {
    rules[index].matchType = match.value;
  });
  matchCell.appendChild(match);

  const colorCell = tr.insertCell();
  const color = document.createElement('input');
  color.type = 'color';
  color.value = rule.color;
  color.addEventListener('input', () => {
    rules[index].color = color.value;
  });
  colorCell.appendChild(color);

  const removeCell = tr.insertCell();
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.textContent = '✕';
  remove.title = 'この行を削除';
  remove.addEventListener('click', () => {
    rules.splice(index, 1);
    render();
  });
  removeCell.appendChild(remove);

  return tr;
}

function render() {
  tbody.replaceChildren(...rules.map(createRow));
  emptyMessage.hidden = rules.length > 0;
}

function save() {
  // 空パターンの行は保存時に落とす(照合できないため)。
  const cleaned = rules.filter((rule) => rule.pattern.trim() !== '');
  cleaned.forEach((rule) => {
    rule.pattern = rule.pattern.trim();
  });

  chrome.storage.sync.set({ rules: cleaned, autoTextColor: autoTextColor.checked }, () => {
    rules = cleaned;
    render();

    saveStatus.classList.add('shown');
    setTimeout(() => saveStatus.classList.remove('shown'), 1500);
  });
}

document.getElementById('add').addEventListener('click', () => {
  rules.push({
    pattern: '',
    matchType: 'exact',
    color: PALETTE[rules.length % PALETTE.length],
  });
  render();

  // 追加した行にすぐ入力できるようにする。
  tbody.lastElementChild.querySelector('input[type="text"]').focus();
});

document.getElementById('save').addEventListener('click', save);

chrome.storage.sync.get(DEFAULTS, (stored) => {
  rules = stored.rules.map((rule) => ({
    pattern: rule.pattern ?? '',
    matchType: rule.matchType ?? 'exact',
    color: rule.color ?? PALETTE[0],
  }));
  autoTextColor.checked = stored.autoTextColor;
  render();
});
