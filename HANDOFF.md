# HANDOFF — AI開発引き継ぎメモ

最終更新: 2026-07-31 (Fable) — Web版初版が動作、検証・磨き込み中

## 現状

- **Web版はプレイ可能な状態**。タイトル→AREA1〜4→ボス→クリア/ゲームオーバーまで全部通る
- 自動テスト(tools/)で7項目PASS: 敵出現/ロックオン/ホーミング撃破/直線ショット/被弾/ボス撃破クリア/リロード無し
- git: ローカル+GitHub `mukkii-game/panzer-tokoron` (private) にpush済み
- Unity6プロジェクトはユーザーが `PanzerTokoron/` に用意済み(独自リポジトリ、.gitignore済み)。**まずWeb版を完成させる方針**。Web版で性能・品質の限界が来たら移行検討

## 方針(変更しないこと)

- **ビルドレス構成**: Three.js は importmap で CDN 読み込み。npm/バンドラ導入禁止(ゲーム本体には)
- **アセットは全てコード生成**: 3Dモデル=プリミティブ合成、顔=Canvasテクスチャ(`src/player.js` の `drawFace`)、音=WebAudio合成(`src/audio.js`)。外部アセットファイル追加しない
- 元イラスト: `assets/`(ワークスペース外、チャット添付)。トコろん配色: 体=#F6A21E、顔=#FDF3DC、帽子=#FFCC00、プロペラ=緑#7DC242、羽=白

## カメラ仕様(ユーザー要望 2026-07-31)

- ザクソン固定ではなく「パンツァードラグーンで視点を斜め後ろに回した状態」がベース
- 自機の顔が見える前方斜め上カメラ。視点可動域はせいぜい180度以内(横〜後ろ)、仰角120度程度まで
- `src/main.js` の `CAM` 定数で調整。**ゲーム中に数字キー 4/6(ヨー) 8/2(ピッチ) 3/9(距離) 5(consoleへ出力)で実機調整可能**
- 照準に連動してカメラが swayYaw/swayPitch だけゆるく振れる

## 検証ツール(tools/、要 `npm install` 済み)

- サーバー: `npx http-server -p 8123 -c-1 .` をリポジトリ直下で
- `node tools/shot.js` — 各エリアのスクリーンショット(tools/shots/)
- `node tools/playtest.js` — 機能テスト7項目
- `node tools/soak.js` — ボット注入で全編自動プレイ+FPS計測
- **注意**: puppeteer.launchはこの環境で失敗する。Edgeを`--remote-debugging-port=0`で自前spawnし、プロファイルの`DevToolsActivePort`からポートを読んで`puppeteer.connect`する方式(各スクリプト参照)
- **注意**: ヘッドレスEdgeはバックグラウンドタブのrAFを止める。`--disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion` 必須

## 直近の既知課題・残タスク

- [ ] soak全編テストの完走確認(FPS/難易度バランス見る)
- [ ] スマホ(タッチエミュレーション)での動作確認
- [ ] 権利面: トコろんは所沢市公式マスコット。公開(GitHub Pages等)前にユーザーへ確認
- [ ] 表情の露出をもっと増やす(現状: 被弾panic/ピンチpinch/発射angry/コンボjoy/クリアjoy/ゲームオーバーdizzy)
- バグ修正済み: enemies.jsのTeaDrone/Biplaneで`super()`前に`this`アクセスでクラッシュ→修正済み

## トークン節約Tips(後続AIへ)

- 見た目確認は `node tools/shot.js` のスクリーンショットをReadで見るのが安い
- ロジック確認は playtest.js を拡張して PASS/FAIL 出力にする(スクショ読みより安い)
- ドキュメントは簡潔に。コードは大きいファイル単位でWriteし直すより StrReplace で差分編集
