import Foundation

enum Geo {
    static let earthKm = 6371.0

    static func haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
        let toRad = { (d: Double) in d * .pi / 180 }
        let dLat = toRad(lat2 - lat1)
        let dLng = toRad(lng2 - lng1)
        let h = pow(sin(dLat / 2), 2) + cos(toRad(lat1)) * cos(toRad(lat2)) * pow(sin(dLng / 2), 2)
        return 2 * earthKm * asin(min(1, sqrt(h)))
    }

    static func nearestStation(lat: Double, lng: Double, in stations: [Station]) -> (station: Station, km: Double)? {
        guard lat.isFinite, lng.isFinite else { return nil }
        var best: (station: Station, km: Double)?
        for station in stations {
            let km = haversineKm(lat1: lat, lng1: lng, lat2: station.lat, lng2: station.lng)
            if best == nil || km < best!.km {
                best = (station, km)
            }
        }
        return best
    }

    /// 「約350m」「約1.2km」
    static func distanceLabel(km: Double) -> String {
        km < 1 ? "約\(Int((km * 1000).rounded()))m" : String(format: "約%.1fkm", km)
    }
}
