import SwiftUI

/// EXPERIENCE JAPAN PICTOGRAMS（日本デザインセンター）。
/// 利用条件により形は変えず、色と大きさだけを変える。
enum Pictogram: String {
    case destination = "ejp-destination"
    case history = "ejp-history"
    case trekking = "ejp-trekking"
    case information = "ejp-information"
    case menu = "ejp-hamburger-menu"
    case meetingPoint = "ejp-meeting-point"
    case search = "ejp-search"
    case watch = "ejp-watch-fingers"
    case restaurant = "ejp-restaurant"
    case gift = "ejp-gift"
    case photoSpot = "ejp-photo-spot"
    case waitingArea = "ejp-waiting-area"
    case ancientRoad = "ejp-ancient-road"
    case bicycleRental = "ejp-bicycle-rental"
    case train = "ejp-train"
    case arrival = "ejp-arrival"
    case sunny = "ejp-sunny"
    case partiallySunny = "ejp-partially-sunny"
    case sunrise = "ejp-sunrise"
    case sunset = "ejp-sunset"
    case nightSky = "ejp-night-sky"
    case approved = "ejp-approved"
}

struct PictogramIcon: View {
    let pictogram: Pictogram
    var size: CGFloat

    init(_ pictogram: Pictogram, size: CGFloat = 20) {
        self.pictogram = pictogram
        self.size = size
    }

    var body: some View {
        Image(pictogram.rawValue)
            .renderingMode(.template)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}
