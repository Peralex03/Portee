import CoreLocation
import UIKit
import WebKit

/// Portée dans une vue web : la version en ligne (GitHub Pages), gardée hors ligne par son service worker.
///
/// Le natif ajoute :
/// - la position par Core Location, sans redemande à chaque lancement ;
/// - l'écran allumé pendant le suivi en direct ;
/// - l'enregistrement et le partage des fichiers exportés (GeoJSON pour Calque) ;
/// - la reprise automatique si le moteur web s'arrête (manque de mémoire) ;
/// - un message clair si le premier lancement se fait sans connexion.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate,
    WKScriptMessageHandler, CLLocationManagerDelegate {

    // L'adresse est aussi dans Info.plist (WKAppBoundDomains) : garder les deux identiques.
    static let home = URL(string: "https://peralex03.github.io/Portee/")!
    static let host = "peralex03.github.io"
    static let root = "/Portee"

    private var web: WKWebView!
    private let panel = UIStackView()
    private var loaded = false
    private var files: [WKDownload: URL] = [:]
    private let place = CLLocationManager()
    private var watchers = Set<Int>()
    private var once = Set<Int>()

    // MARK: - Vue

    override func loadView() {
        let conf = WKWebViewConfiguration()
        conf.limitsNavigationsToAppBoundDomains = true
        conf.websiteDataStore = .default()
        let ucc = WKUserContentController()
        ucc.addUserScript(WKUserScript(source: Self.bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        ucc.add(WeakHandler(self), name: "portee")
        conf.userContentController = ucc

        web = WKWebView(frame: .zero, configuration: conf)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif

        let container = UIView()
        container.backgroundColor = .black
        web.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: container.topAnchor),
            web.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])
        buildPanel(in: container)
        view = container
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        place.delegate = self
        web.load(URLRequest(url: Self.home))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    /// Message affiché si le tout premier chargement échoue (aucune copie hors ligne encore).
    private func buildPanel(in container: UIView) {
        let text = UILabel()
        text.text = "Portée doit se connecter une première fois pour se charger.\nVérifier la connexion, puis réessayer."
        text.textColor = .white
        text.font = .preferredFont(forTextStyle: .body)
        text.numberOfLines = 0
        text.textAlignment = .center

        var conf = UIButton.Configuration.filled()
        conf.title = "Réessayer"
        conf.cornerStyle = .capsule
        let retry = UIButton(configuration: conf, primaryAction: UIAction { [weak self] _ in
            guard let self else { return }
            self.panel.isHidden = true
            self.web.load(URLRequest(url: Self.home))
        })

        panel.axis = .vertical
        panel.spacing = 20
        panel.alignment = .center
        panel.isHidden = true
        panel.addArrangedSubview(text)
        panel.addArrangedSubview(retry)
        panel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(panel)
        NSLayoutConstraint.activate([
            panel.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            panel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),
            panel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -32),
        ])
    }

    // MARK: - Navigation

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        if navigationAction.shouldPerformDownload { return .download }
        guard let url = navigationAction.request.url else { return .cancel }
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "blob" || scheme == "data" || scheme == "about" { return .allow }
        if scheme == "https", url.host == Self.host, url.path.hasPrefix(Self.root) { return .allow }
        // Tout autre lien (site externe, courriel, téléphone) s'ouvre hors de l'app.
        // Forme explicite avec completionHandler : dans une fonction async, la forme courte choisirait la variante async.
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        return .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        navigationResponse.canShowMIMEType ? .allow : .download
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        panel.isHidden = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return } // navigation annulée par la règle ci-dessus
        if !loaded { panel.isHidden = false }
    }

    /// Le moteur web peut être arrêté par iOS (mémoire) : la page est rechargée au lieu de laisser un écran noir.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView.url == nil {
            webView.load(URLRequest(url: Self.home))
        } else {
            webView.reload()
        }
    }

    // MARK: - Fenêtres et dialogues

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url, options: [:], completionHandler: nil) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async {
        guard presentedViewController == nil else { return }
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume() })
            present(a, animated: true)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async -> Bool {
        guard presentedViewController == nil else { return false }
        return await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in done.resume(returning: false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume(returning: true) })
            present(a, animated: true)
        }
    }

    // MARK: - Fichiers exportés

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String) async -> URL? {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(suggestedFilename.isEmpty ? "portee.geojson" : suggestedFilename)
        files[download] = url
        return url
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = files.removeValue(forKey: download) else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(sheet, animated: true)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        files.removeValue(forKey: download)
    }

    // MARK: - Messages de la page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let kind = body["k"] as? String else { return }
        switch kind {
        case "veille":
            UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? false
        case "geo":
            let id = (body["id"] as? Int) ?? 0
            switch body["op"] as? String {
            case "watch": watchers.insert(id); startGeo()
            case "once": once.insert(id); startGeo()
            case "clear": watchers.remove(id); stopGeoIfIdle()
            default: break
            }
        default:
            break
        }
    }

    // MARK: - Position

    private func startGeo() {
        switch place.authorizationStatus {
        case .notDetermined:
            place.requestWhenInUseAuthorization() // la suite arrive dans locationManagerDidChangeAuthorization
        case .denied, .restricted:
            failGeo(1, "Accès à la position refusé : Réglages, Portée, Position.")
        default:
            place.desiredAccuracy = kCLLocationAccuracyBest
            place.distanceFilter = kCLDistanceFilterNone
            place.startUpdatingLocation()
            if let l = place.location, -l.timestamp.timeIntervalSinceNow < 10 { send(l) }
        }
    }

    private func stopGeoIfIdle() {
        if watchers.isEmpty && once.isEmpty { place.stopUpdatingLocation() }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if watchers.isEmpty && once.isEmpty { return }
        switch manager.authorizationStatus {
        case .notDetermined: break
        case .denied, .restricted: failGeo(1, "Accès à la position refusé : Réglages, Portée, Position.")
        default: startGeo()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let l = locations.last { send(l) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let e = error as? CLError, e.code == .locationUnknown { return } // passager : Core Location réessaie
        failGeo(2, "Position indisponible.")
    }

    private func send(_ l: CLLocation) {
        guard l.horizontalAccuracy >= 0 else { return }
        let ids = Array(watchers.union(once))
        once.removeAll()
        func opt(_ v: Double, _ ok: Bool) -> Any {
            if ok && v.isFinite { return v }
            return NSNull()
        }
        let a: [Any] = [
            l.coordinate.latitude, l.coordinate.longitude, l.horizontalAccuracy,
            opt(l.altitude, l.verticalAccuracy >= 0), opt(l.verticalAccuracy, l.verticalAccuracy >= 0),
            opt(l.course, l.course >= 0), opt(l.speed, l.speed >= 0),
            (l.timestamp.timeIntervalSince1970 * 1000).rounded(),
        ]
        call(ids, true, a)
        stopGeoIfIdle()
    }

    private func failGeo(_ code: Int, _ text: String) {
        let ids = Array(watchers.union(once))
        once.removeAll()
        if code == 1 {
            watchers.removeAll()
            place.stopUpdatingLocation()
        }
        call(ids, false, [code, text])
    }

    private func call(_ ids: [Int], _ ok: Bool, _ a: [Any]) {
        let payload: [Any] = [ids, ok, a]
        guard !ids.isEmpty, JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__porteeGeo && window.__porteeGeo.apply(null, \(json))", completionHandler: nil)
    }

    // MARK: - Pont JavaScript

    /// Injecté avant la page : position par Core Location et écran allumé, avec les mêmes fonctions que le web.
    static let bridge = """
    (function () {
      var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.portee;
      if (!mh) return;
      window.porteeApp = true;
      var cbs = {}, nid = 1;
      function pos(a) {
        return { coords: { latitude: a[0], longitude: a[1], accuracy: a[2], altitude: a[3], altitudeAccuracy: a[4], heading: a[5], speed: a[6] }, timestamp: a[7] };
      }
      window.__porteeGeo = function (ids, ok, a) {
        ids.forEach(function (id) {
          var c = cbs[id];
          if (!c) return;
          if (c.once) delete cbs[id];
          try {
            if (ok) c.s(pos(a));
            else if (c.e) c.e({ code: a[0], message: a[1], PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
          } catch (err) { setTimeout(function () { throw err; }); }
        });
      };
      var geo = {
        getCurrentPosition: function (s, e) { var id = nid++; cbs[id] = { s: s, e: e, once: true }; mh.postMessage({ k: 'geo', op: 'once', id: id }); },
        watchPosition: function (s, e) { var id = nid++; cbs[id] = { s: s, e: e }; mh.postMessage({ k: 'geo', op: 'watch', id: id }); return id; },
        clearWatch: function (id) { delete cbs[id]; mh.postMessage({ k: 'geo', op: 'clear', id: id }); }
      };
      try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (e) {}
      var held = 0;
      var wakeLock = { request: function () {
        held++;
        mh.postMessage({ k: 'veille', on: true });
        var s = { released: false, type: 'screen', onrelease: null,
          addEventListener: function () {}, removeEventListener: function () {},
          release: function () {
            if (!s.released) { s.released = true; held = Math.max(0, held - 1); if (!held) mh.postMessage({ k: 'veille', on: false }); }
            return Promise.resolve();
          } };
        return Promise.resolve(s);
      } };
      try { Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true }); } catch (e) {}
    })();
    """
}

/// Évite que le gestionnaire de messages retienne la vue (cycle de références).
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
