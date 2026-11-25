import SwiftUI

/// Portée : la carte de portée radio, dans une fenêtre plein écran.
@main
struct PorteeApp: App {
    var body: some Scene {
        WindowGroup {
            WebView()
                .ignoresSafeArea()
                .background(Color.black.ignoresSafeArea())
                .preferredColorScheme(.dark)
        }
    }
}

struct WebView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController {
        WebViewController()
    }

    func updateUIViewController(_ uiViewController: WebViewController, context: Context) {}
}
