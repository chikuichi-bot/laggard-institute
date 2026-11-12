import AVFoundation
import Observation

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
@MainActor
@Observable
final class PlaceNarrator: NSObject, AVSpeechSynthesizerDelegate {
    private(set) var isSpeaking = false
    private(set) var isPaused = false
    private(set) var activeSection: PlaceScriptSection?

    private let synthesizer = AVSpeechSynthesizer()
    private var activeStationId: String?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    static func hasContent(_ section: PlaceScriptSection, in station: Station) -> Bool {
        !script(for: station, section: section).isEmpty
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

    func isSpeaking(section: PlaceScriptSection) -> Bool {
        isSpeaking && activeSection == section
    }

    func toggle(station: Station, section: PlaceScriptSection = .all) {
        if isSpeaking || isPaused {
            if activeStationId == station.id, activeSection == section {
                stop()
                return
            }
            stop()
        }
        speak(station: station, section: section)
    }

    func speak(station: Station, section: PlaceScriptSection = .all) {
        let text = Self.script(for: station, section: section)
        guard !text.isEmpty else { return }
        stop(deactivateAudio: false)
        activeStationId = station.id
        activeSection = section
        prepareAudioSession()

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.preferredJapaneseVoice()
        // 電車の中でも聞き取りやすいよう、少しゆっくり。
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
        utterance.pitchMultiplier = 1.0
        utterance.preUtteranceDelay = 0.15
        utterance.postUtteranceDelay = 0.2

        isSpeaking = true
        isPaused = false
        synthesizer.speak(utterance)
    }

    func stop(deactivateAudio: Bool = true) {
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
        isPaused = false
        activeStationId = nil
        activeSection = nil
        if deactivateAudio {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
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
            self.isSpeaking = false
            self.isPaused = false
            self.activeStationId = nil
            self.activeSection = nil
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
            self.isPaused = false
            self.activeSection = nil
        }
    }
}
