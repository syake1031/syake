# 台本読み上げ Web アプリ（Voice Script）

任意の台本を、話者ごとに声を変えて読み上げる Web アプリです。
HTML / CSS / JavaScript のみで動作し、ビルドやサーバーは不要です。
音声エンジンは 2 種類から選べます。

- **ブラウザ標準**：Web Speech API を使います。無料で、準備も不要です
- **Irodori-TTS**：自分の PC で動かす [Irodori-TTS](https://github.com/Aratako/Irodori-TTS) サーバーにつなぎ、よりリアルな AI 音声で読み上げます

## 機能

- **台本の読み上げ**：再生 / 一時停止 / 停止 / 前の行・次の行
- **好きな行から再生**：台本ビューの行をクリック、またはエディタのカーソル行から再生
- **話者ごとの声**：台本に出てくる話者を自動で検出し、声・速さ・高さを個別に設定（試聴あり）
- **Irodori-TTS 対応**：参照音声による声のクローン、「声の説明」による声づくり、絵文字による感情の指定。この先の数行を先に生成しておくので、待ち時間が短くなります
- **読み上げ中の行をハイライト**し、進み具合をバーで表示
- **全体設定**：音量、行と行の間の長さ、ト書きを読むかどうか
- **台本の管理**：複数の台本を保存・切り替え・削除、`.txt` の読み込みと書き出し
- データはブラウザの `localStorage` に自動保存されます

## 台本の書き方

```
# 「#」で始まる行はコメント（読みません）
ナレーター：とある町の、小さな喫茶店。
店長: いらっしゃいませ。          ← 半角コロンでも OK
話者のない行は「ナレーション」として読みます
[間 1.5]                          ← 1.5 秒の無音（[間] だけなら 1 秒）
（店長、コーヒーを淹れる）          ← 行全体が括弧ならト書き（初期設定では読みません）
店長：あははっ🤭、それ本当？        ← 絵文字で感情を指定（Irodori-TTS のみ。ブラウザ標準では読み飛ばします）
```

## 使い方

公開版：https://syake1031.github.io/syake/voice-script/

`main` ブランチに push すると GitHub Actions（`.github/workflows/pages.yml`）で自動的に GitHub Pages へデプロイされます。

ローカルでは `index.html` をブラウザで開くだけで使えます。

## 声の質について

声の種類と品質はブラウザと OS によって変わります。

- **Edge**：Microsoft の自然な日本語音声（Nanami など、「オンライン」表示のもの）が使えて、おすすめです
- **Chrome**：Google の日本語音声が使えます
- **Safari / iPhone**：OS の設定で高品質な音声を追加すると選べるようになります

## Irodori-TTS を使う

Irodori-TTS は音声を自分の PC で作るため、**NVIDIA の GPU を積んだ PC** が必要です（CPU でも動きますが、とても遅くなります）。
v4-Large はモデルが大きい（fp32 で約 12 GB）ため、VRAM の多い GPU が必要です。足りない場合は量子化版（`Aratako/Irodori-TTS-v4-Large-Quantized`）や v4-Small を使ってください。

### 1. サーバーを用意する（最初の 1 回だけ）

[Git](https://git-scm.com/) と [uv](https://docs.astral.sh/uv/) を入れてから、ターミナルで次を実行します。

```sh
git clone https://github.com/Aratako/Irodori-TTS-Server.git
cd Irodori-TTS-Server
uv sync --extra cu128
cp .env.example .env      # Windows の PowerShell では copy .env.example .env
```

`.env` を開いて、次の 2 行を書き換え・追加します。

```sh
# 使うモデル（読み込めない場合は Aratako/Irodori-TTS-v4-Small に戻してください）
IRODORI_HF_CHECKPOINT=Aratako/Irodori-TTS-v4-Large
# このアプリからの接続を許可する（"null" はローカルの index.html から開いた場合）
IRODORI_CORS_ORIGINS=["https://syake1031.github.io","null"]
```

> Irodori-TTS-Server の公式 README は v4-Small を前提にしています。v4-Large はこの指定で読み込める想定ですが、エラーになる場合は Small で動作を確認してください。

### 2. サーバーを起動する（使うたびに）

```sh
cd Irodori-TTS-Server
uv run --no-sync python -m irodori_openai_tts --host 127.0.0.1 --port 8088
```

初回はモデルのダウンロードがあるので時間がかかります。

### 3. アプリから接続する

1. 「音声エンジン」で **Irodori-TTS** を選ぶ
2. サーバー URL が `http://localhost:8088` になっていることを確認して「接続」
3. 「接続しました」と出たら、話者ごとに声を選んで試聴

- **声を選ぶ**：サーバーの `voices/` フォルダに音声ファイル（例: `alice.wav`）を置くと、`alice` という声として選べます（声のクローン）
- **声を作る**：「参照なし」を選び、「声の説明」に「落ち着いた低い声の中年男性」などと書きます
- Chrome / Edge で「ローカル ネットワーク上のデバイスへのアクセス」を求められたら許可してください
- iPhone / Mac の Safari は、https のページから `http://localhost` へ接続できないことがあります。PC の Chrome / Edge で使ってください

## 有料の AI 音声に切り替えるには

音声エンジンは `engines.js` にまとめてあり、差し替えやすい作りにしています。
OpenAI TTS や Google Cloud TTS、ElevenLabs などを使いたくなったら、同じ形（`speak()` / `stop()` / `listVoices()`）のエンジンを追加します。
その際は次の点に注意してください。

- API キーをこのリポジトリやページ内に書かないこと（公開されてしまいます）。Cloudflare Workers などの小さな中継サーバーを用意して、キーはそちらに置きます
- 有料 API なら音声ファイル（MP3）に書き出す機能も作れます（ブラウザ標準の音声では録音できません）

## ファイル構成

```
index.html  画面
style.css   スタイル（ダークモード・スマホ対応）
engines.js  音声エンジン（ブラウザ標準 / Irodori-TTS。ほかのエンジンもここに追加）
app.js      ロジック（台本の解析・再生・話者設定・保存）
```
