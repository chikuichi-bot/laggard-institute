見知らぬ駅 · ホームページ（さくらのレンタルサーバ）
========================================================
思想: 空虚だった知らない駅を、散歩の大事な空間へ変える


公開URL
-------
  https://lagado.jp/mishiranu-orikata/


自動アップロード（推奨）
------------------------
1. リポジトリ直下の秘密ファイルを開く（Git に入りません）:

     .lolipop-private-auth/sakura-ftp.env

2. SAKURA_FTP_PASS= の右に、さくらの「サーバパスワード」を書く。
   （チャットには貼らない）

3. ターミナル、または Cursor に「降り方をアップ」と言う:

     ./scripts/upload-sakura-orikata.sh

一度書けば、以後はこちらから自動で上げられます。


手動（FileZilla）
-----------------
  さくら : grayjaguar21.sakura.ne.jp
  上げ先 : ~/www/mishiranu-orikata/
  上げる : index.html  orikata.css  story/


確認
----
  curl -sI https://lagado.jp/mishiranu-orikata/ | head

アプリの設定「見知らぬ駅の降り方」はこの URL を開きます。
lagado2026 の Basic 認証は掛けません（設定からそのまま読めるように）。
