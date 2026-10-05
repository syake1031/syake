'use strict';

const STORAGE_KEY = 'voice-script:v1';
const NARRATOR = 'ナレーション';
const MAX_CHUNK = 120;   // 1 回の発話の最大文字数（長文で途切れるのを防ぐ）
const PITCH_VARIANTS = [1, 1.3, 0.8, 1.15, 0.9, 1.45];

const SAMPLE = `# サンプル台本：「#」で始まる行は読み上げません
ナレーター：とある町の、小さな喫茶店。
店長：いらっしゃいませ。今日は何にしますか？
お客さん：えーと、おすすめのコーヒーをください。
[間 1]
店長：かしこまりました。少々お待ちください。
（店長、コーヒーを淹れる）
ナレーター：こうして、静かな午後が過ぎていった。`;

const engine = ENGINES[0];

// ---- 状態 ----
let state = {
  scripts: [],          // { id, title, text }
  currentId: null,
  speakers: {},         // 話者名 -> { voiceId, rate, pitch }
  volume: 1,
  gap: 0.3,             // 行と行の間（秒）
  readDirections: false,
};

const player = {
  playing: false,
  index: -1,            // 現在の行（parse 結果のインデックス）
  run: 0,               // 再生のたびに増やし、古い再生ループを止める
};

let lines = [];         // 現在の台本の parse 結果

// ---- 永続化 ----
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('保存データの読み込みに失敗しました', e);
  }
  if (!state.scripts.length) {
    const s = { id: newId(), title: 'サンプル：喫茶店', text: SAMPLE };
    state.scripts.push(s);
    state.currentId = s.id;
  }
  if (!currentScript()) state.currentId = state.scripts[0].id;
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

function currentScript() {
  return state.scripts.find(s => s.id === state.currentId);
}

// ---- 台本の解析 ----
// 戻り値: { src: 元の行番号, type: 'speech' | 'pause' | 'direction', speaker, text, seconds }
function parse(text) {
  const result = [];
  text.split('\n').forEach((raw, src) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    const pause = line.match(/^\[(?:間|pause)\s*([\d.]*)\s*(?:秒|s)?\]$/i);
    if (pause) {
      result.push({ src, type: 'pause', seconds: parseFloat(pause[1]) || 1 });
      return;
    }
    if (/^[（(].*[）)]$/.test(line)) {
      result.push({ src, type: 'direction', speaker: NARRATOR, text: line.slice(1, -1).trim() });
      return;
    }
    const m = line.match(/^([^:：\s]{1,20})\s*[:：]\s*(.+)$/);
    if (m) result.push({ src, type: 'speech', speaker: m[1], text: m[2] });
    else result.push({ src, type: 'speech', speaker: NARRATOR, text: line });
  });
  return result;
}

// 句点などで区切り、MAX_CHUNK 以下のかたまりにまとめる
function chunks(text) {
  const parts = text.match(/[^。！？!?]+[。！？!?」』）)]*|[。！？!?]+/g) || [text];
  const out = [];
  let buf = '';
  for (const p of parts) {
    if (buf && (buf + p).length > MAX_CHUNK) { out.push(buf); buf = ''; }
    buf += p;
    while (buf.length > MAX_CHUNK) { out.push(buf.slice(0, MAX_CHUNK)); buf = buf.slice(MAX_CHUNK); }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function isReadable(l) {
  return l.type === 'speech' || (l.type === 'direction' && state.readDirections);
}

function speakersInScript() {
  const names = [];
  for (const l of lines) {
    if (l.type === 'pause' || !isReadable(l)) continue;
    if (!names.includes(l.speaker)) names.push(l.speaker);
  }
  return names;
}

// ---- 声の割り当て ----
function japaneseVoices() {
  const all = engine.listVoices();
  const ja = all.filter(v => v.lang.toLowerCase().startsWith('ja'));
  return ja.length ? ja : all;
}

// 未設定の話者に、なるべく別々の声を割り当てる
function ensureSpeaker(name) {
  const voices = japaneseVoices();
  let s = state.speakers[name];
  if (!s) {
    const i = Object.keys(state.speakers).length;
    // 声が足りず同じ声を使い回すときは、高さを変えて聞き分けられるようにする
    const round = Math.floor(i / Math.max(1, voices.length));
    s = state.speakers[name] = { voiceId: '', rate: 1, pitch: PITCH_VARIANTS[round % PITCH_VARIANTS.length], slot: i };
  }
  if (!voices.some(v => v.id === s.voiceId) && voices.length) {
    s.voiceId = voices[(s.slot || 0) % voices.length].id;
  }
  return s;
}

function speechOptions(name) {
  const s = ensureSpeaker(name);
  return { voiceId: s.voiceId, rate: s.rate, pitch: s.pitch, volume: state.volume };
}

// ---- 再生 ----
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function play(from = 0) {
  const run = ++player.run;
  engine.stop();
  player.playing = true;
  renderPlayer();

  try {
    for (let i = Math.max(0, from); i < lines.length; i++) {
      if (run !== player.run) return;
      const l = lines[i];
      if (l.type !== 'pause' && !isReadable(l)) continue;
      player.index = i;
      renderPlayer();

      if (l.type === 'pause') {
        await wait(l.seconds * 1000);
      } else {
        for (const c of chunks(l.text)) {
          if (run !== player.run) return;
          await engine.speak(c, speechOptions(l.speaker));
        }
      }
      if (run !== player.run) return;
      if (state.gap > 0) await wait(state.gap * 1000);
    }
    if (run === player.run) stop();
  } catch (e) {
    if (run !== player.run) return;
    stop();
    showMessage(`読み上げに失敗しました（${e.message}）`);
  }
}

function pause() {
  player.run++;
  player.playing = false;
  engine.stop();
  renderPlayer();
}

function stop() {
  player.run++;
  player.playing = false;
  player.index = -1;
  engine.stop();
  renderPlayer();
}

function step(delta) {
  const readable = lines.map((l, i) => i).filter(i => lines[i].type !== 'pause' && isReadable(lines[i]));
  if (!readable.length) return;
  const pos = readable.indexOf(player.index);
  const next = pos < 0 ? (delta > 0 ? readable[0] : readable[readable.length - 1])
    : readable[Math.min(readable.length - 1, Math.max(0, pos + delta))];
  if (player.playing) play(next);
  else { player.index = next; renderPlayer(); }
}

function playFromCursor() {
  const ta = $('#script');
  const row = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
  const i = lines.findIndex(l => l.src >= row);
  if (i >= 0) play(i);
}

async function preview(name) {
  stop();
  try {
    await engine.speak(`${name}です。よろしくお願いします。`, speechOptions(name));
  } catch (e) {
    showMessage(`試聴に失敗しました（${e.message}）`);
  }
}

// ---- 描画 ----
const $ = sel => document.querySelector(sel);

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

function colorIndex(name) {
  const i = speakersInScript().indexOf(name);
  return i < 0 ? 0 : i % 6;
}

function showMessage(text) {
  $('#progress-text').textContent = text;
}

function renderScripts() {
  const sel = $('#script-select');
  sel.replaceChildren(...state.scripts.map(s =>
    el('option', { value: s.id, textContent: s.title || '無題の台本', selected: s.id === state.currentId })));
  const s = currentScript();
  $('#title').value = s.title;
  $('#script').value = s.text;
}

function renderLines() {
  const list = $('#lines');
  list.replaceChildren(...lines.map((l, i) => {
    const li = el('li', { className: `line ${l.type}` });
    li.dataset.index = i;
    if (l.type === 'pause') {
      li.append(el('span', { className: 'pause-label', textContent: `間 ${l.seconds} 秒` }));
    } else {
      if (l.type === 'speech') {
        li.append(el('span', { className: `who c${colorIndex(l.speaker)}`, textContent: l.speaker }));
      }
      li.append(el('span', { className: 'text', textContent: l.type === 'direction' ? `（${l.text}）` : l.text }));
    }
    return li;
  }));
  $('#lines-empty').hidden = lines.length > 0;
  renderPlayer();
}

function renderSpeakers() {
  const voices = japaneseVoices();
  $('#voice-count').textContent = `声 ${voices.length} 種`;
  const names = speakersInScript();

  $('#speaker-list').replaceChildren(...names.map(name => {
    const s = ensureSpeaker(name);
    const voiceSel = el('select', { ariaLabel: `${name} の声` },
      ...voices.map(v => el('option', {
        value: v.id, textContent: `${v.name}${v.local ? '' : '（オンライン）'}`, selected: v.id === s.voiceId,
      })));
    if (!voices.length) voiceSel.append(el('option', { value: '', textContent: '既定の声' }));
    voiceSel.addEventListener('change', () => { s.voiceId = voiceSel.value; save(); });

    const slider = (label, key, min, max) => {
      const out = el('span', { className: 'muted', textContent: s[key].toFixed(2) });
      const input = el('input', { type: 'range', min, max, step: 0.05, value: s[key] });
      input.addEventListener('input', () => {
        s[key] = parseFloat(input.value);
        out.textContent = s[key].toFixed(2);
        save();
      });
      return el('label', { className: 'slider' }, label, input, out);
    };

    const test = el('button', { type: 'button', className: 'btn small', textContent: '試聴' });
    test.addEventListener('click', () => preview(name));

    return el('li', { className: 'speaker' },
      el('div', { className: 'speaker-head' },
        el('span', { className: `who c${colorIndex(name)}`, textContent: name }), test),
      voiceSel,
      slider('速さ', 'rate', 0.5, 2),
      slider('高さ', 'pitch', 0, 2));
  }));
  save();
}

function renderPlayer() {
  document.body.classList.toggle('playing', player.playing);
  $('#play').title = player.playing ? '一時停止' : '再生';
  $('#play').setAttribute('aria-label', $('#play').title);

  const readable = lines.filter(isReadable).length;
  const done = player.index < 0 ? 0 : lines.slice(0, player.index + 1).filter(isReadable).length;
  $('#progress-fill').style.width = readable ? `${(done / readable) * 100}%` : '0';
  $('#progress-text').textContent = `${done} / ${readable} 行`;

  for (const li of $('#lines').children) {
    const i = Number(li.dataset.index);
    li.classList.toggle('current', i === player.index);
    li.classList.toggle('skipped', !isReadable(lines[i]) && lines[i].type !== 'pause');
  }
  const cur = $('#lines .current');
  if (cur && player.playing) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function refresh() {
  lines = parse(currentScript().text);
  renderLines();
  renderSpeakers();
}

// ---- 台本の管理 ----
function selectScript(id) {
  stop();
  state.currentId = id;
  save();
  renderScripts();
  refresh();
}

function addScript(title, text) {
  const s = { id: newId(), title, text };
  state.scripts.push(s);
  selectScript(s.id);
}

function deleteScript() {
  const s = currentScript();
  if (!confirm(`「${s.title || '無題の台本'}」を削除しますか？`)) return;
  state.scripts = state.scripts.filter(x => x.id !== s.id);
  if (!state.scripts.length) state.scripts.push({ id: newId(), title: '新しい台本', text: '' });
  selectScript(state.scripts[0].id);
}

function exportScript() {
  const s = currentScript();
  const blob = new Blob([s.text], { type: 'text/plain;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${s.title || '台本'}.txt` });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---- イベント ----
function bind() {
  $('#script-select').addEventListener('change', e => selectScript(e.target.value));
  $('#new-script').addEventListener('click', () => addScript('新しい台本', ''));
  $('#delete-script').addEventListener('click', deleteScript);
  $('#export').addEventListener('click', exportScript);

  $('#file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    addScript(file.name.replace(/\.[^.]+$/, ''), await file.text());
    e.target.value = '';
  });

  $('#title').addEventListener('input', e => {
    currentScript().title = e.target.value;
    save();
    $('#script-select').selectedOptions[0].textContent = e.target.value || '無題の台本';
  });

  // 編集すると行番号がずれるので、再生中なら止める
  $('#script').addEventListener('input', e => {
    if (player.playing) stop();
    player.index = -1;
    currentScript().text = e.target.value;
    save();
    refresh();
  });

  $('#play').addEventListener('click', () => {
    if (player.playing) pause();
    else play(player.index < 0 ? 0 : player.index);
  });
  $('#stop').addEventListener('click', stop);
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  $('#play-cursor').addEventListener('click', playFromCursor);

  $('#lines').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (li) play(Number(li.dataset.index));
  });

  $('#volume').value = state.volume;
  $('#volume').addEventListener('input', e => { state.volume = parseFloat(e.target.value); save(); });

  const gapValue = () => { $('#gap-value').textContent = `${state.gap.toFixed(1)} 秒`; };
  $('#gap').value = state.gap;
  gapValue();
  $('#gap').addEventListener('input', e => { state.gap = parseFloat(e.target.value); gapValue(); save(); });

  $('#read-directions').checked = state.readDirections;
  $('#read-directions').addEventListener('change', e => {
    state.readDirections = e.target.checked;
    save();
    renderLines();
    renderSpeakers();
  });
}

// ---- 起動 ----
load();
if (!engine.isSupported()) {
  $('#unsupported').hidden = false;
  document.body.classList.add('unsupported');
}
engine.init(renderSpeakers);
bind();
renderScripts();
refresh();
