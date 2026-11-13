import Foundation

/// Web `mishiranu-area-depth.ts` の正本厚み。保存済み駅でもいまと歴史を結んだ文に揃える。
enum AreaDepth {
    private struct Depth {
        var stationIntro: String?
        var areaAbout: String?
        var walkGuide: String?
        var historyNotes: [HistoryNote]?
        var sightseeingNotes: [HistoryNote]?
        var storyNotes: [HistoryNote]?
    }

    private static let byBareName: [String: Depth] = [
        "出町柳": .init(
            stationIntro:
                "京阪本線と叡山電鉄が隣り合う、鴨川デルタのたもと。叡電側は大正14年（1925年）、京都電燈の鞍馬線として出町柳付近が開業し、北山へ向かう山の線の起点になりました。京阪側は平成元年（1989年）、鴨東線（三条〜出町柳）の開業で地下駅が置かれ、都心・大阪方面と叡電が隣り合う結節点になりました。いま地下の京阪から地上の叡電へ乗り換える駅で、甘いものの匂いと水音、自転車の群れが同じ半径にあります。観光の起点にも、日常の寄り道にもなります。",
            areaAbout: nil,
            walkGuide:
                "京阪は5番出口から鴨川デルタの合流を通り、出町橋を西へ渡って枡形商店街へ。時間があるときは北の並木から下鴨へ。東は百万遍・京都大学方面。南西の同志社大学へは、相国寺の中を通っていく（最短の南回りより境内の方が土地らしい）。食べ物は駅前で買って、鴨川デルタで食べるのがおすすめです。",
            historyNotes: [
                .init(
                    title: "「出町」の名",
                    body: "京の都の外縁に「出た町」としてひらけた地名で、御所の北側・今出川あたりから先の町場を指し、市や人の出入りの場として長く使われてきました。駅名の「柳」は川端の風景と結びついた語感でもあり、いま枡形を歩くと、用事と寄り道が同じ道幅で行き交うその外縁の役割が、言葉より先に体でわかります。"
                ),
                .init(
                    title: "鴨川デルタと二つの川",
                    body: "西側の上流を賀茂川、東側を高野川と呼び、合流点から南は鴨川になります。三角州のような地形は治水と信仰の両方に関わり、下鴨の森へ続く景色の入口でもありました。いまベンチや水遊びの人が居るのも同じ三角で、水音の向きを聞けばどちらの川に近いかが体でわかります。"
                ),
                .init(
                    title: "枡形商店街と鯖街道",
                    body: "枡形商店街は、鯖街道（若狭街道）の京都側の終点・着き口として知られます。若狭の塩鯖が都へ入る最後の町場だった距離感が、短いアーケードの幅に残っています。買う・食べる・通り過ぎるが同じ道で起きるのは昔の着き口の続きで、甘いものの匂いはいまの出町の顔です。"
                ),
                .init(
                    title: "下鴨と糺の森",
                    body: "北方の下鴨神社（賀茂御祖神社）と糺の森は、古くからこの土地の聖域で、世界遺産「古都京都の文化財」の一部です。参道の木立は駅からも気配が届き、半日コースの芯になるのも、聖域が日常の北の方角として残っているからです。"
                ),
                .init(
                    title: "京都大学と通学の東",
                    body: "東の百万遍・吉田に広がる京都大学は、近代以降に厚くなった学びの層です。キャンパスは駅のすぐ隣ではありませんが、学生の自転車・古本・喫茶の流れが駅前と川端まで届き、出町から見て「東＝学び」の方角がいまでも空気を決めています。"
                ),
                .init(
                    title: "同志社大学と今出川",
                    body: "南西の今出川に同志社大学のキャンパスがあり、烏丸今出川まわりの通学路が近代の学問都市の骨格を支えてきました。その流れは出町側の川端や定食屋の客層にもつながり、乗り換え客と学生が同じベンチを分け合う景色になっています。"
                ),
            ],
            sightseeingNotes: [
                .init(
                    title: "鴨川デルタ",
                    body: "鴨川デルタです。京阪5番出口を出てすぐ北〜東の合流の三角へ歩けます（徒歩約2〜3分）。賀茂川と高野川が一つになる縁で、水音と空が開けます。食べ物は駅前で買って、ここで食べるのが定番です。"
                ),
                .init(
                    title: "枡形商店街",
                    body: "枡形商店街です。5番出口からデルタの合流を通り、出町橋を西へ渡ると短いアーケードに入ります（徒歩約5分）。買う・食べる・通り過ぎるが同じ道幅で起きます。"
                ),
                .init(
                    title: "下鴨神社・糺の森",
                    body: "下鴨神社（賀茂御祖神社）と糺の森です。駅から北の並木・参道へ進み、徒歩15〜20分ほど。木立の参道が続き、半日コースの北の芯になります。"
                ),
                .init(
                    title: "相国寺",
                    body: "相国寺です。同志社・今出川へ向かうとき、境内の木立を東西に通る寄り道になります（駅から南西へ徒歩10分前後）。最短の南回りより、こちらが土地らしい通り方です。"
                ),
            ]
        ),
        "中書島": .init(
            stationIntro:
                "京阪本線と宇治線が分かれる、伏見の結節点。京阪の中書島駅は大正3年（1914年）に開業し、水路と町場のあいだに駅が置かれました。のちに宇治線が分岐し、本線と宇治方面をここで分ける役割が厚くなりました。ホームを出るとすぐに御香宮の参道へ歩け、少し足を伸ばせば濠川の水面と酒蔵の入口が続きます。乗り換えの駅でありながら、水路と神社の気配が濃く、すでに伏見の中に立っている感覚があります。",
            areaAbout: nil,
            walkGuide:
                "駅を出たらまず御香宮で方角と香りの伝説を押さえ、そのあと濠川へ下りると伏見の水路がわかりやすいです。半日あるなら閘門方面か酒蔵入口まで伸ばし、食べる・土産は帰り道の駅前でまとめると荷物が軽く済みます。",
            historyNotes: [
                .init(
                    title: "中書島の名",
                    body: "秀吉家臣・松村対馬守（中書）が居を構えたことに由来する地名とされ、島の字は水路に囲まれた土地の記憶です。地名そのものが地形説明になっており、いま駅前から水面を見下ろすと、その「島」の感覚がいまでも先に来ます。"
                ),
                .init(
                    title: "水運と伏見",
                    body: "宇治川派流・濠川は伏見の物流を支えた水路で、物資と酒が水面を行き来した時代の延長に、いまの十石舟や蔵の景観があります。岸の石積みを見ると観光の装飾より土木の実用が先に見え、歩く足がそのまま水運の跡を踏む感じです。"
                ),
                .init(
                    title: "御香宮と「香の水」",
                    body: "御香宮神社は芳しい水の伝説で知られる古社で、伏見の名の由来にも重ねて語られてきました。駅からすぐの距離に「水の町」の入口が開き、参道の石灯籠と境内の静けさは、乗り換え客の一休みにもちょうどよいいまの距離感です。"
                ),
                .init(
                    title: "酒造の手前",
                    body: "伏見の酒蔵めぐりの本場は桃山寄りにもう少し先へ広がってきましたが、中書島はその手前で呼吸を整える場所として残っています。粕漬けや小瓶の土産をここで見つけてから蔵の町へ入ると、歩くテンポが急ぎすぎません。"
                ),
            ],
            sightseeingNotes: [
                .init(
                    title: "駅から徒歩すぐ・北",
                    body: "御香宮神社です。改札を出て北の参道へ入ると、石灯籠と境内が続きます。伏見の入口として最初に立ち寄りやすい場所です。"
                ),
                .init(
                    title: "駅から水路へ",
                    body: "濠川の岸です。駅から少し歩くと水面と石積みが見えます。十石舟が通ることもあり、伏見の水路が体でわかります。"
                ),
                .init(
                    title: "食べる・休むの目安",
                    body: "昼は駅前の定食やうどん、休みは御香宮の境内の木陰が使いやすいです。酒蔵方面へ足を延ばすなら、帰りは別の京阪駅も使えます。"
                ),
            ]
        ),
        "二ノ瀬": .init(
            stationIntro:
                "叡山電鉄鞍馬線の山あいの無人駅。昭和初期（1928〜29年ごろ）に北山へ人を運ぶ線が敷かれ、二ノ瀬はその途中の停留所として置かれました。終着の観光駅ではなく、谷の呼吸を整える中間の駅です。ホームに立つと、すぐに川と木立の気配がまわり、電車の合間の静けさが案内の入口になります。短い滞在でも「余白の駅」であることが体でわかります。",
            areaAbout: nil,
            walkGuide:
                "駅を出たらまず二ノ瀬川の水音で方角をとり、短い滞在なら駅前の山道を往復するだけで十分です。時間があるときは北の貴船神社まで石段と川沿いをたどります。食べる・休むは貴船側か、電車で一駅動いてからでも遅くありません。",
            historyNotes: [
                .init(
                    title: "叡電の山あい",
                    body: "叡山電鉄鞍馬線は、京都の北山へ人を運ぶための細い線として敷かれました。二ノ瀬はその途中の無人駅として残り、観光の終着ではなく谷の呼吸を整える停留所の役割を持っています。列車が去ったあとの静けさが、いまもこの駅の歴史の感触です。"
                ),
                .init(
                    title: "二ノ瀬川の気配",
                    body: "駅のすぐそばを流れる渓流が、長いあいだ土地の骨格でした。治水の大きな話や広い河川敷はなく、水音そのものが方角と距離感を教え、ホームから川へ視線を落とすだけで山あいの駅だとわかります。耳が先の案内は、いまでも変わりません。"
                ),
                .init(
                    title: "貴船への道",
                    body: "北の貴船神社までは徒歩でおよそ30〜40分。石段と川沿いが続き、参拝は境内に着く前から始まる道筋です。二ノ瀬は貴船口の手前で一度息を整える場所として残っており、急がずに歩くと谷の濃さが体に残ります。"
                ),
                .init(
                    title: "無人駅の層",
                    body: "改札のないホーム、少ない本数、通り過ぎるだけの時間は、山あいの鉄道が残した運用の形です。用事のなさが景色になっており、観光情報を厚くしすぎない方が土地に合います。電車の時刻表が、いまもいちばん実用的な案内板です。"
                ),
            ],
            sightseeingNotes: [
                .init(
                    title: "ホームのすぐそば",
                    body: "二ノ瀬川です。ホームを出ると渓流と木立がすぐ目の前にあります。短い滞在なら、ここで水音を聞いて戻っても十分です。"
                ),
                .init(
                    title: "北へ徒歩30〜40分",
                    body: "貴船神社です。川沿いと石段を北へ進みます。本宮までの道が長く、時間があるときの行き先になります。"
                ),
                .init(
                    title: "食べる・休むの目安",
                    body: "駅前に定番の食堂はほとんどありません。食べる・休むは貴船側の川床や茶店、または電車で一駅動いてから探す方が現実的です。"
                ),
            ]
        ),
    ]

    private static let demachiFoodAtDelta =
        "食べ物は駅前で買って、鴨川デルタで食べるのがおすすめです。"

    /// 出町柳: 枡形へ先に行ってからデルタ、の旧順を正す。
    static func isWrongDemachiWalkOrder(_ text: String) -> Bool {
        guard text.contains("枡形"), text.contains("デルタ") else { return false }
        if text.range(of: #"枡形商店街へ[。．]?\s*その足で.*デルタ"#, options: .regularExpression) != nil {
            return true
        }
        if text.range(of: #"デルタを通|デルタの合流を通|デルタで.*枡形|デルタ.*枡形"#, options: .regularExpression) == nil {
            if let iMasu = text.range(of: "枡形")?.lowerBound,
               let iDelta = text.range(of: "デルタ")?.lowerBound,
               iMasu < iDelta {
                return true
            }
        }
        return false
    }

    /// 「駅前で済ませて川端へ」など旧い食べ方を、駅前で買ってデルタで食べる、に直す。
    static func scrubDemachiWalkFood(_ text: String) -> String {
        var next = text
        if next.contains("駅前で済ませて") || next.contains("川端へ持って") {
            if let re = try? NSRegularExpression(
                pattern: #"食べるものは駅前で済ませて[^。]*。|食べ物は駅前で済ませて[^。]*。"#,
                options: []
            ) {
                let range = NSRange(next.startIndex..<next.endIndex, in: next)
                next = re.stringByReplacingMatches(
                    in: next, options: [], range: range, withTemplate: demachiFoodAtDelta
                )
            }
            if let re2 = try? NSRegularExpression(pattern: #"川端へ持っていくと[^。]*。"#, options: []) {
                let range = NSRange(next.startIndex..<next.endIndex, in: next)
                next = re2.stringByReplacingMatches(
                    in: next, options: [], range: range, withTemplate: ""
                )
            }
        }
        let hasDeltaEat = next.contains("デルタで食べ") || next.contains("デルタへ持")
            || next.contains("袋のまま") || next.contains("駅前で買って")
        if !hasDeltaEat {
            next = next.trimmingCharacters(in: .whitespacesAndNewlines) + demachiFoodAtDelta
        }
        return next
            .replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func overlay(on station: Station) -> Station {
        let bare = SavedStationStore.bareName(station.name)
        // 完全一致のみ。`key.contains(bare)` は短い駅名や空文字で出町柳に吸われるので禁止。
        let withDepth: Station = {
            guard let depth = byBareName[bare]
                    ?? byBareName.first(where: { key, _ in
                        key.count >= 3 && bare.count >= key.count && bare.contains(key)
                    })?.value
            else { return station }

            return Station(
                id: station.id,
                name: station.name,
                nameReading: station.nameReading,
                line: station.line,
                prefecture: station.prefecture,
                region: station.region,
                mood: station.mood,
                radiiKm: station.radiiKm,
                stationIntro: depth.stationIntro ?? station.stationIntro,
                areaAbout: {
                    // 正本に historyNotes が厚いときは概観を残さない（二重読み防止）
                    if let notes = depth.historyNotes, notes.count >= 2 { return nil }
                    return depth.areaAbout ?? station.areaAbout
                }(),
                // 歩き方は AI 解析を優先。空／旧順のときだけ正本。食べ方はデルタ定番へ
                walkGuide: {
                    let ai = (station.walkGuide ?? "")
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    let pick: String? = {
                        if !ai.isEmpty, !Self.isWrongDemachiWalkOrder(ai) { return ai }
                        return depth.walkGuide ?? station.walkGuide
                    }()
                    guard let pick, !pick.isEmpty else { return pick }
                    return Self.scrubDemachiWalkFood(pick)
                }(),
                historyNotes: depth.historyNotes ?? station.historyNotes,
                // 寄るところ: 出町など正本カードがある駅は具体を優先
                sightseeingNotes: {
                    let bare = SavedStationStore.bareName(station.name)
                    let preferDepth = bare.contains("出町柳") || station.name.contains("出町柳")
                    if preferDepth, let depthNotes = depth.sightseeingNotes, !depthNotes.isEmpty {
                        return depthNotes
                    }
                    if !station.sightseeingNotes.isEmpty { return station.sightseeingNotes }
                    return depth.sightseeingNotes ?? station.sightseeingNotes
                }(),
                storyNotes: {
                    let fromDepth = depth.storyNotes ?? []
                    return fromDepth.isEmpty ? station.storyNotes : fromDepth
                }(),
                bikeRental: station.bikeRental,
                tourTitle: station.tourTitle,
                catchCopy: station.catchCopy,
                emptyCopy: station.emptyCopy,
                railHint: station.railHint,
                lat: station.lat,
                lng: station.lng,
                spots: station.spots,
            atmosphereCorridors: station.atmosphereCorridors
            )
        }()
        // 物語のゆかりは駅横断の正本を最後に載せる（出町・石清水・尾道など）
        return StoryNotesCanon.overlay(on: withDepth)
    }
}
