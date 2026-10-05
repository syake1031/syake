'use strict';

// 音声エンジン
// どのエンジンも次の形を満たせば app.js から差し替えて使えます。
//   id, label
//   features: { pitch, caption }      … 声の高さ・声の説明（キャプション）に対応しているか
//   maxChunk                          … 1 回の発話に渡す最大文字数
//   isSupported()                     … このブラウザで使えるか
//   init(onChange)                    … 声一覧が変わったら onChange() を呼ぶ
//   listVoices()                      … [{ id, name, lang, local }]
//   speak(text, { voiceId, rate, pitch, caption, volume }) … 読み終わったら resolve する Promise
//   prefetch(text, options)           … （任意）先に音声を作っておく。生成が終わると resolve する
//   stop()                            … 読み上げを即座に止める

// 絵文字（Irodori-TTS の感情指定用）はブラウザ標準の音声では読ませない
function stripEmoji(text) {
  return text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');
}

const browserEngine = (() => {
  const synth = window.speechSynthesis;
  let voices = [];
  let current = null;     // 再生中の発話（GC で onend が消えないよう参照を保持）
  let keepAlive = null;

  function refresh() {
    voices = synth ? synth.getVoices() : [];
  }

  function clearKeepAlive() {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
  }

  return {
    id: 'browser',
    label: 'ブラウザ標準（無料）',
    features: { pitch: true, caption: false },
    maxChunk: 120,          // 長文で途切れるのを防ぐ

    isSupported() {
      return !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
    },

    init(onChange) {
      if (!synth) return;
      refresh();
      synth.addEventListener('voiceschanged', () => { refresh(); onChange(); });
    },

    listVoices() {
      const all = voices.map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang, local: v.localService }));
      const ja = all.filter(v => v.lang.toLowerCase().startsWith('ja'));
      return ja.length ? ja : all;
    },

    speak(text, { voiceId, rate = 1, pitch = 1, volume = 1 } = {}) {
      text = stripEmoji(text);
      if (!text.trim()) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const u = new SpeechSynthesisUtterance(text);
        const v = voices.find(v => v.voiceURI === voiceId);
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'ja-JP'; }
        u.rate = rate;
        u.pitch = pitch;
        u.volume = volume;
        u.onend = () => { clearKeepAlive(); current = null; resolve(); };
        u.onerror = e => {
          clearKeepAlive();
          current = null;
          // stop() による中断はエラー扱いしない
          if (e.error === 'interrupted' || e.error === 'canceled') resolve();
          else reject(new Error(e.error || '読み上げに失敗しました'));
        };
        current = u;
        synth.speak(u);
        // Chrome のオンライン音声は約 15 秒で途切れるため、定期的に pause/resume して延命する
        if (v && !v.localService) {
          clearKeepAlive();
          keepAlive = setInterval(() => {
            if (!synth.speaking) return clearKeepAlive();
            synth.pause();
            synth.resume();
          }, 10000);
        }
      });
    },

    stop() {
      clearKeepAlive();
      current = null;
      if (synth) synth.cancel();
    },
  };
})();

// Irodori-TTS-Server（OpenAI 互換 API）に接続するエンジン
// https://github.com/Aratako/Irodori-TTS-Server
const irodoriEngine = (() => {
  const NO_REF = 'none';
  const CACHE_SIZE = 60;
  let config = { baseUrl: 'http://localhost:8088', apiKey: '' };
  let voices = [];
  let onChange = () => {};
  const cache = new Map();  // 同じセリフ・同じ声なら作り直さない（生成に時間がかかるため）
  let audio = null;
  let finish = null;        // 再生中の speak() を終わらせる関数
  let token = 0;            // stop() のたびに増やす

  async function request(path, init = {}) {
    const headers = { ...init.headers };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    let res;
    try {
      res = await fetch(config.baseUrl.replace(/\/+$/, '') + path, { ...init, headers });
    } catch (e) {
      throw new Error('サーバーに接続できません。起動しているか、URL と CORS の設定を確認してください');
    }
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (e) { /* 本文なし */ }
      throw new Error(`${res.status} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
    return res;
  }

  function synthesize(text, { voiceId, rate = 1, caption = '' }) {
    const key = JSON.stringify([config.baseUrl, text, voiceId, rate, caption]);
    if (!cache.has(key)) {
      const body = { model: 'irodori-tts', input: text, voice: voiceId || NO_REF, response_format: 'wav', speed: rate };
      if (caption.trim()) body.irodori = { caption: caption.trim() };
      const p = request('/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.blob());
      p.catch(() => cache.delete(key));
      cache.set(key, p);
      if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  }

  return {
    id: 'irodori',
    label: 'Irodori-TTS（自分の PC のサーバー）',
    features: { pitch: false, caption: true },
    maxChunk: Infinity,     // 長文の分割はサーバー側で行う

    isSupported() {
      return typeof fetch === 'function';
    },

    init(cb) {
      onChange = cb;
    },

    configure(next) {
      config = { ...config, ...next };
      cache.clear();
    },

    // 接続を確認して声一覧を読み込む
    async refresh() {
      const res = await request('/v1/audio/voices');
      const data = (await res.json()).data || [];
      voices = data.map(v => ({
        id: v.id,
        name: v.no_ref ? '参照なし（声の説明で作る）' : v.id,
        lang: 'ja-JP',
        local: true,
      }));
      if (!voices.length) voices = [{ id: NO_REF, name: '参照なし（声の説明で作る）', lang: 'ja-JP', local: true }];
      onChange();
      return voices;
    },

    listVoices() {
      return voices;
    },

    // 生成が終わったら resolve する（失敗は speak() 側で報告するのでここでは握りつぶす）
    prefetch(text, options) {
      return synthesize(text, options).then(() => {}, () => {});
    },

    async speak(text, options = {}) {
      const my = ++token;
      const blob = await synthesize(text, options);
      if (my !== token) return;   // 生成中に止められた
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.volume = options.volume ?? 1;
      audio = a;
      return new Promise((resolve, reject) => {
        const done = err => {
          URL.revokeObjectURL(url);
          if (audio === a) { audio = null; finish = null; }
          err ? reject(err) : resolve();
        };
        finish = () => done();
        a.onended = () => done();
        a.onerror = () => done(new Error('音声を再生できませんでした'));
        a.play().catch(e => done(e));
      });
    },

    stop() {
      token++;
      if (audio) audio.pause();
      if (finish) finish();
    },
  };
})();

const ENGINES = [browserEngine, irodoriEngine];
