#!/usr/bin/env swift
/**
 * landmark-locks.json の meal/souvenir 座標を MapKit で突き合わせる。
 *
 *   cd リポ根 && swift mishiranu-app/scripts/verify-landmark-locks.swift
 *
 * MapKit は RunLoop が必要なので、セマフォ待ちだけではヒットしない。
 * 終了コード 1 = 80m 超のずれあり。
 */
import Foundation
import MapKit

struct LockFile: Decodable { let locks: [Lock] }
struct Lock: Decodable {
    let id: String
    let station: String
    let kind: String
    let keywords: [String]
    let canonical: String?
    let address: String?
    let lat: Double
    let lng: Double
    let walkMinutes: Int
}

func loadLocks() -> [Lock] {
    let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    for rel in ["mishiranu-app/data/landmark-locks.json", "data/landmark-locks.json"] {
        let url = cwd.appendingPathComponent(rel)
        if let data = try? Data(contentsOf: url),
           let file = try? JSONDecoder().decode(LockFile.self, from: data) {
            return file.locks
        }
    }
    fputs("landmark-locks.json が見つかりません\n", stderr)
    exit(2)
}

func meters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
    CLLocation(latitude: a.latitude, longitude: a.longitude)
        .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
}

let locks = loadLocks().filter { $0.kind == "meal" || $0.kind == "souvenir" }
print("check=\(locks.count)")

final class State {
    var index = 0
    var failures = 0
    let locks: [Lock]
    init(_ locks: [Lock]) { self.locks = locks }

    func next() {
        if index >= locks.count {
            if failures > 0 {
                fputs("ずれの大きいロック: \(failures)\n", stderr)
                exit(1)
            }
            print("meal/souvenir ロックは MapKit と概ね一致（80m以内）")
            exit(0)
        }
        let lock = locks[index]
        index += 1
        let locked = CLLocationCoordinate2D(latitude: lock.lat, longitude: lock.lng)
        let label = lock.canonical ?? lock.keywords.first ?? lock.id
        let query = label
        let req = MKLocalSearch.Request()
        req.naturalLanguageQuery = query
        req.region = MKCoordinateRegion(center: locked, latitudinalMeters: 1_200, longitudinalMeters: 1_200)
        req.resultTypes = [.pointOfInterest]
        MKLocalSearch(request: req).start { [weak self] response, _ in
            guard let self else { return }
            var best = Double.greatestFiniteMagnitude
            var bestName = ""
            for item in response?.mapItems ?? [] {
                let c = item.location.coordinate
                let d = meters(locked, c)
                if d < best {
                    best = d
                    bestName = item.name ?? "?"
                }
            }
            if best == .greatestFiniteMagnitude {
                print("WARN  \(lock.id)  ヒットなし  \(label)  \(lock.lat),\(lock.lng)")
            } else if best > 80 {
                print(String(format: "FAIL  %@  「%@」まで %.0fm", lock.id, bestName, best))
                self.failures += 1
            } else {
                print(String(format: "OK    %@  %.0fm → %@", lock.id, best, bestName))
            }
            self.next()
        }
    }
}

let state = State(locks)
state.next()
RunLoop.main.run()
