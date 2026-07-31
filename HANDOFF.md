# HANDOFF — AI開発引き継ぎメモ

最終更新: 2026-07-31 (Fable) — Web版初版が動作、検証・磨き込み中

## 現状

- Web版プレイ可能。2026-07-31 顔リファイン中: 表情canvasをイラスト準拠のクリーム楕円+茶アウトライン+大きめ黒丸目+ω舌に全面書き直し、翼を関節付き(肩/肘/羽先)に、弾を大型化、ホーミングにもくもく雲、地上y=0.12まで下降可、360度ウェーブ方向は既存
- git: `mukkii-game/panzer-tokoron` (private)
- 音響: BGM=爽快シンセ(WebAudio合成)、効果音=Kenney Digital Audio / Sci-fi Sounds (CC0) を `assets/sfx/` 同梱

## 方針(変更しないこと)

- **ビルドレス構成**: Three.js は importmap で CDN 読み込み。npm/バンドラ導入禁止(ゲーム本体には)
- **アセットは全てコード生成**: 3Dモデル=プリミティブ合成、顔=Canvasテクスチャ(`src/player.js` の `drawFace`)、音=BGMはWebAudio合成(`src/audio.js`)、効果音はKenney CC0を`assets/sfx/`に同梱(失敗時は合成フォールバック)。3D/顔はコード生成のまま
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
- **重要な罠**: ヘッドレスEdgeで `page.screenshot()` を撮ると、その後 rAF が凍結してゲームループが止まる(3回再現)。長時間テストでは途中スクショ禁止。スクショが要るときは撮影間隔を数秒以内にするか、終了時のみ撮る

## 検証済み

- 全編完走(fastrun.js): タイトル→AREA1-4→ボス→クリア、エラーゼロ、ジオメトリリークなし
- 実測FPS 60安定(1280x720、敵フル出現時)
- スマホ(390x844タッチエミュ): スティック移動/照準連射/ロックオン/撃破 全PASS
- 機能テスト(playtest.js) 7項目PASS

## 直近の既知課題・残タスク

- [ ] **ユーザー実機での体感難易度確認**(ボット基準で調整済みだが人間の体感は未確認)。救済: ハートドロップ15%/無敵2.5秒/ピンチ時は敵攻撃間隔1.45倍(main.jsのrelief())
- [ ] BGM/効果音の実機試聴(ヘッドレスでは聴けないためコードレビューのみ)
- [ ] 権利面: トコろんは所沢市公式マスコット。公開(GitHub Pages等)前にユーザーへ確認
- [ ] 表情の露出をもっと増やす(現状: 被弾panic/ピンチpinch/発射angry/コンボjoy/回復joy/クリアjoy/ゲームオーバーdizzy)
- 修正済みバグ: TeaDrone/Biplaneの`super()`前`this`アクセス / GPUジオメトリリーク / 雲がカメラを覆う / 縦画面で自機が大きすぎ
- **ヘッドレスEdge固有**(実害なし): 起動15秒前後でrAF凍結、たまに勝手にページreload。テストはgame.tick()手動駆動のfastrun.jsを使うこと

## トークン節約Tips(後続AIへ)

- 見た目確認は `node tools/shot.js` のスクリーンショットをReadで見るのが安い
- ロジック確認は playtest.js を拡張して PASS/FAIL 出力にする(スクショ読みより安い)
- ドキュメントは簡潔に。コードは大きいファイル単位でWriteし直すより StrReplace で差分編集
