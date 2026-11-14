import SwiftUI

/// ホームページ（orikata）紹介を、アプリ内のページ分けチュートリアルにしたもの。
struct TutorialPage: View {
    var onFinished: (() -> Void)? = nil
    /// 設定から開いたときは閉じるボタン、初回は「はじめる」。
    var finishLabel: String = "はじめる"

    @Environment(\.dismiss) private var dismiss
    @State private var page = 0

    private let pages = TutorialCopy.pages

    private func finish() {
        if let onFinished {
            onFinished()
        } else {
            dismiss()
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer(minLength: 0)
                if onFinished != nil, page < pages.count - 1 {
                    Button {
                        finish()
                    } label: {
                        Text("×")
                            .font(.system(size: 22, weight: .regular))
                            .foregroundStyle(Palette.mist)
                            .frame(minWidth: 32, minHeight: 32)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("とばす")
                    .padding(.trailing, 2)
                }
            }
            .frame(height: 36)
            .padding(.horizontal, 20)
            .padding(.top, 8)

            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
                    TutorialSlide(page: item, isLast: index == pages.count - 1)
                        .tag(index)
                        .padding(.horizontal, 20)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut(duration: 0.22), value: page)

            pageDots
                .padding(.top, 10)
                .padding(.bottom, 8)

            bottomBar
                .padding(.horizontal, 20)
                .padding(.bottom, 18)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.canvas.ignoresSafeArea())
        // fullScreenCover 既定の白背景が左上に欠けるのを防ぐ
        .presentationBackground(Palette.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if onFinished == nil {
                ToolbarItem(placement: .principal) {
                    Text("見知らぬ駅について")
                        .font(.mincho(.headline, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                }
            }
        }
    }

    private var pageDots: some View {
        HStack(spacing: 7) {
            ForEach(0..<pages.count, id: \.self) { i in
                Capsule()
                    .fill(i == page ? Palette.warm : Palette.line)
                    .frame(width: i == page ? 16 : 7, height: 7)
                    .animation(.easeInOut(duration: 0.18), value: page)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("ページ \(page + 1) / \(pages.count)")
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            if page > 0 {
                Button {
                    withAnimation { page -= 1 }
                } label: {
                    Text("戻る")
                        .font(.readable(.callout, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Palette.line, lineWidth: 1)
                        )
                }
                .buttonStyle(PlainHapticButtonStyle())
                .fixedSize(horizontal: true, vertical: false)
                .accessibilityLabel("戻る")
            }

            Button {
                if page >= pages.count - 1 {
                    finish()
                } else {
                    withAnimation { page += 1 }
                }
            } label: {
                Text(page >= pages.count - 1 ? finishLabel : "つぎへ")
                    .font(.readable(.body, weight: .semibold))
                    .foregroundStyle(Palette.paper)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Palette.warm)
                    )
            }
            .buttonStyle(PlainHapticButtonStyle())
        }
    }
}

// MARK: - Slide

private struct TutorialSlide: View {
    let page: TutorialCopy.Page
    let isLast: Bool

    private var contentAlignment: Alignment {
        page.showBrand ? .center : .leading
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: page.showBrand ? .center : .leading, spacing: 16) {
                    if let kicker = page.kicker {
                        Text(kicker)
                            .font(.readable(.caption, weight: .semibold))
                            .tracking(2)
                            .foregroundStyle(Palette.warm)
                            .frame(maxWidth: .infinity, alignment: contentAlignment)
                    }

                    if page.showBrand {
                        Text("見知らぬ駅")
                            .font(.system(size: 34, weight: .medium, design: .serif))
                            .tracking(10)
                            .foregroundStyle(Palette.ink)
                            .frame(maxWidth: .infinity)
                    }

                    if !page.verseLines.isEmpty {
                        CommuteVerseView(
                            lines: page.verseLines,
                            motion: page.verseMotion
                        )
                        .padding(.top, 4)
                    } else {
                        Text(page.title)
                            .font(.mincho(.title2, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: contentAlignment)
                            .multilineTextAlignment(page.showBrand ? .center : .leading)

                        if let quote = page.quote {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(quote)
                                    .font(.mincho(.body))
                                    .foregroundStyle(Palette.ink)
                                    .lineSpacing(6)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let quoteBy = page.quoteBy {
                                    Text(quoteBy)
                                        .font(.readable(.caption))
                                        .foregroundStyle(Palette.mist)
                                        .frame(maxWidth: .infinity, alignment: .trailing)
                                }
                            }
                            .padding(.leading, 14)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .overlay(alignment: .leading) {
                                Rectangle()
                                    .fill(Palette.warm.opacity(0.55))
                                    .frame(width: 2)
                            }
                        }

                        ForEach(Array(page.bodies.enumerated()), id: \.offset) { _, body in
                            Text(body)
                                .font(.readable(.body))
                                .foregroundStyle(Palette.fog)
                                .lineSpacing(5)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: contentAlignment)
                                .multilineTextAlignment(page.showBrand ? .center : .leading)
                        }
                    }

                    if let imageName = page.imageName {
                        Image(imageName)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .stroke(Palette.line, lineWidth: 1)
                            )
                            .shadow(color: .black.opacity(0.08), radius: 12, y: 6)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 4)
                            .accessibilityLabel(page.imageAlt ?? "")
                    }

                    if !page.steps.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(page.steps.enumerated()), id: \.offset) { i, step in
                                HStack(alignment: .top, spacing: 12) {
                                    Text(String(format: "%02d", i + 1))
                                        .font(.mincho(.callout, weight: .semibold))
                                        .foregroundStyle(Palette.warm)
                                        .frame(width: 28, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(step.title)
                                            .font(.mincho(.body, weight: .semibold))
                                            .foregroundStyle(Palette.ink)
                                        Text(step.body)
                                            .font(.readable(.callout))
                                            .foregroundStyle(Palette.fog)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                            }
                        }
                        .padding(.top, 4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if isLast {
                        Image("tutorial-icon")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .frame(maxWidth: .infinity)
                            .padding(.top, 8)
                            .accessibilityHidden(true)
                    }
                }
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: contentAlignment)
                // 収まるページは縦中央。長いページは minHeight でスクロール可のまま。
                .frame(minHeight: geo.size.height, alignment: .center)
            }
            .scrollIndicators(.hidden)
        }
    }
}

// MARK: - トップ縦書き（採用: 4 · 窓の通過）

private struct CommuteVerseView: View {
    let lines: [String]
    var motion: TutorialCopy.VerseMotion = .window

    @State private var revealed: [Bool] = []

    private func isOn(_ index: Int) -> Bool {
        revealed.indices.contains(index) && revealed[index]
    }

    var body: some View {
        // 縦書き：列は右→左、字は上→下
        HStack(alignment: .top, spacing: 22) {
            ForEach(Array(lines.enumerated().reversed()), id: \.offset) { index, line in
                VStack(spacing: 3) {
                    ForEach(Array(line.enumerated()), id: \.offset) { _, ch in
                        Text(String(ch))
                            .font(.system(size: 17, weight: .medium, design: .serif))
                            .foregroundStyle(Palette.ink)
                    }
                }
                .opacity(isOn(index) ? 1 : 0)
                .blur(radius: isOn(index) ? 0 : 2.5)
                .offset(x: isOn(index) ? 0 : 10)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(line)
            }
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            revealed = Array(repeating: false, count: lines.count)
            // Web の「2 · 文字ごと」と同じ速度（開始0.28 · 列間隔1.55 · 列の長さ1.65）
            for i in lines.indices {
                let delay = 0.28 + Double(i) * 1.55
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    withAnimation(.easeInOut(duration: 1.65)) {
                        if revealed.indices.contains(i) {
                            revealed[i] = true
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Copy（ホームページ orikata と同趣旨）

enum TutorialCopy {
    enum VerseMotion: Equatable {
        case curtain
        case window
        case lines
        case chars
    }

    struct Step: Equatable {
        var title: String
        var body: String
    }

    struct Page: Equatable {
        var kicker: String?
        var title: String
        var bodies: [String]
        var quote: String? = nil
        var quoteBy: String? = nil
        var imageName: String? = nil
        var imageAlt: String? = nil
        var steps: [Step] = []
        var showBrand: Bool = false
        var verseLines: [String] = []
        var verseMotion: VerseMotion = .curtain
    }

    static let pages: [Page] = [
        Page(
            kicker: nil,
            title: "知らない駅に降りてみる",
            bodies: [],
            showBrand: false,
            verseLines: [
                "夜の京阪電車",
                "淀屋橋駅で特急の一番前運転席の反対側に座る",
                "駅が通過していき街の明かりが流れていく",
            ],
            verseMotion: .window
        ),
        Page(
            kicker: nil,
            title: "知らない駅に降りてみる",
            bodies: [
                "名前だけ知っている駅に、私は降りる。",
                "名前だけのからっぽだった駅が、私の散歩道になる。",
            ],
            showBrand: true
        ),
        Page(
            kicker: "はじまり",
            title: "名前を知って、見なくなった駅",
            bodies: [
                "いつもは、その名前を読むだけで通り過ぎる。分かったつもりになって、降りない。",
                "名前だけが残り、その土地の姿を、私は一度も見ていない。駅は、私にとって存在しないもののようになっていました。",
            ],
            quote: "子どもに「あれは鳥だよ」と言葉を教えたその日から、子どもはもう、あの鳥を見なくなってしまいます。",
            quoteBy: "── ジッドゥ・クリシュナムルティ",
            showBrand: true
        ),
        Page(
            kicker: "なにができるか · 01",
            title: "ホームに、一度降りる",
            bodies: [
                "ドアが開く。知らない駅のホームに、私は一度降りる。次の電車まで、まだ少し時間がある。",
                "このアプリを開いて、いまいる駅を確かめる。まず届くのは、この土地にまつわる物語のゆかりがひとかけら。ここから、空っぽだった駅名が散歩道へと変わっていく。",
            ],
            imageName: "tutorial-arrive",
            imageAlt: "到着確認の画面",
            showBrand: true
        ),
        Page(
            kicker: "なにができるか · 02",
            title: "土地の案内を声で聴く",
            bodies: [
                "改札を出て、イヤホンをつける。散歩道の案内を開くと、この土地の成り立ちと、いまの空気を、声で読み上げてくれる。",
                "スマホはポケットにしまって、私は顔を上げる。聴いているうちに、ただの文字だった名前に、目の前の川や坂が重なっていく。",
            ],
            imageName: "tutorial-land",
            imageAlt: "土地の案内と読み上げ",
            showBrand: true
        ),
        Page(
            kicker: "なにができるか · 03",
            title: "歩いたところが、道になる",
            bodies: [
                "地図をひとつ確かめて、少し回り道をする。最短で急がなくてよい。橋や田畑の道、境内や川辺など、無駄に見える寄り道こそが、このアプリの魅力です。",
                "見たことがあるようで、見たことのない角を曲がり、駅へ戻る。歩いたぶんだけ、名前は散歩道になっていく。",
            ],
            imageName: "tutorial-map",
            imageAlt: "徒歩圏の地図と動線",
            showBrand: true
        ),
        Page(
            kicker: "使い方",
            title: "同じ名前が、違って見える",
            bodies: [
                "帰りの電車で、私はその駅名をもう一度読む。同じ名前なのに、もう空っぽではない。そこには、私の歩いた散歩道がある。",
            ],
            steps: [
                Step(title: "知らない駅に降りてみる", body: "現在地から探すか、気になっていた駅名を入れる。"),
                Step(title: "物語のゆかりを読む", body: "土地にまつわるひとかけらを読む。ここまでは無料。"),
                Step(title: "散歩道を開く", body: "コインを1枚使って、徒歩圏の散歩道の案内をつくる。一度つくった駅は端末に残り、開き直しにコインはいらない。"),
                Step(title: "聴きながら歩き、駅へ帰る", body: "土地の歴史と今を耳でたどり、無駄な寄り道をして同じ駅へ戻る。"),
            ],
            showBrand: true
        ),
    ]
}
