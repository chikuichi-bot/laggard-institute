import Foundation

/// 初めての土地案内に載せない場所（駐車場・施設名など）。
enum PlaceNoise {
    /// タイムズ・リパークなど、社名を含んでも観光ではない。
    static func isNoise(_ name: String) -> Bool {
        let n = name
        let tokens = [
            "製作所", "制作所", "工場", "工業", "金属", "鉄工", "有限会社", "株式会社",
            "自動車", "整備", "石油", "スタンド", "ATM", "銀行", "郵便局", "交番",
            "病院", "医院", "歯科", "薬局", "ドラッグ", "コンビニ", "スーパー",
            "コインランドリー", "駐車場", "パーキング", "駐輪場", "コインパーキング",
            "タイムズ", "リパーク", "三井のリパーク", "パーク24", "名鉄協商",
            "月極", "時間貸", "立体駐車", "自走式",
        ]
        if tokens.contains(where: { n.contains($0) }) { return true }
        let upper = n.uppercased()
        if upper.contains("TIMES") || upper.contains("REPARK") || upper.contains("PARKING") {
            return true
        }
        // NPC／np・駐車場ブランドの単独行
        if n.hasPrefix("NPC") || n.contains("NPC ") || n.contains("ＮＰＣ") {
            return true
        }
        return false
    }
}
