'use strict';

// 音声エンジン
// どのエンジンも次の形を満たせば app.js から差し替えて使えます。
//   id, label
//   isSupported()                       … このブラウザで使えるか
//   init(onChange)                      … 声一覧が変わったら onChange() を呼ぶ
//   listVoices()                        … [{ id, name, lang, local }]
//   speak(text, { voiceId, rate, pitch, volume }) … 読み終わったら resolve する Promise
//   stop()                              … 読み上げを即座に止める
// 有料の AI 音声（OpenAI / Google Cloud / ElevenLabs など）を追加する場合は、
// API で取得した音声を <audio> で再生する speak() を実装して ENGINES に登録します。

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

    isSupported() {
      return !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
    },

    init(onChange) {
      if (!synth) return;
      refresh();
      synth.addEventListener('voiceschanged', () => { refresh(); onChange(); });
    },

    listVoices() {
      return voices.map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang, local: v.localService }));
    },

    speak(text, { voiceId, rate = 1, pitch = 1, volume = 1 } = {}) {
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

const ENGINES = [browserEngine];
