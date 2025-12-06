# Coaching Assist System

このプロジェクトは、学習コーチングのための目標管理・レポート表示を行うシンプルな Node.js/Express アプリです。最新の変更では SMART 目標の CRUD、進捗更新、週次/日次サマリ API、フロントエンドの目標作成フォームが追加されています。

## セットアップと起動手順
1. Node.js と npm をインストールします。
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. サーバーを起動します。
   ```bash
   node server.js
   ```
4. ブラウザで `http://localhost:3001` を開くと、ログイン後にレポート・目標管理 UI が表示されます。

## 主要な API エンドポイント
- `POST /api/register` / `POST /api/login` / `POST /api/logout`: 認証
- `GET /api/goals` / `POST /api/goals` / `PUT /api/goals/:id` / `DELETE /api/goals/:id`: SMART 目標の CRUD
- `POST /api/goals/:id/progress`: 進捗更新と期限超過の警告
- `GET /api/goals/summary`: 週次/日次の達成率・未完了数・リスク目標一覧

## テストの実行
Jest と Supertest のリクエストテストが `__tests__/goals.test.js` に含まれています。
```bash
npm test -- --runInBand
```

## よくある質問
- **「これをどうすればいいの？」**: 上記のセットアップ手順でサーバーを起動し、ブラウザから UI を操作してください。API を直接確認したい場合は、`curl` などで上記エンドポイントを呼び出せます。
- **「コピペして実行すればいいの？」**: はい。コマンドはコードブロックをそのままコピーしてターミナルで実行できます。
- **「PR を表示するとは？」**: `git show` で直近のコミット差分を確認したり、GitHub などのリポジトリホスティング上で Pull Request を開いて変更内容をレビューすることを指します。

