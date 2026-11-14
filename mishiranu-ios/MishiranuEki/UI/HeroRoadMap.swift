import SwiftUI

/// 採用: 観光地図地紋の「3 · 道網」。
/// 川は Web と同じ「控えめな風」（左右になびく・弱め）。位置は左9%・上33%・幅73%。
struct HeroRoadMap: View {
    private let ink = Color(hex: 0x2a241c)
    private let vw: CGFloat = 160
    private let period: TimeInterval = 7.5

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if reduceMotion {
                mapCanvas(phase: 0)
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
                    mapCanvas(phase: windPhase(at: context.date))
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func mapCanvas(phase: CGFloat) -> some View {
        GeometryReader { geo in
            let mapW = geo.size.width * 0.73
            let originX = geo.size.width * 0.09
            let originY = geo.size.height * 0.33
            let scale = mapW / vw
            Canvas { canvas, _ in
                canvas.translateBy(x: originX, y: originY)
                canvas.scaleBy(x: scale, y: scale)

                let bank = riverPath(phase: phase)
                canvas.stroke(
                    bank,
                    with: .color(ink.opacity(0.42)),
                    style: StrokeStyle(lineWidth: 1.15, lineCap: .round, lineJoin: .round)
                )

                for road in roadPaths() {
                    canvas.stroke(
                        road,
                        with: .color(ink.opacity(0.22)),
                        style: StrokeStyle(lineWidth: 1.35, lineCap: .square)
                    )
                }

                let station = CGRect(x: 92 - 3.5, y: 82 - 3.5, width: 7, height: 7)
                canvas.fill(Path(roundedRect: station, cornerRadius: 1), with: .color(Color(hex: 0xf8f5ee)))
                canvas.stroke(
                    Path(roundedRect: station, cornerRadius: 1),
                    with: .color(ink),
                    lineWidth: 1.2
                )
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
    }

    /// 0…1 周期。rest→left→rest→right→rest（Web SMIL と同じ）
    private func windPhase(at date: Date) -> CGFloat {
        let t = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: period) / period
        // keyTimes 0, 0.25, 0.5, 0.75, 1 → pose weights: 0=rest, -1=left, +1=right
        let ease = { (u: Double) -> Double in
            // approx cubic-bezier(0.45,0,0.55,1)
            let x = max(0, min(1, u))
            return x * x * (3 - 2 * x)
        }
        if t < 0.25 {
            let u = ease(t / 0.25)
            return CGFloat(-u) // rest → left
        }
        if t < 0.5 {
            let u = ease((t - 0.25) / 0.25)
            return CGFloat(-1 + u) // left → rest
        }
        if t < 0.75 {
            let u = ease((t - 0.5) / 0.25)
            return CGFloat(u) // rest → right
        }
        let u = ease((t - 0.75) / 0.25)
        return CGFloat(1 - u) // right → rest
    }

    private func riverPath(phase: CGFloat) -> Path {
        let rest = RiverPose.rest
        let lean = phase < 0 ? RiverPose.left : RiverPose.right
        let amount = abs(phase)
        let pose = RiverPose.lerp(rest, lean, amount)

        var p = Path()
        // 賀茂
        p.move(to: pose.westStart)
        p.addCurve(to: pose.westMid, control1: pose.westC1, control2: pose.westC2)
        p.addCurve(to: pose.westEnd, control1: pose.westC3, control2: pose.westC4)
        // 高野
        p.move(to: pose.eastStart)
        p.addCurve(to: pose.eastMid, control1: pose.eastC1, control2: pose.eastC2)
        p.addCurve(to: pose.eastEnd, control1: pose.eastC3, control2: pose.eastC4)
        // 鴨
        p.move(to: pose.southStart)
        p.addCurve(to: pose.southMid, control1: pose.southC1, control2: pose.southC2)
        p.addCurve(to: pose.southEnd, control1: pose.southC3, control2: pose.southC4)
        return p
    }

    private func roadPaths() -> [Path] {
        let segs: [(CGPoint, CGPoint)] = [
            (CGPoint(x: 2, y: 132), CGPoint(x: 158, y: 132)),
            (CGPoint(x: 34, y: 4), CGPoint(x: 34, y: 164)),
            (CGPoint(x: 142, y: 4), CGPoint(x: 142, y: 164)),
            (CGPoint(x: 88, y: 98), CGPoint(x: 88, y: 164)),
            (CGPoint(x: 6, y: 36), CGPoint(x: 48, y: 36)),
            (CGPoint(x: 6, y: 58), CGPoint(x: 50, y: 58)),
            (CGPoint(x: 6, y: 82), CGPoint(x: 52, y: 82)),
            (CGPoint(x: 6, y: 108), CGPoint(x: 54, y: 108)),
            (CGPoint(x: 100, y: 40), CGPoint(x: 140, y: 40)),
            (CGPoint(x: 98, y: 62), CGPoint(x: 144, y: 62)),
            (CGPoint(x: 96, y: 88), CGPoint(x: 146, y: 88)),
            (CGPoint(x: 100, y: 112), CGPoint(x: 148, y: 112)),
            (CGPoint(x: 18, y: 8), CGPoint(x: 18, y: 128)),
            (CGPoint(x: 46, y: 8), CGPoint(x: 46, y: 128)),
            (CGPoint(x: 108, y: 8), CGPoint(x: 108, y: 128)),
            (CGPoint(x: 128, y: 8), CGPoint(x: 128, y: 160)),
        ]
        return segs.map { a, b in
            var p = Path()
            p.move(to: a)
            p.addLine(to: b)
            return p
        }
    }
}

private struct RiverPose {
    var westStart, westC1, westC2, westMid, westC3, westC4, westEnd: CGPoint
    var eastStart, eastC1, eastC2, eastMid, eastC3, eastC4, eastEnd: CGPoint
    var southStart, southC1, southC2, southMid, southC3, southC4, southEnd: CGPoint

    static let rest = RiverPose(
        westStart: CGPoint(x: 52, y: 4), westC1: CGPoint(x: 50, y: 28), westC2: CGPoint(x: 52, y: 48),
        westMid: CGPoint(x: 56, y: 64), westC3: CGPoint(x: 60, y: 76), westC4: CGPoint(x: 64, y: 84),
        westEnd: CGPoint(x: 70, y: 90),
        eastStart: CGPoint(x: 148, y: 20), eastC1: CGPoint(x: 128, y: 34), eastC2: CGPoint(x: 108, y: 50),
        eastMid: CGPoint(x: 90, y: 68), eastC3: CGPoint(x: 82, y: 76), eastC4: CGPoint(x: 76, y: 84),
        eastEnd: CGPoint(x: 70, y: 90),
        southStart: CGPoint(x: 70, y: 90), southC1: CGPoint(x: 72, y: 108), southC2: CGPoint(x: 74, y: 126),
        southMid: CGPoint(x: 76, y: 144), southC3: CGPoint(x: 77, y: 154), southC4: CGPoint(x: 78, y: 160),
        southEnd: CGPoint(x: 80, y: 168)
    )

    static let left = RiverPose(
        westStart: CGPoint(x: 52, y: 4), westC1: CGPoint(x: 48, y: 28), westC2: CGPoint(x: 50, y: 48),
        westMid: CGPoint(x: 54, y: 64), westC3: CGPoint(x: 58, y: 76), westC4: CGPoint(x: 63, y: 84),
        westEnd: CGPoint(x: 70, y: 90),
        eastStart: CGPoint(x: 148, y: 20), eastC1: CGPoint(x: 126, y: 34), eastC2: CGPoint(x: 106, y: 50),
        eastMid: CGPoint(x: 88, y: 68), eastC3: CGPoint(x: 80, y: 76), eastC4: CGPoint(x: 75, y: 84),
        eastEnd: CGPoint(x: 70, y: 90),
        southStart: CGPoint(x: 70, y: 90), southC1: CGPoint(x: 70, y: 108), southC2: CGPoint(x: 72, y: 126),
        southMid: CGPoint(x: 74, y: 144), southC3: CGPoint(x: 76, y: 154), southC4: CGPoint(x: 77, y: 160),
        southEnd: CGPoint(x: 80, y: 168)
    )

    static let right = RiverPose(
        westStart: CGPoint(x: 52, y: 4), westC1: CGPoint(x: 52, y: 28), westC2: CGPoint(x: 54, y: 48),
        westMid: CGPoint(x: 58, y: 64), westC3: CGPoint(x: 62, y: 76), westC4: CGPoint(x: 65, y: 84),
        westEnd: CGPoint(x: 70, y: 90),
        eastStart: CGPoint(x: 148, y: 20), eastC1: CGPoint(x: 130, y: 34), eastC2: CGPoint(x: 110, y: 50),
        eastMid: CGPoint(x: 92, y: 68), eastC3: CGPoint(x: 84, y: 76), eastC4: CGPoint(x: 77, y: 84),
        eastEnd: CGPoint(x: 70, y: 90),
        southStart: CGPoint(x: 70, y: 90), southC1: CGPoint(x: 74, y: 108), southC2: CGPoint(x: 76, y: 126),
        southMid: CGPoint(x: 78, y: 144), southC3: CGPoint(x: 78, y: 154), southC4: CGPoint(x: 79, y: 160),
        southEnd: CGPoint(x: 80, y: 168)
    )

    static func lerp(_ a: RiverPose, _ b: RiverPose, _ t: CGFloat) -> RiverPose {
        let p = { (x: CGPoint, y: CGPoint) in
            CGPoint(x: x.x + (y.x - x.x) * t, y: x.y + (y.y - x.y) * t)
        }
        return RiverPose(
            westStart: p(a.westStart, b.westStart), westC1: p(a.westC1, b.westC1), westC2: p(a.westC2, b.westC2),
            westMid: p(a.westMid, b.westMid), westC3: p(a.westC3, b.westC3), westC4: p(a.westC4, b.westC4),
            westEnd: p(a.westEnd, b.westEnd),
            eastStart: p(a.eastStart, b.eastStart), eastC1: p(a.eastC1, b.eastC1), eastC2: p(a.eastC2, b.eastC2),
            eastMid: p(a.eastMid, b.eastMid), eastC3: p(a.eastC3, b.eastC3), eastC4: p(a.eastC4, b.eastC4),
            eastEnd: p(a.eastEnd, b.eastEnd),
            southStart: p(a.southStart, b.southStart), southC1: p(a.southC1, b.southC1), southC2: p(a.southC2, b.southC2),
            southMid: p(a.southMid, b.southMid), southC3: p(a.southC3, b.southC3), southC4: p(a.southC4, b.southC4),
            southEnd: p(a.southEnd, b.southEnd)
        )
    }
}
