# HANDOFF — AI開発引き継ぎメモ

最終更新: 2026-07-31 (Fable) — プロジェクト開始

## 現状

- 基盤構築中。index.html / ドキュメント作成済み。src/ 実装中
- git: ローカルリポジトリ初期化済み。GitHubリモートは未設定(ユーザーに要確認 or `gh` 認証があればpush)

## 方針(変更しないこと)

- **ビルドレス構成**: Three.js は importmap で CDN 読み込み。npm/バンドラ導入禁止(トラブル・トークン節約)
- **アセットは全てコード生成**: 3Dモデル=プリミティブ合成、顔=Canvasテクスチャ、音=WebAudio合成。外部ファイル追加しない
- 検証は `npx serve` + puppeteer-core(インストール済みEdge使用)のスクリーンショット
- 元イラスト: `assets/` 内の2枚(トコろん本体とLINEスタンプ風表情集)。色: 体=オレンジ#F5A21B系、顔=クリーム#FDF3DC、帽子=黄色#FFD400、プロペラ=緑、羽=白

## ファイル構成

- `index.html` — エントリ、HUD/タイトル/リザルトのDOM、CSS全部入り
- `src/main.js` — 起動、ゲームループ、状態機械(title/play/gameover/clear)、カメラ定数 `CAM`
- `src/player.js` — トコろんモデル(プリミティブ)+表情(Canvasテクスチャ)+移動
- `src/weapons.js` — 直線弾、ロックオン管理、ホーミング弾、照準
- `src/enemies.js` — 敵全種+ボス+弾
- `src/world.js` — 地面スクロール、雲、ステージ演出(商店街/公園/基地)、タイムライン
- `src/audio.js` — WebAudio 合成 BGM/SFX
- `src/input.js` — キーボード/マウス/タッチ統合
- `src/ui.js` — DOM HUD操作

## TODO / 既知の課題

- (完成後に更新)
