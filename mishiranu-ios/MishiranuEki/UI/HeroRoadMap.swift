import SwiftUI

/// 採用: 観光地図地紋の「3 · 道網」。位置は左9%・上33%・幅73%。
struct HeroRoadMap: View {
    private let ink = Color(hex: 0x2a241c)
    private let vw: CGFloat = 160

    var body: some View {
        GeometryReader { geo in
            let mapW = geo.size.width * 0.73
            let originX = geo.size.width * 0.09
            let originY = geo.size.height * 0.33
            let scale = mapW / vw
            Canvas { context, _ in
                context.translateBy(x: originX, y: originY)
                context.scaleBy(x: scale, y: scale)

                var bank = riverPath()
                context.stroke(
                    bank,
                    with: .color(ink.opacity(0.42)),
                    style: StrokeStyle(lineWidth: 1.15, lineCap: .round, lineJoin: .round)
                )

                for road in roadPaths() {
                    context.stroke(
                        road,
                        with: .color(ink.opacity(0.22)),
                        style: StrokeStyle(lineWidth: 1.35, lineCap: .square)
                    )
                }

                let station = CGRect(x: 92 - 3.5, y: 82 - 3.5, width: 7, height: 7)
                context.fill(Path(roundedRect: station, cornerRadius: 1), with: .color(Color(hex: 0xf8f5ee)))
                context.stroke(
                    Path(roundedRect: station, cornerRadius: 1),
                    with: .color(ink),
                    lineWidth: 1.2
                )
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
        .accessibilityHidden(true)
    }

    private func riverPath() -> Path {
        var p = Path()
        // 賀茂
        p.move(to: CGPoint(x: 52, y: 4))
        p.addCurve(to: CGPoint(x: 56, y: 64), control1: CGPoint(x: 50, y: 28), control2: CGPoint(x: 52, y: 48))
        p.addCurve(to: CGPoint(x: 70, y: 90), control1: CGPoint(x: 60, y: 76), control2: CGPoint(x: 64, y: 84))
        // 高野
        p.move(to: CGPoint(x: 148, y: 20))
        p.addCurve(to: CGPoint(x: 90, y: 68), control1: CGPoint(x: 128, y: 34), control2: CGPoint(x: 108, y: 50))
        p.addCurve(to: CGPoint(x: 70, y: 90), control1: CGPoint(x: 82, y: 76), control2: CGPoint(x: 76, y: 84))
        // 鴨
        p.move(to: CGPoint(x: 70, y: 90))
        p.addCurve(to: CGPoint(x: 76, y: 144), control1: CGPoint(x: 72, y: 108), control2: CGPoint(x: 74, y: 126))
        p.addCurve(to: CGPoint(x: 80, y: 168), control1: CGPoint(x: 77, y: 154), control2: CGPoint(x: 78, y: 160))
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
