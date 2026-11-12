import AVFoundation
import Observation
import UIKit

/// 土地ページの読み上げ単位（目次の 01〜04 と全部）。
enum PlaceScriptSection: String, CaseIterable, Identifiable {
    case all
    case intro
    case history
    case sight
    case walk

    var id: String { rawValue }

    var listenLabel: String {
        switch self {
        case .all: return "土地案内を聞く"
        case .intro: return "この項目を聞く"
        case .history: return "この項目を聞く"
        case .sight: return "この項目を聞く"
        case .walk: return "この項目を聞く"
        }
    }
}

/// 土地ページの文章を、電車のイヤホン向けに読み上げる。
/// 「すべて」は文単位で進め、中断しても同じ駅なら続きから再開できる。
@MainActor
@Observable
final class PlaceNarrator: NSObject, AVSpeechSynthesizerDelegate {
    private(set) var isSpeaking = false
    private(set) var isPaused = false
    private(set) var activeSection: PlaceScriptSection?

    private let synthesizer = AVSpeechSynthesizer()
    private var activeStationId: String?
    private var chunks: [String] = []
    private var chunkIndex = 0
    private var scriptDigest = ""

    private static let bookmarkKey = "mishiranu.placeNarrator.bookmark.v1"

    private struct Bookmark: Codable {
        var stationId: String
        var section: String
        var chunkIndex: Int
        var scriptDigest: String
    }

    override init() {
        super.init()
        synthesizer.delegate = self
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.persistBookmarkIfNeeded()
            }
        }
    }

    static func hasContent(_ section: PlaceScriptSection, in station: Station) -> Bool {
        !script(for: station, section: section).isEmpty
    }

    /// 同じ駅・同じ項目で、途中保存があれば続きから聞ける。
    func canResume(station: Station, section: PlaceScriptSection = .all) -> Bool {
        guard let bookmark = loadBookmark() else { return false }
        guard bookmark.stationId == station.id, bookmark.section == section.rawValue else {
            return false
        }
        let text = Self.script(for: station, section: section)
        guard !text.isEmpty, bookmark.scriptDigest == Self.digest(text) else { return false }
        let total = Self.chunks(from: text).count
        return bookmark.chunkIndex > 0 && bookmark.chunkIndex < total
    }

    /// 画面に出す読み上げ本文（確認・デバッグ用）。
    static func script(for station: Station, section: PlaceScriptSection = .all) -> String {
        switch section {
        case .all:
            return [
                "\(station.name)の、土地案内です。",
                script(for: station, section: .intro),
                script(for: station, section: .history),
                script(for: station, section: .sight),
                script(for: station, section: .walk),
            ]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
        case .intro:
            var parts: [String] = []
            if let intro = station.stationIntro, !intro.isEmpty {
                parts.append(intro)
            }
            if station.mood == .empty, let empty = station.emptyCopy {
                parts.append(empty.headline)
                parts.append(empty.body)
            }
            return join(parts)
        case .history:
            var parts: [String] = []
            let area = paragraphs(station.areaAbout)
            if !area.isEmpty || !station.historyNotes.isEmpty {
                parts.append("このエリアのこと。")
                parts.append(contentsOf: area)
                for note in station.historyNotes {
                    parts.append(note.title)
                    parts.append(note.body)
                }
            }
            return join(parts)
        case .sight:
            var parts: [String] = []
            if !station.sightseeingNotes.isEmpty {
                parts.append("観光案内メモ。")
                for note in station.sightseeingNotes {
                    parts.append(note.title)
                    parts.append(note.body)
                }
            }
            return join(parts)
        case .walk:
            guard let walk = station.walkGuide, !walk.isEmpty else { return "" }
            return join(["歩き方の目安。", walk])
        }
    }

    private static func join(_ parts: [String]) -> String {
        parts
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private static func paragraphs(_ text: String?) -> [String] {
        guard let text, !text.isEmpty else { return [] }
        return text
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// 句点・改行で読み上げ単位に分ける（長すぎる一塊は途中再開しにくい）。
    static func chunks(from text: String) -> [String] {
        var out: [String] = []
        var current = ""
        for ch in text {
            if ch == "\n" {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { out.append(trimmed) }
                current = ""
                continue
            }
            current.append(ch)
            if "。！？".contains(ch) {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { out.append(trimmed) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rest.isEmpty { out.append(rest) }
        return out.filter { !$0.isEmpty }
    }

    private static func digest(_ text: String) -> String {
        // 本文が変わったら続き位置を破棄するための短い指紋
        "\(text.count):\(text.prefix(48)):\(text.suffix(48))"
    }

    func isSpeaking(section: PlaceScriptSection) -> Bool {
        isSpeaking && activeSection == section
    }

    /// - Parameter fromBeginning: true なら途中位置を捨てて最初から。
    func toggle(station: Station, section: PlaceScriptSection = .all, fromBeginning: Bool = false) {
        if isSpeaking || isPaused {
            if activeStationId == station.id, activeSection == section {
                stop()
                return
            }
            stop()
        }
        speak(station: station, section: section, fromBeginning: fromBeginning)
    }

    func speak(station: Station, section: PlaceScriptSection = .all, fromBeginning: Bool = false) {
        let text = Self.script(for: station, section: section)
        guard !text.isEmpty else { return }
        let parts = Self.chunks(from: text)
        guard !parts.isEmpty else { return }

        stop(deactivateAudio: false)

        let digest = Self.digest(text)
        var start = 0
        if !fromBeginning,
           let bookmark = loadBookmark(),
           bookmark.stationId == station.id,
           bookmark.section == section.rawValue,
           bookmark.scriptDigest == digest,
           bookmark.chunkIndex > 0,
           bookmark.chunkIndex < parts.count
        {
            start = bookmark.chunkIndex
        } else if fromBeginning {
            clearBookmark()
        }

        activeStationId = station.id
        activeSection = section
        chunks = parts
        chunkIndex = start
        scriptDigest = digest
        prepareAudioSession()
        persistBookmarkIfNeeded()
        speakCurrentChunk()
    }

    private func speakCurrentChunk() {
        guard chunkIndex < chunks.count else {
            finishPlayback(clearProgress: true)
            return
        }
        let utterance = AVSpeechUtterance(string: chunks[chunkIndex])
        utterance.voice = Self.preferredJapaneseVoice()
        // 電車の中でも聞き取りやすいよう、少しゆっくり。
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
        utterance.pitchMultiplier = 1.0
        utterance.preUtteranceDelay = chunkIndex == 0 ? 0.15 : 0.05
        utterance.postUtteranceDelay = 0.12

        isSpeaking = true
        isPaused = false
        synthesizer.speak(utterance)
    }

    func stop(deactivateAudio: Bool = true) {
        persistBookmarkIfNeeded()
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
        isPaused = false
        activeStationId = nil
        activeSection = nil
        chunks = []
        if deactivateAudio {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func finishPlayback(clearProgress: Bool) {
        if clearProgress { clearBookmark() }
        isSpeaking = false
        isPaused = false
        activeStationId = nil
        activeSection = nil
        chunks = []
        chunkIndex = 0
        scriptDigest = ""
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func persistBookmarkIfNeeded() {
        guard let stationId = activeStationId,
              let section = activeSection,
              !scriptDigest.isEmpty,
              chunkIndex < chunks.count
        else { return }
        let bookmark = Bookmark(
            stationId: stationId,
            section: section.rawValue,
            chunkIndex: chunkIndex,
            scriptDigest: scriptDigest
        )
        if let data = try? JSONEncoder().encode(bookmark) {
            UserDefaults.standard.set(data, forKey: Self.bookmarkKey)
        }
    }

    private func loadBookmark() -> Bookmark? {
        guard let data = UserDefaults.standard.data(forKey: Self.bookmarkKey) else { return nil }
        return try? JSONDecoder().decode(Bookmark.self, from: data)
    }

    private func clearBookmark() {
        UserDefaults.standard.removeObject(forKey: Self.bookmarkKey)
    }

    private func prepareAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true)
        } catch {
            // 読み上げ自体は続行。イヤホン接続時はシステムがルートを選ぶ。
        }
    }

    private static func preferredJapaneseVoice() -> AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("ja") }
        let enhanced = voices.first { $0.quality == .enhanced }
        return enhanced ?? AVSpeechSynthesisVoice(language: "ja-JP") ?? voices.first
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            guard self.isSpeaking else { return }
            self.chunkIndex += 1
            if self.chunkIndex < self.chunks.count {
                self.persistBookmarkIfNeeded()
                self.speakCurrentChunk()
            } else {
                self.finishPlayback(clearProgress: true)
            }
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            // 止めた位置は persistBookmarkIfNeeded（stop 側）で残す
            self.isSpeaking = false
            self.isPaused = false
            self.activeSection = nil
            self.activeStationId = nil
            self.chunks = []
        }
    }
}
