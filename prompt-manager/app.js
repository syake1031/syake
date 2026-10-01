'use strict';

const STORAGE_KEY = 'prompt-manager:v1';

// ---- 状態 ----
let state = {
  prompts: [],          // { id, text, enabled }
  presets: [],          // { id, name, text }
  separator: ', ',
};
let editingId = null;   // 編集中のプロンプトID

// ---- 永続化 ----
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('保存データの読み込みに失敗しました', e);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存に失敗しました', e);
  }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// カンマ（全角・読点含む）で分割して空要素を除く
function splitInput(text) {
  return text.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

function combined() {
  return state.prompts.filter(p => p.enabled).map(p => p.text).join(state.separator);
}

// ---- 操作（追加・更新・削除） ----
function addPrompts(text) {
  for (const t of splitInput(text)) {
    state.prompts.push({ id: newId(), text: t, enabled: true });
  }
  commit();
}

function updatePrompt(id, text) {
  const p = state.prompts.find(p => p.id === id);
  const t = text.trim();
  if (p && t) p.text = t;
  editingId = null;
  commit();
}

function deletePrompt(id) {
  state.prompts = state.prompts.filter(p => p.id !== id);
  if (editingId === id) editingId = null;
  commit();
}

function togglePrompt(id) {
  const p = state.prompts.find(p => p.id === id);
  if (p) p.enabled = !p.enabled;
  commit();
}

function movePrompt(id, delta) {
  const i = state.prompts.findIndex(p => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.prompts.length) return;
  [state.prompts[i], state.prompts[j]] = [state.prompts[j], state.prompts[i]];
  commit();
}

function savePreset(name) {
  const text = combined();
  if (!text) {
    alert('保存するプロンプトがありません。');
    return false;
  }
  const existing = state.presets.find(p => p.name === name);
  if (existing) {
    if (!confirm(`「${name}」を上書き更新しますか？`)) return false;
    existing.text = text;
  } else {
    state.presets.push({ id: newId(), name, text });
  }
  commit();
  return true;
}

function loadPreset(id) {
  const preset = state.presets.find(p => p.id === id);
  if (!preset) return;
  if (state.prompts.length && !confirm('現在のプロンプト一覧をこのセットで置き換えますか？')) return;
  state.prompts = splitInput(preset.text).map(t => ({ id: newId(), text: t, enabled: true }));
  editingId = null;
  commit();
}

function updatePreset(id) {
  const preset = state.presets.find(p => p.id === id);
  if (!preset) return;
  const text = combined();
  if (!text) {
    alert('保存するプロンプトがありません。');
    return;
  }
  if (!confirm(`「${preset.name}」を現在の結合結果で更新しますか？`)) return;
  preset.text = text;
  commit();
}

function renamePreset(id) {
  const preset = state.presets.find(p => p.id === id);
  if (!preset) return;
  const name = prompt('新しいセット名', preset.name);
  if (name && name.trim()) {
    preset.name = name.trim();
    commit();
  }
}

function deletePreset(id) {
  const preset = state.presets.find(p => p.id === id);
  if (!preset || !confirm(`「${preset.name}」を削除しますか？`)) return;
  state.presets = state.presets.filter(p => p.id !== id);
  commit();
}

function commit() {
  save();
  render();
}

// ---- 描画 ----
const $ = id => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function button(label, onClick, cls = 'btn small', extra = {}) {
  return el('button', { type: 'button', className: cls, textContent: label, onclick: onClick, ...extra });
}

function renderPromptItem(p, index) {
  const li = el('li', { className: 'prompt-item' + (p.enabled ? '' : ' disabled') });
  const checkbox = el('input', {
    type: 'checkbox',
    checked: p.enabled,
    title: '結合に含める',
    onchange: () => togglePrompt(p.id),
  });
  li.append(checkbox, el('span', { className: 'prompt-index', textContent: String(index + 1).padStart(2, '0') }));

  if (editingId === p.id) {
    const input = el('input', { type: 'text', value: p.text });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') updatePrompt(p.id, input.value);
      if (e.key === 'Escape') { editingId = null; render(); }
    });
    li.append(input, el('div', { className: 'item-actions' }, [
      button('更新', () => updatePrompt(p.id, input.value), 'btn small primary'),
      button('取消', () => { editingId = null; render(); }),
    ]));
    requestAnimationFrame(() => { input.focus(); input.select(); });
  } else {
    const text = el('span', { className: 'prompt-text', textContent: p.text, title: 'ダブルクリックで修正' });
    text.ondblclick = () => { editingId = p.id; render(); };
    li.append(text, el('div', { className: 'item-actions' }, [
      button('↑', () => movePrompt(p.id, -1), 'btn small', { title: '上へ', disabled: index === 0 }),
      button('↓', () => movePrompt(p.id, 1), 'btn small', { title: '下へ', disabled: index === state.prompts.length - 1 }),
      button('修正', () => { editingId = p.id; render(); }),
      button('削除', () => deletePrompt(p.id), 'btn small danger'),
    ]));
  }
  return li;
}

function renderPresetItem(p) {
  return el('li', { className: 'preset-item' }, [
    el('div', { className: 'preset-head' }, [
      el('span', { className: 'preset-name', textContent: p.name }),
      el('div', { className: 'item-actions' }, [
        button('読込', () => loadPreset(p.id), 'btn small primary'),
        button('更新', () => updatePreset(p.id), 'btn small', { title: '現在の結合結果で上書き' }),
        button('名前変更', () => renamePreset(p.id)),
        button('削除', () => deletePreset(p.id), 'btn small danger'),
      ]),
    ]),
    el('div', { className: 'preset-text', textContent: p.text }),
  ]);
}

function render() {
  const list = $('prompt-list');
  list.replaceChildren(...state.prompts.map(renderPromptItem));
  $('empty').classList.toggle('hidden', state.prompts.length > 0);

  const enabledCount = state.prompts.filter(p => p.enabled).length;
  $('count').textContent = `${state.prompts.length} 件（選択中 ${enabledCount} 件）`;

  $('separator').value = state.separator;
  $('output').value = combined();

  $('preset-list').replaceChildren(...state.presets.map(renderPresetItem));
  $('preset-empty').classList.toggle('hidden', state.presets.length > 0);
}

// ---- イベント ----
function init() {
  load();

  $('add-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('add-input');
    addPrompts(input.value);
    input.value = '';
    input.focus();
  });

  $('check-all').onclick = () => { state.prompts.forEach(p => { p.enabled = true; }); commit(); };
  $('uncheck-all').onclick = () => { state.prompts.forEach(p => { p.enabled = false; }); commit(); };
  $('clear-all').onclick = () => {
    if (state.prompts.length && confirm('すべてのプロンプトを削除しますか？')) {
      state.prompts = [];
      editingId = null;
      commit();
    }
  };

  $('separator').onchange = e => { state.separator = e.target.value; commit(); };

  $('copy').onclick = async () => {
    const status = $('copy-status');
    const text = $('output').value;
    if (!text) { status.textContent = 'コピーする内容がありません'; return; }
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'コピーしました';
    } catch {
      $('output').select();
      document.execCommand('copy');
      status.textContent = 'コピーしました';
    }
    setTimeout(() => { status.textContent = ''; }, 2000);
  };

  $('preset-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('preset-name');
    const name = input.value.trim();
    if (name && savePreset(name)) input.value = '';
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
