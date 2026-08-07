'use strict';

// Google Cloud Console のヘッダーを、表示中のプロジェクト ID に応じて着色する。
// Console は Angular 製の SPA なので、DOM に直接 style を書き込むと再描画で消える。
// そのため <style> タグに !important の CSS ルールを流し込む方式をとる。

const STYLE_ID = 'gccc-style';
const BAR_ID = 'gccc-bar';

// 実際の Console DOM で確認したヘッダー要素。
// #ocb-platform-bar が外枠(高さ 49px)、cfc-platform-bar がその中の Angular コンポーネント。
// いずれも既定では背景が透明なので、塗ればそのまま帯として見える。
// .ng-star-inserted のような Angular 生成クラスは不安定なので使わない。
const HEADER_SELECTORS = ['#ocb-platform-bar', 'cfc-platform-bar'];

const DEFAULTS = { rules: [], autoTextColor: true };

let settings = DEFAULTS;
let lastUrl = '';

/** 現在表示中のプロジェクト ID。特定できなければ null。 */
function getProjectId() {
  const url = new URL(location.href);

  const fromQuery = url.searchParams.get('project');
  if (fromQuery) return fromQuery;

  // /projects/<id>/... 形式のページ用フォールバック
  const fromPath = url.pathname.match(/\/projects\/([^/?#]+)/);
  return fromPath ? decodeURIComponent(fromPath[1]) : null;
}

function ruleMatches(rule, projectId) {
  if (!rule || !rule.pattern) return false;

  switch (rule.matchType) {
    case 'prefix':
      return projectId.startsWith(rule.pattern);
    case 'suffix':
      return projectId.endsWith(rule.pattern);
    case 'exact':
    default:
      return projectId === rule.pattern;
  }
}

// 設定値をそのまま CSS に埋め込むと文字列を閉じて任意のルールを注入できてしまうため、
// #rrggbb 形式であることを検証してから使う。
function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

/** 背景が暗いか。ITU-R BT.601 の輝度で判定する。 */
function isDark(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    // Angular の管理外である <html> 直下に置くことで、再描画で消されないようにする。
    document.documentElement.appendChild(style);
  }
  return style;
}

// ヘッダーのセレクタが Console 側の変更で効かなくなっても最低限色が分かるように、
// 画面最上部に独自の帯を重ねる。こちらは自前の要素なので確実に描画される。
function ensureBar() {
  let bar = document.getElementById(BAR_ID);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'right: 0',
      'height: 4px',
      'z-index: 2147483647',
      'pointer-events: none',
    ].join(';');
    document.documentElement.appendChild(bar);
  }
  return bar;
}

function paint(color) {
  const cssRules = [`${HEADER_SELECTORS.join(', ')} { background-color: ${color} !important; }`];

  if (settings.autoTextColor) {
    // 濃い色を選んだときにヘッダーの文字とアイコンが読めなくなるのを防ぐ。
    // 検索ボックスなどの入力欄は Console 側の配色に任せる。
    const fg = isDark(color) ? '#ffffff' : '#202124';
    cssRules.push(
      `#ocb-platform-bar, #ocb-platform-bar :not(input):not(textarea):not(select) { color: ${fg} !important; }`
    );
  }

  ensureStyle().textContent = cssRules.join('\n');
  ensureBar().style.backgroundColor = color;
}

function clear() {
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(BAR_ID)?.remove();
}

function refresh() {
  lastUrl = location.href;

  const projectId = getProjectId();
  const rule = projectId ? settings.rules.find((r) => ruleMatches(r, projectId)) : null;
  const color = rule ? normalizeColor(rule.color) : null;

  // プロジェクトが特定できないページ(プロジェクト選択画面など)や
  // どのルールにも一致しない場合は、前のプロジェクトの色を残さず消す。
  if (color) {
    paint(color);
  } else {
    clear();
  }
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  settings = { ...DEFAULTS, ...stored };
  refresh();
});

// 設定画面での変更を、Console のリロードなしに反映する。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  for (const [key, change] of Object.entries(changes)) {
    // キーが削除された場合 newValue は undefined になり、refresh() が落ちる。
    settings[key] = change.newValue ?? DEFAULTS[key];
  }
  refresh();
});

// SPA なのでページ遷移なしに project が変わる。href の変化を監視して塗り直す。
setInterval(() => {
  if (location.href !== lastUrl) refresh();
}, 800);
