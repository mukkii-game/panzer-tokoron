# パンツァートコろーん 〜所沢本土大決戦　基地全面返還は市民の願い〜

所沢のマスコット「トコろん」が主役の、パンツァードラグーン オルタ系レールシューター。
ファンシー&かわいいテイスト、ザクソン風クォータービュー。自機は画面手前を向いて飛び、敵は奥や横からやって来る。

## 遊び方

ローカルサーバーで `index.html` を配信して開くだけ(ビルド不要)。

**公開プレイURL:** https://mukkii-game.github.io/panzer-tokoron/

```powershell
npx serve .
# または
python -m http.server 8000
```

- **PC**: WASD/矢印=移動、マウス=照準、左クリック=ショット連射、右クリック長押し=ロックオン→離してホーミング一斉発射
- **スマホ**: 画面左半分ドラッグ=移動、右半分タッチ=照準+連射、押しっぱなしでロックオン→離して発射

## 技術構成

- Three.js (CDN importmap) + Vanilla JS、ビルドツールなし
- 3Dモデル: すべてコード生成(プリミティブ構成)。顔はCanvasテクスチャで表情差し替え
- 音: BGMはWebAudio合成(爽快シューティング風)。効果音は [Kenney](https://kenney.nl) Digital Audio / Sci-fi Sounds (CC0) を `assets/sfx/` に同梱。読み込み失敗時は合成にフォールバック
- PC / スマホ両対応(タッチUI内蔵)

## ドキュメント

- [SPEC.md](./SPEC.md) — ゲーム仕様
- [HANDOFF.md](./HANDOFF.md) — 開発引き継ぎメモ(AI間引き継ぎ用)
