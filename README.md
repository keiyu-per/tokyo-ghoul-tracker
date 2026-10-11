# TOKYO GHOUL TRACKER

L東京喰種の **CZ当選までの通常G・CZ結果・AT表示獲得枚数** を記録し、ChatGPTへコピーするiPhone向け実戦入力アプリ。GitHub Pagesで無料公開可能な静的サイトです。

## 使い方
1. CZ当選時（または結果確認後）、**CZまでの通常G**と結果（未確定/AT当選/失敗）を入力して **CZを追加**。
2. CZの結果を後から確定する場合はEVENT LOGの「成功」/「失敗」を押す。
3. AT終了時、表示獲得枚数を入力し **AT終了を追加**。未連携の成功CZに自動紐付け。紐付け先がない場合は契機「その他/不明」とする。
4. **AI分析用データをコピー**してChatGPTへ貼る。
5. 長期保存や端末移行は **JSONバックアップ** → **JSON復元**。Safariのデータ消去時は端末内記録が消えることがあります。

### 通常Gの定義
「前の記録起点（着席時、前回CZ、前回AT終了等）から該当CZ当選までに消化した**通常時のゲーム数**」を入力。CZ・AT中のゲーム数は含めない。入力済み区間の合計は、**完全な台の総回転数ではありません**。未記録の区間があればAIに伝えてください。

### 表示獲得枚数の定義
AT終了画面などの **表示獲得枚数** を入力します。差枚ではなく、獲得枚数自体から設定を断定できません。獲得枚数に設定差があるかをアプリでは判定しません。

## 初回公開 (GitHub Pages)
1. GitHubでこのリポジトリを開く。
2. **Settings → Pages → Build and deployment** を選択。
3. **Source: Deploy from a branch** → **Branch: main / (root)** → **Save**。
4. 公開先: https://keiyu-per.github.io/tokyo-ghoul-tracker/

GitHub Pagesを有効化するまでは公開URLは表示できません。初回公開まで少し時間がかかることがあります。iPhone Safariの共有メニューから **ホーム画面に追加** 可能です。

## 仕様駆動開発
- 仕様の一次情報: [docs/SPEC.md](docs/SPEC.md)
- データ・集計の純粋関数: [src/model.mjs](src/model.mjs)
- UI操作: [src/app.mjs](src/app.mjs)
- 受け入れテスト: [tests/model.test.mjs](tests/model.test.mjs)
- テスト実行: Node.js 22以降の端末で `node --test tests/*.test.mjs`
- GitHub Actionsの `Tests` ワークフローがmainへのpush時に受け入れテストを実行します。

## データの扱い
- 記録データは端末のlocalStorageに保存。ユーザー操作でJSON書き出し・読み込みを実行。
- 外部API、アカウント、バックエンド、分析サーバー、トラッキング機能は無し。
- 入力情報はコピー時以外、アプリから外部サービスへ送られない。ChatGPTにペーストする場合は投稿内容を確認してください。

## リリース記録
- v0.1 (2026-10-12): CZ/AT入力・リンク・履歴・AI出力・ローカル保存・JSONバックアップ・受け入れテスト。
