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
        case .sight: return "寄るところ"
        case .story: return "物語のゆかり"
        case .walk: return "歩き方"
        }
    }
}

/// 土地の文章を読み上げる（電車の中でも、散策中でも、画面を消しても）。
/// 優先: xVoice（xAI TTS · Mac 3010 / さくら tts.php）。不通時は AVSpeech。
/// 息継ぎ単位（数文まとめ）で進め、次チャンクは再生中に先読みして句点後の間延びを抑える。
/// タブ切替では止めない（AppModel が保持する）。駅が変わった／トップに戻ったときだけ止める。
/// バックグラウンド再生には Info.plist の UIBackgroundModes=audio が必要。
@MainActor
@Observable
final class PlaceNarrator: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    private(set) var isSpeaking = false
    private(set) var isPaused = false
    private(set) var activeSection: PlaceScriptSection?

    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var playbackGeneration = 0
    private var activeStationId: String?
    private var activeStationTitle = "見知らぬ駅"
    /// 発話直前の言い間違い対策用（表示文は変えず、ここだけ使う）。
    private var activeSpeakStation: Station?
    private var chunks: [String] = []
    private var chunkIndex = 0
    private var scriptDigest = ""
    private var didSetupRemoteCommands = false
    /// 次チャンクの MP3 先読み（句点ごとの待ちを消す）。
    private var prefetchedAudio: [Int: Data] = [:]
    private var prefetchingIndexes: Set<Int> = []
    /// いまの AVSpeech 発話が属する playbackGeneration（古い didFinish/didCancel を無視）。
    private var activeSpeechGeneration: Int?

    /// xVoice 1 リクエストに載せる目安。
    /// `[pause]` 挿入後も API 上限 1200 を超えないよう余白を取る。
    private static let breathTargetChars = 360
    private static let breathMaxChars = 720
    private static let xvoiceSendMaxChars = 1100

    private static let bookmarkKey = "mishiranu.placeNarrator.bookmark.v2"

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
    /// `.all` は intro → 歩き方 → 歴史／観光／物語の順。
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
            // メモがあるときは概観を重ねない（同じ話題の再読を止める）
            if !station.historyNotes.isEmpty {
                parts.append("このエリアのこと。")
                for note in station.historyNotes {
                    parts.append(note.title)
                    parts.append(note.body)
                }
            } else {
                let area = paragraphs(station.areaAbout)
                if !area.isEmpty {
                    parts.append("このエリアのこと。")
                    parts.append(contentsOf: area)
                }
            }
            return join(parts)
        case .sight:
            var parts: [String] = []
            if !station.sightseeingNotes.isEmpty {
                parts.append("寄るところ。")
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
            guard let walk = station.walkGuide, !walk.isEmpty else { return "" }
            return join(["歩き方。", walk])
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

    /// 息継ぎ単位に分ける。一文ごとだと xVoice 往復の無音が句点ごとに入るので、数文まとめる。
    static func chunks(from text: String) -> [String] {
        let normalized = text.replacingOccurrences(of: "\r\n", with: "\n")
        // 空行＝段落で区切る。段落内の単独改行はつなぐ（句点だけの細切れにしない）。
        let paragraphs = normalized
            .components(separatedBy: "\n\n")
            .map { $0.replacingOccurrences(of: "\n", with: "") }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        var out: [String] = []
        for paragraph in paragraphs {
            out.append(contentsOf: packBreathGroups(sentencePieces(from: paragraph)))
        }
        return out
    }

    private static func packBreathGroups(_ sentences: [String]) -> [String] {
        guard !sentences.isEmpty else { return [] }
        var out: [String] = []
        var current = ""
        for sentence in sentences {
            // 一文が上限超えでも API に載るよう硬く切る（稀な長文対策）。
            if sentence.count > breathMaxChars {
                if !current.isEmpty {
                    out.append(current)
                    current = ""
                }
                out.append(contentsOf: splitOversizedSentence(sentence))
                continue
            }
            let next = current.isEmpty ? sentence : current + sentence
            if !current.isEmpty, next.count > breathMaxChars {
                out.append(current)
                current = sentence
                continue
            }
            current = next
            if current.count >= breathTargetChars {
                out.append(current)
                current = ""
            }
        }
        if !current.isEmpty { out.append(current) }
        return out
    }

    private static func splitOversizedSentence(_ sentence: String) -> [String] {
        var out: [String] = []
        var start = sentence.startIndex
        while start < sentence.endIndex {
            let end = sentence.index(start, offsetBy: breathMaxChars, limitedBy: sentence.endIndex)
                ?? sentence.endIndex
            let piece = String(sentence[start..<end])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !piece.isEmpty { out.append(piece) }
            start = end
        }
        return out
    }

    private static func sentencePieces(from text: String) -> [String] {
        var out: [String] = []
        var current = ""
        for ch in text {
            current.append(ch)
            if "。！？".contains(ch) {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { out.append(trimmed) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rest.isEmpty { out.append(rest) }
        return out
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

    private func preparedSpeakText(for raw: String) -> String {
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
        return spoken.isEmpty ? raw : spoken
    }

    /// xVoice 用。句点のあとに短い `[pause]`（xAI タグ）。長すぎる無音にはしない。
    private static func withShortPausesAfterPunctuation(_ text: String) -> String {
        var out = ""
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            let ch = chars[i]
            out.append(ch)
            if "。！？".contains(ch) {
                let after = chars.suffix(from: i + 1)
                let rest = String(after).trimmingCharacters(in: .whitespacesAndNewlines)
                if !rest.isEmpty, !rest.hasPrefix("[pause]") {
                    // 送信上限直前ならタグを足さない（413 回避）。
                    if out.count + 9 + rest.count <= xvoiceSendMaxChars {
                        out.append(" [pause] ")
                    }
                }
            }
            i += 1
        }
        let trimmed = out
            .replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= xvoiceSendMaxChars { return trimmed }
        return String(trimmed.prefix(xvoiceSendMaxChars))
    }

    private func xvoiceSpeakText(for raw: String) -> String {
        Self.withShortPausesAfterPunctuation(preparedSpeakText(for: raw))
    }

    private func speakCurrentChunk() {
        guard chunkIndex < chunks.count else {
            finishPlayback(clearProgress: true)
            return
        }
        let raw = chunks[chunkIndex]
        let speakText = preparedSpeakText(for: raw)
        let xvoiceText = Self.withShortPausesAfterPunctuation(speakText)
        let generation = playbackGeneration
        let index = chunkIndex

        isSpeaking = true
        isPaused = false
        publishNowPlaying()

        // 再生中に次を先読み（API 往復の長い無音は出さない）
        prefetchXvoice(index: index + 1, generation: generation)

        Task { @MainActor in
            do {
                let mp3: Data
                if let cached = self.prefetchedAudio.removeValue(forKey: index) {
                    mp3 = cached
                } else {
                    mp3 = try await StationAPIClient.synthesizeXvoice(text: xvoiceText)
                }
                guard generation == self.playbackGeneration, self.isSpeaking else { return }
                try self.playXvoice(mp3, generation: generation)
                self.prefetchXvoice(index: index + 1, generation: generation)
            } catch let api as StationAPIError {
                if case .cancelled = api { return }
                guard generation == self.playbackGeneration, self.isSpeaking else { return }
                #if DEBUG
                print("[PlaceNarrator] xvoice fallback → AVSpeech: \(api)")
                #endif
                self.speakWithAVSpeech(speakText, fallbackRaw: raw)
            } catch {
                guard generation == self.playbackGeneration, self.isSpeaking else { return }
                #if DEBUG
                print("[PlaceNarrator] xvoice fallback → AVSpeech: \(error)")
                #endif
                // AVSpeech にはタグを渡さない（読み上げられてしまう）
                self.speakWithAVSpeech(speakText, fallbackRaw: raw)
            }
        }
    }

    private func prefetchXvoice(index: Int, generation: Int) {
        guard generation == playbackGeneration, isSpeaking else { return }
        guard index < chunks.count else { return }
        guard prefetchedAudio[index] == nil, !prefetchingIndexes.contains(index) else { return }
        prefetchingIndexes.insert(index)
        let text = xvoiceSpeakText(for: chunks[index])
        Task { @MainActor in
            defer { self.prefetchingIndexes.remove(index) }
            do {
                let mp3 = try await StationAPIClient.synthesizeXvoice(text: text)
                guard generation == self.playbackGeneration else { return }
                self.prefetchedAudio[index] = mp3
            } catch {
                // 先読み失敗は本再生側で再試行／AVSpeech
            }
        }
    }

    private func clearPrefetch() {
        prefetchedAudio.removeAll(keepingCapacity: false)
        prefetchingIndexes.removeAll(keepingCapacity: false)
    }

    private func playXvoice(_ data: Data, generation: Int) throws {
        guard generation == playbackGeneration, isSpeaking else {
            throw StationAPIError.cancelled
        }
        audioPlayer?.stop()
        let player = try AVAudioPlayer(data: data)
        player.delegate = self
        player.prepareToPlay()
        guard generation == playbackGeneration, isSpeaking else {
            throw StationAPIError.cancelled
        }
        audioPlayer = player
        if !player.play() {
            audioPlayer = nil
            throw StationAPIError.badStatus(500, "play_failed")
        }
    }

    private func speakWithAVSpeech(_ spoken: String, fallbackRaw: String) {
        let utterance = AVSpeechUtterance(string: spoken.isEmpty ? fallbackRaw : spoken)
        utterance.voice = Self.preferredJapaneseVoice()
        // フォールバック時も句点後に少し余韻（xVoice の [pause] に近い短さ）。
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
        utterance.pitchMultiplier = 1.0
        utterance.preUtteranceDelay = chunkIndex == 0 ? 0.08 : 0.04
        utterance.postUtteranceDelay = 0.22
        activeSpeechGeneration = playbackGeneration
        synthesizer.speak(utterance)
    }

    func stop(deactivateAudio: Bool = true) {
        persistBookmarkIfNeeded()
        playbackGeneration += 1
        activeSpeechGeneration = nil
        clearPrefetch()
        audioPlayer?.stop()
        audioPlayer = nil
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
        playbackGeneration += 1
        activeSpeechGeneration = nil
        clearPrefetch()
        audioPlayer?.stop()
        audioPlayer = nil
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

    private func advanceAfterChunk() {
        guard isSpeaking else { return }
        chunkIndex += 1
        if chunkIndex < chunks.count {
            persistBookmarkIfNeeded()
            speakCurrentChunk()
        } else {
            finishPlayback(clearProgress: true)
        }
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
            // 古い発話の完了が新セッションを進めないようにする。
            guard self.activeSpeechGeneration == self.playbackGeneration else { return }
            guard self.isSpeaking, self.audioPlayer == nil else { return }
            self.activeSpeechGeneration = nil
            self.advanceAfterChunk()
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        // stop() が playbackGeneration を上げて掃除済み。
        // ここで状態を触ると「止めてすぐ再生」の新セッションを壊す（以前のバグ）。
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            guard self.audioPlayer === player else { return }
            self.audioPlayer = nil
            guard self.isSpeaking else { return }
            self.advanceAfterChunk()
        }
    }
}
