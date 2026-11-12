見知らぬ駅 · 案内キャッシュ（さくらのレンタルサーバ）
====================================================

なぜ置くか
----------
同じ駅の案内は、誰が引いても中身が同じです。いまは毎回ゼロから作っていて、
そのたびに Gemini の検索グラウンディング（リクエスト単位の課金）が走ります。
一度できたものをここに置いて配れば、2人目から先は生成が走りません。


1. アップロード
---------------
FileZilla で、このフォルダの中身をさくらへ置きます。

  さくら : grayjaguar21.sakura.ne.jp
  上げ先 : ~/www/mishiranu-cache/
  公開URL: https://lagado.jp/mishiranu-cache
  上げる : put.php  .htaccess

v1/ フォルダは put.php が自動で作ります。先に作らなくて構いません。
lagado2026 のような Basic 認証はここには掛けません（アプリが直接読むため）。


2. 合言葉を置く
---------------
同じ ~/www/mishiranu-cache/ に cache-token.txt を1つ作り、
長い文字列を1行だけ書きます。作り方の例:

  openssl rand -hex 24

.htaccess で外から読めないようにしてありますが、念のため推測しにくい文字列に
してください。この中身をアプリ側の MISHIRANU_CACHE_TOKEN に入れます。
Vault にもリポジトリにも書きません（さくら移行ノートと同じ扱い）。


3. 書き込み権限
---------------
mishiranu-cache フォルダのパーミッションを 755 にします。
PHP が v1/ を作って JSON を書けるようにするためです。


4. アプリ側の設定
-----------------
案内 API を動かしている側（いまは mishiranu-eki.apps.grok.bot）の環境変数に
2つ足します。

  MISHIRANU_CACHE_URL=https://lagado.jp/mishiranu-cache
  MISHIRANU_CACHE_TOKEN=cache-token.txt と同じ文字列

どちらも未設定なら、キャッシュを使わず今までどおり毎回生成します。
さくらが落ちても案内は止まりません（読みも書きも失敗は黙って無視します）。


5. 動いているか見る
-------------------
駅をひとつ引いたあと、~/www/mishiranu-cache/v1/ に
64桁の名前の .json が1つ増えていれば書けています。
同じ駅をもう一度引いて、すぐ返ってくれば読めています。

  curl -s -o /dev/null -w '%{http_code}\n' https://lagado.jp/mishiranu-cache/v1/<64桁>.json


作り直したいとき
----------------
・1駅だけ: v1/ の該当 .json を消す。次に引いたとき作り直します。
・全部   : v1/ ごと消す。
・案内の作り方を変えたとき: lib/mishiranu-station-cache.ts の CACHE_SCHEMA を
  v2 に上げると、古いものは読まれなくなります（消さなくてよい）。

90日を過ぎた案内は自動で作り直します。店は閉まるためです
（レンタサイクルえむじか 2026-01 閉業）。


バックアップ
------------
~/www 全体を iCloud へ取る backup-sakura-to-icloud.sh の対象に入ります。
v1/ は作り直せるので、容量が気になるときは除外して構いません。
