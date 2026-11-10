import AVFoundation
import Observation

/// 土地ページの文章を、電車のイヤホン向けに読み上げる。
@MainActor
@Observable
final class PlaceNarrator: NSObject, AVSpeechSynthesizerDelegate {
    private(set) var isSpeaking = false
    private(set) var isPaused = false

    private let synthesizer = AVSpeechSynthesizer()
    private var activeStationId: String?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// 画面に出す読み上げ本文（確認・デバッグ用）。
    static func script(for station: Station) -> String {
        var parts: [String] = []
        parts.append("\(station.name)の、土地案内です。")
        if let intro = station.stationIntro, !intro.isEmpty {
            parts.append(intro)
        }
        if let walk = station.walkGuide, !walk.isEmpty {
            parts.append("歩き方の目安。")
            parts.append(walk)
        }
        if station.mood == .empty, let empty = station.emptyCopy {
            parts.append(empty.headline)
            parts.append(empty.body)
        }
        let area = paragraphs(station.areaAbout)
        if !area.isEmpty || !station.historyNotes.isEmpty {
            parts.append("このエリアのこと、歴史。")
            parts.append(contentsOf: area)
            for note in station.historyNotes {
                parts.append(note.title)
                parts.append(note.body)
            }
        }
        if !station.sightseeingNotes.isEmpty {
            parts.append("観光案内メモ。")
            for note in station.sightseeingNotes {
                parts.append(note.title)
                parts.append(note.body)
            }
        }
        if parts.count == 1 {
            parts.append("この駅の土地メモは、まだ少なめです。")
        }
        return parts
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    func toggle(station: Station) {
        if isSpeaking || isPaused {
            if activeStationId == station.id {
                stop()
                return
            }
            stop()
        }
        speak(station: station)
    }

    func speak(station: Station) {
        stop(deactivateAudio: false)
        activeStationId = station.id
        prepareAudioSession()

        let utterance = AVSpeechUtterance(string: Self.script(for: station))
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
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
            self.isPaused = false
        }
    }
}
