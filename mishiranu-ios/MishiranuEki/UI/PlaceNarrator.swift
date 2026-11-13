import AVFoundation
import MediaPlayer
import Observation
import UIKit

/// 土地ページの読み上げ単位（目次の 01〜04 と全部）。
enum PlaceScriptSection: String, CaseIterable, Identifiable {
    case all
    case intro
    case history
    case sight
    case story
    case walk

    var id: String { rawValue }

    var listenLabel: String {
        switch self {
        case .all: return "土地案内を聞く"
        case .intro, .history, .sight, .story, .walk: return "この項目を聞く"
        }
    }

    var nowPlayingSubtitle: String {
        switch self {
        case .all: return "土地案内"
        case .intro: return "この駅のこと"
        case .history: return "このエリアのこと"
        case .sight: return "目の置きどころ"
        case .story: return "物語のゆかり"
        case .walk: return "散歩の呼吸"
        }
    }
}

/// 土地の文章を読み上げる（電車の中でも、散策中でも、画面を消しても）。
/// 「すべて」は文単位で進め、中断しても同じ駅なら続きから再開できる。
/// タブ切替では止めない（AppModel が保持する）。駅が変わった／トップに戻ったときだけ止める。
/// バックグラウンド再生には Info.plist の UIBackgroundModes=audio が必要。
@MainActor
@Observable
final class PlaceNarrator: NSObject, AVSpeechSynthesizerDelegate {
    private(set) var isSpeaking = false
    private(set) var isPaused = false
    private(set) var activeSection: PlaceScriptSection?

    private let synthesizer = AVSpeechSynthesizer()
    private var activeStationId: String?
    private var activeStationTitle = "見知らぬ駅"
    /// 発話直前の言い間違い対策用（表示文は変えず、ここだけ使う）。
    private var activeSpeakStation: Station?
    private var chunks: [String] = []
    private var chunkIndex = 0
    private var scriptDigest = ""
    private var didSetupRemoteCommands = false

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
        setupRemoteCommandsIfNeeded()
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.persistBookmarkIfNeeded()
                self?.publishNowPlaying()
            }
        }
    }

    static func hasContent(
        _ section: PlaceScriptSection,
        in station: Station,
        course: WalkCourse? = nil
    ) -> Bool {
        !script(for: station, section: section, course: course).isEmpty
    }

    /// 同じ駅・同じ項目で、途中保存があれば続きから聞ける。
    func canResume(
        station: Station,
        section: PlaceScriptSection = .all,
        course: WalkCourse? = nil
    ) -> Bool {
        guard let bookmark = loadBookmark() else { return false }
        guard bookmark.stationId == station.id, bookmark.section == section.rawValue else {
            return false
        }
        let text = Self.script(for: station, section: section, course: course)
        guard !text.isEmpty, bookmark.scriptDigest == Self.digest(text) else { return false }
        let total = Self.chunks(from: text).count
        return bookmark.chunkIndex > 0 && bookmark.chunkIndex < total
    }

    /// 画面に出す読み上げ本文（確認・デバッグ用）。
    /// `.all` は intro → 散歩の呼吸 → 歴史／観光／物語の順（耳で先に歩く）。
    static func script(
        for station: Station,
        section: PlaceScriptSection = .all,
        course: WalkCourse? = nil
    ) -> String {
        switch section {
        case .all:
            return [
                "\(station.name)の、土地案内です。",
                script(for: station, section: .intro, course: course),
                script(for: station, section: .walk, course: course),
                script(for: station, section: .history, course: course),
                script(for: station, section: .sight, course: course),
                script(for: station, section: .story, course: course),
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
                parts.append("目の置きどころ。")
                for note in station.sightseeingNotes {
                    parts.append(note.title)
                    parts.append(note.body)
                }
            }
            return join(parts)
        case .story:
            var parts: [String] = []
            if !station.storyNotes.isEmpty {
                parts.append("物語のゆかり。")
                for note in station.storyNotes {
                    parts.append(note.title)
                    parts.append(note.body)
                }
            }
            return join(parts)
        case .walk:
            let breath = PromenadeBreath.script(for: station, course: course)
            if !breath.isEmpty { return breath }
            guard let walk = station.walkGuide, !walk.isEmpty else { return "" }
            return join(["駅から小回り。", walk])
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
    func toggle(
        station: Station,
        section: PlaceScriptSection = .all,
        fromBeginning: Bool = false,
        course: WalkCourse? = nil
    ) {
        if isSpeaking || isPaused {
            if activeStationId == station.id, activeSection == section {
                stop()
                return
            }
            stop()
        }
        speak(
            station: station,
            section: section,
            fromBeginning: fromBeginning,
            course: course
        )
    }

    func speak(
        station: Station,
        section: PlaceScriptSection = .all,
        fromBeginning: Bool = false,
        course: WalkCourse? = nil
    ) {
        let text = Self.script(for: station, section: section, course: course)
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
        activeSpeakStation = station
        activeStationTitle = station.indexStationLabel.isEmpty
            ? station.name
            : "\(station.indexStationLabel)駅"
        activeSection = section
        chunks = parts
        chunkIndex = start
        scriptDigest = digest
        prepareAudioSession()
        persistBookmarkIfNeeded()
        publishNowPlaying()
        speakCurrentChunk()
    }

    private func speakCurrentChunk() {
        guard chunkIndex < chunks.count else {
            finishPlayback(clearProgress: true)
            return
        }
        let raw = chunks[chunkIndex]
        let spoken: String = {
            if let station = activeSpeakStation {
                return SpeechSpeakable.prepare(raw, station: station)
            }
            return SpeechSpeakable.prepare(
                raw,
                stationName: "",
                stationReading: nil
            )
        }()
        let utterance = AVSpeechUtterance(string: spoken.isEmpty ? raw : spoken)
        utterance.voice = Self.preferredJapaneseVoice()
        // 少しゆっくり読むと、固有名の食い違いが減る。
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.84
        utterance.pitchMultiplier = 1.0
        utterance.preUtteranceDelay = chunkIndex == 0 ? 0.18 : 0.08
        utterance.postUtteranceDelay = 0.16

        isSpeaking = true
        isPaused = false
        publishNowPlaying()
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
        activeSpeakStation = nil
        activeSection = nil
        chunks = []
        clearNowPlaying()
        if deactivateAudio {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func finishPlayback(clearProgress: Bool) {
        if clearProgress { clearBookmark() }
        isSpeaking = false
        isPaused = false
        activeStationId = nil
        activeSpeakStation = nil
        activeSection = nil
        chunks = []
        chunkIndex = 0
        scriptDigest = ""
        clearNowPlaying()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func setupRemoteCommandsIfNeeded() {
        guard !didSetupRemoteCommands else { return }
        didSetupRemoteCommands = true
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.stopCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.nextTrackCommand.isEnabled = false
        center.previousTrackCommand.isEnabled = false

        center.playCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            return self.handleRemoteResume()
        }
        center.pauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            return self.handleRemotePauseOrStop()
        }
        center.stopCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            Task { @MainActor in self.stop() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            if self.isSpeaking {
                return self.handleRemotePauseOrStop()
            }
            return self.handleRemoteResume()
        }
    }

    private func handleRemotePauseOrStop() -> MPRemoteCommandHandlerStatus {
        // 散策中は「止める」が主。続きはアプリ内の「続きから聞く」で再開。
        Task { @MainActor in self.stop() }
        return .success
    }

    private func handleRemoteResume() -> MPRemoteCommandHandlerStatus {
        // ロック画面からの再開は、途中ブックマークがあるときアプリ内で「続きから」を押す想定。
        // ここでは止めず、再生中なら成功扱い。
        .success
    }

    private func publishNowPlaying() {
        guard isSpeaking || isPaused else {
            clearNowPlaying()
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: activeStationTitle,
            MPMediaItemPropertyArtist: "見知らぬ駅",
            MPMediaItemPropertyAlbumTitle: activeSection?.nowPlayingSubtitle ?? "土地案内",
            MPNowPlayingInfoPropertyPlaybackRate: isSpeaking ? 1.0 : 0.0,
        ]
        if !chunks.isEmpty {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = Double(chunkIndex)
            info[MPMediaItemPropertyPlaybackDuration] = Double(max(chunks.count, 1))
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        UIApplication.shared.beginReceivingRemoteControlEvents()
    }

    private func clearNowPlaying() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
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
            // 背面・ロック中も続ける。散策ガイダンス用の再生セッション。
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
        } catch {
            // 読み上げ自体は続行。イヤホン接続時はシステムがルートを選ぶ。
        }
    }

    private static func preferredJapaneseVoice() -> AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("ja") }
        // 高品質ボイスほど固有名の読みが安定しやすい。
        if #available(iOS 17.0, *) {
            if let premium = voices.first(where: { $0.quality == .premium }) {
                return premium
            }
        }
        let enhanced = voices.first { $0.quality == .enhanced }
        let kyoko = voices.first { $0.identifier.lowercased().contains("kyoko") }
        return enhanced ?? kyoko ?? AVSpeechSynthesisVoice(language: "ja-JP") ?? voices.first
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
