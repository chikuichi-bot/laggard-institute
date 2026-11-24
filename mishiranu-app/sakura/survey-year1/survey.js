/* 見知らぬ駅 · 1年利用後アンケート（実査フォーム） */
(function () {
  const L5_AGREE = [
    "1 まったくそう思わない",
    "2 あまりそう思わない",
    "3 どちらともいえない",
    "4 ややそう思う",
    "5 とてもそう思う",
  ];
  const L5_GOOD = [
    "1 とても低い／悪い",
    "2 低い／悪い",
    "3 普通",
    "4 高い／良い",
    "5 とても高い／とても良い",
  ];
  const FREQ = [
    "ほぼ毎日",
    "週に数回",
    "月に数回",
    "年に数回",
    "ほとんど／まったくない",
    "該当しない・分からない",
  ];

  /** @type {{id:string, section:string, type:string, q:string, hint?:string, options?:string[], required?:boolean, max?:number, rows?:string[], when?:Function}[]} */
  const QUESTIONS = [
    {
      id: "intro",
      section: "S0",
      type: "intro",
      q: "はじめに",
      body:
        "見知らぬ駅を使った経験について、改善のためのアンケートです。正解はありません。使わなくなった方も、そのまま教えてください。所要はだいたい15〜20分です（短いコースもあります）。位置情報や移動の記録は提出不要です。回答は匿名で集計します。途中でやめても構いません。",
    },
    {
      id: "screen_app",
      section: "S0",
      type: "mc",
      required: true,
      q: "このアンケートは、iPhone アプリ「見知らぬ駅」についてのものです。対象のアプリで間違いないですか。",
      options: ["はい、見知らぬ駅です", "いいえ／分からない"],
    },
    {
      id: "consent",
      section: "S0",
      type: "mc",
      required: true,
      q: "改善のための匿名アンケートに協力することに同意しますか。位置情報や移動ログの提出は求めません。",
      options: ["同意する", "同意しない"],
    },
    {
      id: "tenure",
      section: "S0",
      type: "mc",
      required: true,
      q: "見知らぬ駅を、およそいつごろから使い始めましたか。",
      options: [
        "およそ1年以上前",
        "8〜14か月前くらい",
        "4〜7か月前くらい",
        "3か月未満",
        "分からない",
      ],
    },
    {
      id: "recent_use",
      section: "S0",
      type: "mc",
      required: true,
      q: "直近の3か月で、アプリを開いたり駅の案内を見たりしましたか。",
      options: ["はい（1回以上）", "いいえ（開いていない）"],
    },
    {
      id: "depth_use",
      section: "S0",
      type: "mc",
      required: true,
      q: "これまでに、アプリで駅の案内を開いたり、実際に駅に降りて歩いたりしたことはありますか。",
      options: [
        "駅を開いて、歩いたこともある",
        "駅は開いたが、あまり歩いていない",
        "インストールしたが、駅をほとんど開いていない",
        "分からない",
      ],
    },
    // never route
    {
      id: "never_reason",
      section: "never",
      type: "ma",
      required: true,
      max: 3,
      q: "ほとんど使わなかった理由に近いものを選んでください（最大3つ）。",
      options: [
        "使い方が分からなかった",
        "自分向きではなさそうだった",
        "時間がなかった",
        "不具合・不安",
        "興味が続かなかった",
        "その他",
      ],
      when: (a) =>
        a.depth_use === "インストールしたが、駅をほとんど開いていない" ||
        a.depth_use === "分からない",
    },
    {
      id: "never_winback",
      section: "never",
      type: "oe",
      required: true,
      q: "一言で、何があれば試してみたと思いますか。",
      when: (a) =>
        a.depth_use === "インストールしたが、駅をほとんど開いていない" ||
        a.depth_use === "分からない",
    },
    {
      id: "nps_never",
      section: "never",
      type: "nps",
      required: true,
      q: "いまの印象で、親しい人に勧める度合いを 0〜10 で教えてください。",
      when: (a) =>
        a.depth_use === "インストールしたが、駅をほとんど開いていない" ||
        a.depth_use === "分からない",
    },
    // S1
    {
      id: "one_liner",
      section: "S1",
      type: "oe",
      required: true,
      q: "いまのあなたにとって、見知らぬ駅を一言で言うと何ですか。",
      hint: "40字くらいまでで大丈夫です。",
      when: usedApp,
    },
    {
      id: "memorable_walk",
      section: "S1",
      type: "oe",
      required: true,
      q: "いちばん印象に残っている駅や散歩があれば教えてください。駅名は書いても伏せても構いません。",
      when: usedApp,
    },
    {
      id: "core_own_place",
      section: "S1",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "名前だけ知っていた場所が、自分の場所になった感じがしますか。",
      when: usedApp,
    },
    {
      id: "sat_overall",
      section: "S1",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "アプリ全体として、どのくらい満足していますか。",
      when: usedApp,
    },
    {
      id: "sat_reason_ma",
      section: "S1",
      type: "ma",
      required: true,
      max: 3,
      q: "その満足度に近い理由を選んでください（最大3つ）。",
      options: [
        "知らない駅に降りられた",
        "土地の案内が役に立った／面白かった",
        "声の案内がよかった",
        "地図やコースが歩きやすかった",
        "文章や雰囲気が好き",
        "期待ほどではなかった",
        "誤りや不具合が気になった",
        "使い方が分かりにくかった",
        "時間が合わなかった／続けにくかった",
        "特にない",
        "その他",
      ],
      when: usedApp,
    },
    // S2
    {
      id: "freq_peak",
      section: "S2",
      type: "mc",
      required: true,
      q: "いちばんよく使っていた時期の、おおよその利用頻度はどれに近いですか。",
      options: FREQ,
      when: usedApp,
    },
    {
      id: "freq_recent",
      section: "S2",
      type: "mc",
      required: true,
      q: "直近3か月の利用頻度はどれに近いですか。",
      options: FREQ,
      when: usedApp,
    },
    {
      id: "scene_ma",
      section: "S2",
      type: "ma",
      required: true,
      q: "主な使い方・場面はどれですか。",
      options: [
        "通勤・通学の合間",
        "休日の散歩",
        "観光・旅行先",
        "日常の寄り道",
        "夜の時間",
        "雨の日など天候が悪いとき",
        "記録や収集のように駅を開拓",
        "その他",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "walk_duration",
      section: "S2",
      type: "mc",
      required: true,
      q: "一度使うとき、歩く時間はだいたいどれくらいですか。",
      options: [
        "10分未満",
        "10〜20分",
        "20〜40分",
        "40分以上",
        "ほとんど歩かず読む／聴くだけ",
        "分からない",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "area_ma",
      section: "S2",
      type: "ma",
      required: true,
      q: "よく使ったエリア感はどれですか。",
      options: [
        "京都（京阪など）",
        "大阪",
        "神戸・阪神間",
        "その他関西",
        "関西以外（試した／これから含む）",
        "分からない",
      ],
      when: usedApp,
    },
    {
      id: "station_exhaustion",
      section: "S2",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "「もう歩ける駅が尽きた／新鮮さが減った」と感じることがありますか。",
      when: usedApp,
    },
    // S3
    {
      id: "did_alight",
      section: "S3",
      type: "mc",
      required: true,
      q: "このアプリをきっかけに、名前だけ知っていた（または知らなかった）駅に、実際に降りたことはありますか。",
      options: ["何度もある", "数回ある", "1回だけある", "ない", "分からない"],
      when: usedApp,
    },
    {
      id: "glad_alighted",
      section: "S3",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "降りてよかった、と思うことがどのくらいありますか。",
      when: (a) =>
        usedApp(a) &&
        ["何度もある", "数回ある", "1回だけある"].includes(a.did_alight),
    },
    {
      id: "land_became_visible",
      section: "S3",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "駅名だけ読んで終わるのではなく、土地の様子が目に入るようになった感じがしますか。",
      when: usedApp,
    },
    {
      id: "want_again",
      section: "S3",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "同じ土地を、また歩きたくなりましたか。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "habit_without_app",
      section: "S3",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "アプリを開いていなくても、見知らぬ駅に降りてみたくなることがありますか。",
      when: usedApp,
    },
    {
      id: "did_not_alight_reason",
      section: "S3",
      type: "ma",
      required: false,
      q: "アプリはあるのに、降りなかった／すぐ電車に戻った経験があれば、理由を選んでください。",
      options: [
        "時間がなかった",
        "一人・夜間などで不安だった",
        "案内や地図が信用できなかった／誤りが気になった",
        "内容が退屈だった",
        "電波や動作が不安だった",
        "天候・体調",
        "特にない",
        "その他",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    // S4
    {
      id: "onboarding_clarity",
      section: "S4",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "初めて開いたとき、「何をするアプリか」は分かりましたか。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "onboarding_length",
      section: "S4",
      type: "mc",
      required: true,
      q: "最初の説明（チュートリアル）の長さはどう感じましたか。",
      options: ["短すぎた", "ちょうどよい", "長すぎた", "覚えていない／見ていない"],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "onboarding_tone",
      section: "S4",
      type: "mc",
      required: true,
      q: "説明のトーンはどう感じましたか。",
      options: [
        "詩的・雰囲気寄りでちょうどよい",
        "もう少し説明的・具体的な方がよい",
        "もう少し短い／そぎ落とした方がよい",
        "覚えていない",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    // S5
    {
      id: "entry_method",
      section: "S5",
      type: "ma",
      required: true,
      max: 2,
      q: "駅を開くとき、よく使う方法はどれですか（最大2つ）。",
      options: [
        "駅名を自分で入力・検索",
        "候補や一覧から選ぶ",
        "現在地から近い駅を探す",
        "以前開いた駅を開き直す",
        "その他",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "wrong_station",
      section: "S5",
      type: "mc",
      required: true,
      q: "別の駅と取り違えた（違う駅の案内が開いた）経験はありますか。",
      options: FREQ,
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "location_fail",
      section: "S5",
      type: "mc",
      required: true,
      q: "現在地が使えない、遅い、うまく取れない経験はありますか。",
      options: FREQ,
      when: (a) => usedApp(a) && !isDormant(a),
    },
    // S6 simplified matrix → 総合 per item
    {
      id: "content_story",
      section: "S6",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "「物語のゆかり」の文章は、全体としてどうでしたか。読んでいなければ「普通」付近でも構いません。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "content_land",
      section: "S6",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "土地の案内（駅・エリア・寄るところ・歩き方）の文章は、全体としてどうでしたか。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "ai_feel",
      section: "S6",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "文章が、機械的・自動生成っぽく感じることがありますか。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "content_error",
      section: "S6",
      type: "mc",
      required: true,
      q: "事実が違う、地元の感覚と合わない、と感じたことはありますか。",
      options: FREQ,
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "content_want",
      section: "S6",
      type: "ma",
      required: true,
      max: 3,
      q: "もっと欲しい情報はどれですか（最大3つ）。",
      options: [
        "歴史・成り立ち",
        "店・喫茶",
        "自然・川・坂",
        "安全・人通り・夜間",
        "写真・視覚的な手がかり",
        "もっと短い要約",
        "子ども向け",
        "バリアフリー",
        "特にない",
        "その他",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    // S7
    {
      id: "voice_use",
      section: "S7",
      type: "mc",
      required: true,
      q: "土地の案内を、声で聴いたことはありますか。",
      options: ["よく聴く", "ときどき聴く", "試した程度", "聴いたことがない"],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "voice_nonuse_reason",
      section: "S7",
      type: "ma",
      required: true,
      q: "聴かない理由に近いものを選んでください。",
      options: [
        "知らなかった／見つけられなかった",
        "文字で十分",
        "声が好みではなさそう",
        "通信や待ちが不安",
        "公共の場で聴きにくい",
        "その他",
      ],
      when: (a) =>
        usedApp(a) && !isDormant(a) && a.voice_use === "聴いたことがない",
    },
    {
      id: "voice_sat",
      section: "S7",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "声の案内の総合的な満足度は。",
      when: voiceUser,
    },
    {
      id: "voice_natural",
      section: "S7",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "声の自然さは。",
      when: voiceUser,
    },
    {
      id: "voice_speed",
      section: "S7",
      type: "mc",
      required: true,
      q: "話す速さは。",
      options: ["遅すぎる", "やや遅い", "ちょうどよい", "やや速い", "速すぎる"],
      when: voiceUser,
    },
    {
      id: "voice_pause",
      section: "S7",
      type: "mc",
      required: true,
      q: "句点（。）のあとの間（無音）は。",
      options: ["短すぎる", "やや短い", "ちょうどよい", "やや長い", "長すぎる"],
      when: voiceUser,
    },
    {
      id: "voice_handsfree",
      section: "S7",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "画面を見ずに、歩きながら聴きやすいですか。",
      when: voiceUser,
    },
    {
      id: "voice_glitch",
      section: "S7",
      type: "mc",
      required: true,
      q: "途切れ、待ち、再生が不安定だった経験は。",
      options: FREQ,
      when: voiceUser,
    },
    {
      id: "voice_misread",
      section: "S7",
      type: "mc",
      required: true,
      q: "固有名などの誤読が気になった経験は。",
      options: FREQ,
      when: voiceUser,
    },
    {
      id: "voice_moment_oe",
      section: "S7",
      type: "oe",
      required: false,
      q: "声の案内で助かった瞬間、またはイライラした瞬間があれば。",
      when: voiceUser,
    },
    // S8
    {
      id: "course_use",
      section: "S8",
      type: "mc",
      required: true,
      q: "散策コースを選んで、実際に歩いたことはありますか。",
      options: [
        "よく歩く",
        "ときどき歩く",
        "試した程度",
        "コースは使わず、文章や地図だけ",
        "使ったことがない",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "course_distance",
      section: "S8",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "コースの距離や所要時間の目安は妥当でしたか。",
      when: courseWalker,
    },
    {
      id: "course_order",
      section: "S8",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "寄る場所の順番や選び方に納得できましたか。",
      when: courseWalker,
    },
    {
      id: "map_clarity",
      section: "S8",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "地図の見やすさはいかがですか。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "pin_accuracy",
      section: "S8",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      q: "地図上のピン（場所の位置）の正確さの体感は。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "pin_offset",
      section: "S8",
      type: "mc",
      required: true,
      q: "ピンが川の上・敷地の中など、明らかにずれていると感じたことは。",
      options: FREQ,
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "course_want",
      section: "S8",
      type: "ma",
      required: false,
      max: 3,
      q: "欲しいコースの種類は（最大3つ）。",
      options: [
        "より短い（10分以内）",
        "より長い",
        "雨の日向け",
        "夜向け",
        "子連れ",
        "写真向き",
        "寺社・神社多め",
        "商店・喫茶多め",
        "特にない",
      ],
      when: (a) => usedApp(a) && !isDormant(a),
    },
    // S9
    {
      id: "offline_fail",
      section: "S9",
      type: "mc",
      required: true,
      q: "電波が弱い場所・地下・車内などで、案内が開けない／失敗した経験は。",
      options: FREQ,
      when: (a) => usedApp(a) && !isDormant(a),
    },
    {
      id: "outdoor_unusable_feel",
      section: "S9",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      q: "「外では使えないアプリだ」と感じたことがありますか。",
      when: (a) => usedApp(a) && !isDormant(a),
    },
    // S10
    {
      id: "relation_now",
      section: "S10",
      type: "mc",
      required: true,
      q: "いまのあなたとアプリの関係に近いものは。",
      options: ["よく使う", "たまに使う", "しばらく使っていない（休眠）", "ほぼやめた"],
      when: usedApp,
    },
    {
      id: "retain_reason",
      section: "S10",
      type: "ma",
      required: true,
      max: 3,
      q: "続けている理由に近いもの（最大3つ）。",
      options: [
        "知らない駅に降りられる",
        "文章や雰囲気が好き",
        "声の案内が便利",
        "散歩の習慣になっている",
        "関西にいる／旅行で使う",
        "特に強い理由はない",
        "その他",
      ],
      when: (a) =>
        usedApp(a) &&
        (a.relation_now === "よく使う" || a.relation_now === "たまに使う"),
    },
    {
      id: "churn_reason",
      section: "S10",
      type: "ma",
      required: true,
      max: 3,
      q: "減った・やめた理由に近いもの（最大3つ）。",
      options: [
        "時間が無い",
        "歩ける駅が尽きた／新鮮さが減った",
        "文章が退屈・くどい",
        "不具合・誤案内が気になる",
        "怖さ・一人歩きの不安",
        "他の地図・ガイドで足りる",
        "関西を離れた／行く機会が減った",
        "コインや料金の負担感",
        "思い出してくれない（通知などがない）",
        "特にない",
        "その他",
      ],
      when: (a) =>
        usedApp(a) &&
        (a.relation_now === "しばらく使っていない（休眠）" ||
          a.relation_now === "ほぼやめた" ||
          isDormant(a)),
    },
    {
      id: "winback",
      section: "S10",
      type: "ma",
      required: true,
      max: 3,
      q: "また使いたくなるとしたら、何があれば近いですか（最大3つ）。",
      options: [
        "新しいエリア・駅の追加",
        "もっと短いコース",
        "声の案内の改善",
        "地図・ピンの正確さ",
        "歩いた記録やお気に入り",
        "オフラインでも安心",
        "特にない",
        "その他",
      ],
      when: (a) =>
        usedApp(a) &&
        (a.relation_now === "しばらく使っていない（休眠）" ||
          a.relation_now === "ほぼやめた" ||
          isDormant(a)),
    },
    {
      id: "feature_wish",
      section: "S10",
      type: "ma",
      required: false,
      max: 3,
      q: "今後あるとよいもの（優先したいものを最大3つ）。",
      options: [
        "他地方の駅",
        "お気に入り保存",
        "歩いた記録",
        "友人などへの共有",
        "ホーム画面ウィジェット",
        "Apple Watch",
        "オフライン強化",
        "声の種類を選べる",
        "超短時間コース",
        "季節の企画",
        "特にない",
      ],
      when: usedApp,
    },
    // S11
    {
      id: "privacy_location",
      section: "S11",
      type: "l5",
      scale: L5_GOOD,
      required: true,
      hint:
        "現在地は、端末の中で近い駅を探すために使います。このアンケートで移動記録の提出は求めません。",
      q: "位置情報の使われ方について、どのくらい安心できますか。",
      when: usedApp,
    },
    {
      id: "coin_fairness",
      section: "S11",
      type: "l5",
      scale: L5_AGREE,
      required: true,
      hint:
        "物語のゆかりなど一部は無料で、散歩道の案内を開くときにコインを使う、という使い方です（実施時点の説明）。",
      q: "コインや案内の開き方は、分かりやすく納得できますか。",
      when: usedApp,
    },
    {
      id: "pricing_pref",
      section: "S11",
      type: "mc",
      required: true,
      q: "仮定です。もし今後の料金形態を選ぶとしたら、近いものはどれですか。",
      options: [
        "今のまま（コイン等）でよい",
        "買い切りで追加課金を減らしたい",
        "月額など定額でもよい",
        "もっと無料範囲を広げてほしい",
        "分からない・関心がない",
      ],
      when: usedApp,
    },
    {
      id: "harm_from_error",
      section: "S11",
      type: "mc",
      required: true,
      q: "不正確な案内で困った、または危険を感じたことはありますか。",
      options: FREQ,
      when: usedApp,
    },
    // S12
    {
      id: "nps",
      section: "S12",
      type: "nps",
      required: true,
      q: "親しい人に見知らぬ駅を勧めるとしたら、0（勧めたくない）〜10（ぜひ勧めたい）のどれですか。",
      when: usedApp,
    },
    {
      id: "nps_reason",
      section: "S12",
      type: "oe",
      required: true,
      q: "その点数にした主な理由を、一言で。",
      when: usedApp,
    },
    {
      id: "improve_top",
      section: "S12",
      type: "ma",
      required: true,
      max: 3,
      q: "改善してほしいこと（優先したいものを最大3つ）。",
      options: [
        "声の案内（間・速さ・安定・誤読）",
        "地図・ピンの位置",
        "文章の質・量・信頼",
        "駅の探し方・現在地",
        "コースの種類・長さ",
        "屋外・通信での安定",
        "対応エリアの拡大",
        "コイン・料金",
        "チュートリアル・分かりやすさ",
        "特にない",
        "その他",
      ],
      when: usedApp,
    },
    {
      id: "do_not_remove",
      section: "S12",
      type: "ma",
      required: true,
      max: 3,
      q: "今後バージョンが変わっても、消さないでほしい・変えないでほしいもの（最大3つ）。",
      options: [
        "知らない駅に降りる体験そのもの",
        "文章の雰囲気・トーン",
        "声の案内",
        "ナビの線を引かない歩き方",
        "アカウント不要",
        "物語のゆかり",
        "特にない",
        "その他",
      ],
      when: usedApp,
    },
    {
      id: "closing_oe",
      section: "S12",
      type: "oe",
      required: false,
      q: "最後に、一言あれば。",
      // depth_use が決まってから末尾に出す（最初から一覧に混ぜない）
      when: (a) => Boolean(a.depth_use),
    },
  ];

  function usedApp(a) {
    return (
      a.depth_use === "駅を開いて、歩いたこともある" ||
      a.depth_use === "駅は開いたが、あまり歩いていない"
    );
  }
  function isDormant(a) {
    return a.recent_use === "いいえ（開いていない）";
  }
  function voiceUser(a) {
    return (
      usedApp(a) &&
      !isDormant(a) &&
      ["よく聴く", "ときどき聴く", "試した程度"].includes(a.voice_use)
    );
  }
  function courseWalker(a) {
    return (
      usedApp(a) &&
      !isDormant(a) &&
      ["よく歩く", "ときどき歩く", "試した程度"].includes(a.course_use)
    );
  }

  const answers = {};
  let stepIds = [];
  let idx = 0;
  const screen = document.getElementById("screen");
  const progressEl = document.getElementById("progress");

  function activeQuestions() {
    return QUESTIONS.filter((q) => !q.when || q.when(answers));
  }

  function rebuildStepsFrom(fromId) {
    const all = activeQuestions();
    const start = all.findIndex((q) => q.id === fromId);
    const head = stepIds.slice(0, Math.max(0, stepIds.indexOf(fromId)));
    const tail = all.slice(start < 0 ? 0 : start).map((q) => q.id);
    // keep answered prefix, replace from current
    const curPos = stepIds.indexOf(fromId);
    stepIds = (curPos >= 0 ? stepIds.slice(0, curPos) : head).concat(tail);
    // unique preserve order
    const seen = new Set();
    stepIds = stepIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function currentQ() {
    const id = stepIds[idx];
    return QUESTIONS.find((q) => q.id === id);
  }

  function render() {
    const q = currentQ();
    if (!q) {
      submitAll();
      return;
    }
    progressEl.hidden = false;
    progressEl.textContent = `${idx + 1} / ${stepIds.length}`;

    if (q.type === "intro") {
      screen.innerHTML = `
        <div class="card">
          <p class="lead">${escapeHtml(q.body)}</p>
          <div class="actions">
            <button type="button" class="primary" id="next">はじめる</button>
          </div>
        </div>`;
      document.getElementById("next").onclick = () => {
        idx += 1;
        render();
      };
      return;
    }

    let body = "";
    if (q.hint) body += `<p class="hint">${escapeHtml(q.hint)}</p>`;

    if (q.type === "mc" || q.type === "ma") {
      const multi = q.type === "ma";
      body += `<div class="opts">`;
      for (const opt of q.options) {
        const checked =
          multi && Array.isArray(answers[q.id])
            ? answers[q.id].includes(opt)
            : answers[q.id] === opt;
        body += `<label class="opt"><input type="${multi ? "checkbox" : "radio"}" name="a" value="${escapeAttr(opt)}" ${checked ? "checked" : ""}/><span>${escapeHtml(opt)}</span></label>`;
      }
      body += `</div>`;
      if (multi && q.max) body += `<p class="hint">最大 ${q.max} つまで。</p>`;
    } else if (q.type === "l5") {
      body += `<div class="scale">`;
      (q.scale || L5_AGREE).forEach((label, i) => {
        const val = String(i + 1);
        const checked = String(answers[q.id] || "") === val;
        body += `<label><input type="radio" name="a" value="${val}" ${checked ? "checked" : ""}/>${i + 1}<br/><span style="font-size:0.65rem;color:#6a6258">${escapeHtml(label.replace(/^\d\s/, "").slice(0, 6))}</span></label>`;
      });
      body += `</div><p class="hint">${escapeHtml((q.scale || L5_AGREE).join(" · "))}</p>`;
    } else if (q.type === "nps") {
      body += `<div class="nps">`;
      for (let i = 0; i <= 10; i++) {
        const checked = String(answers[q.id] ?? "") === String(i);
        body += `<label><input type="radio" name="a" value="${i}" ${checked ? "checked" : ""}/>${i}</label>`;
      }
      body += `</div>`;
    } else if (q.type === "oe") {
      body += `<textarea id="oe" placeholder="自由にご記入ください">${escapeHtml(answers[q.id] || "")}</textarea>`;
    }

    screen.innerHTML = `
      <div class="card">
        <p class="q">${escapeHtml(q.q)}</p>
        ${body}
        <p class="err" id="err" hidden></p>
        <div class="actions">
          <button type="button" id="back" ${idx === 0 ? "disabled" : ""}>戻る</button>
          <button type="button" class="primary" id="next">${idx >= stepIds.length - 1 ? "送信する" : "つぎへ"}</button>
        </div>
      </div>`;

    document.getElementById("back").onclick = () => {
      if (idx > 0) {
        idx -= 1;
        render();
      }
    };
    document.getElementById("next").onclick = () => advance(q);
  }

  function readValue(q) {
    if (q.type === "oe") {
      return (document.getElementById("oe")?.value || "").trim();
    }
    if (q.type === "ma") {
      return [...document.querySelectorAll('input[name="a"]:checked')].map(
        (el) => el.value,
      );
    }
    const el = document.querySelector('input[name="a"]:checked');
    return el ? el.value : "";
  }

  function advance(q) {
    const err = document.getElementById("err");
    const val = readValue(q);
    if (q.required) {
      if (q.type === "ma" && (!Array.isArray(val) || val.length === 0)) {
        err.hidden = false;
        err.textContent = "ひとつ以上選んでください。";
        return;
      }
      if (q.type !== "ma" && (val === "" || val == null)) {
        err.hidden = false;
        err.textContent = "回答を選ぶか、記入してください。";
        return;
      }
    }
    if (q.type === "ma" && q.max && Array.isArray(val) && val.length > q.max) {
      err.hidden = false;
      err.textContent = `最大 ${q.max} つまでにしてください。`;
      return;
    }

    answers[q.id] = val;

    // early exits
    if (q.id === "screen_app" && val !== "はい、見知らぬ駅です") {
      showDone("対象外のため終了しました。ご協力ありがとうございました。");
      return;
    }
    if (q.id === "consent" && val !== "同意する") {
      showDone("同意いただけないため終了しました。");
      return;
    }

    // rebuild path after branching answers
    if (
      ["recent_use", "depth_use", "voice_use", "course_use", "relation_now", "did_alight"].includes(
        q.id,
      )
    ) {
      const nextList = activeQuestions().map((x) => x.id);
      const cur = stepIds[idx];
      const keep = stepIds.slice(0, idx + 1);
      const rest = nextList.slice(nextList.indexOf(cur) + 1);
      stepIds = keep.concat(rest.filter((id) => !keep.includes(id)));
    }

    if (idx >= stepIds.length - 1) {
      submitAll();
      return;
    }
    idx += 1;
    // skip questions that no longer apply
    while (idx < stepIds.length) {
      const nq = currentQ();
      if (!nq || !nq.when || nq.when(answers)) break;
      idx += 1;
    }
    if (idx >= stepIds.length) {
      submitAll();
      return;
    }
    render();
  }

  async function submitAll() {
    screen.innerHTML = `<div class="card"><p class="lead">送信しています…</p></div>`;
    try {
      const res = await fetch("./submit.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "send_failed");
      }
      showDone(
        "送信しました。ご協力ありがとうございました。回答は匿名で、アプリの改善に使います。",
        data.id,
      );
    } catch (e) {
      screen.innerHTML = `
        <div class="card">
          <p class="lead">送信に失敗しました。通信状況をみて、もう一度どうぞ。</p>
          <p class="err">${escapeHtml(String(e.message || e))}</p>
          <div class="actions">
            <button type="button" class="primary" id="retry">再送信</button>
          </div>
        </div>`;
      document.getElementById("retry").onclick = submitAll;
    }
  }

  function showDone(msg, id) {
    progressEl.hidden = true;
    screen.innerHTML = `
      <div class="card done">
        <h2>完了</h2>
        <p class="lead">${escapeHtml(msg)}</p>
        ${id ? `<p class="hint">受付番号: ${escapeHtml(id)}</p>` : ""}
      </div>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  // init
  stepIds = activeQuestions().map((q) => q.id);
  render();
})();
