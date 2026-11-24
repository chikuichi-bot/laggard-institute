# 見知らぬ駅 · 1年アンケート · 実査メモ

## 公開フォーム（回収中）

**URL:** https://lagado.jp/mishiranu-survey/year1/

- 送信先: 同ディレクトリ `submit.php` → サーバ上 `responses.jsonl`（Web から読めない）
- 招待文: `year1-survey-invite.txt`
- 設問正本: `year1-user-survey-questionnaire.md`

## 2026-11-22

- フォームをさくらへアップロード済み（index HTTP 200）
- 送信スモークテスト成功（受付 id あり · 本番集計前にテスト行は除外可）

## 100人への届け方

連絡先リストはリポ／Vault に無いため、次のいずれかで配布する。

1. TestFlight／知人テスターへの個別連絡（招待文をコピー）
2. X・ブログ・店舗など既存チャネル
3. App Store 公開後のアプリ内リンク（将来）

回収目標 N≈100。回答はサーバの `responses.jsonl` に蓄積。取り出しは FTP（`mishiranu-survey/year1/responses.jsonl`）。

## 集計のとき

1. `responses.jsonl` をローカルへ落とす  
2. スモーク／自分試しの行を `id` で除外  
3. `answers` をスプレッドシート化（列名はアンケート完成版 §5）
