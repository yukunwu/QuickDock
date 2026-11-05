// Noninteractive system WKWebView probe. Uses production assets under a custom
// URL scheme, like Wails, with the browser-preview bridge and disposable storage.
// Does not operate/unlock the desktop or replace the running QuickDock session.
import AppKit
import WebKit

final class Probe: NSObject, WKURLSchemeHandler, WKNavigationDelegate, WKScriptMessageHandler {
 let root: URL
 var view: WKWebView!
 init(root: URL) { self.root = root; super.init() }
 func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
  let path = urlSchemeTask.request.url!.path
  let file = root.appendingPathComponent(path == "/" ? "index.html" : String(path.dropFirst())).standardizedFileURL
  guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
   urlSchemeTask.didFailWithError(NSError(domain:"Probe",code:404)); return
  }
  let mime = ["html":"text/html", "js":"text/javascript", "css":"text/css", "svg":"image/svg+xml"][file.pathExtension] ?? "application/octet-stream"
  urlSchemeTask.didReceive(URLResponse(url: urlSchemeTask.request.url!, mimeType: mime, expectedContentLength: data.count, textEncodingName:"utf-8"))
  urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
 }
 func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
 func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
  print(message.body); fflush(stdout)
  if let body=message.body as? String, body.hasPrefix("DONE") { NSApp.terminate(nil) }
  if let body=message.body as? String, body.hasPrefix("FAIL") { exit(1) }
 }
 func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
  let script = try! String(contentsOfFile: CommandLine.arguments[2], encoding:.utf8)
  webView.evaluateJavaScript(script) { _,error in if let error=error {print("FAIL",error);exit(1)} }
 }
}
let app=NSApplication.shared
app.setActivationPolicy(.prohibited)
let probe=Probe(root:URL(fileURLWithPath:CommandLine.arguments[1]).standardizedFileURL)
let config=WKWebViewConfiguration()
config.websiteDataStore = .nonPersistent()
// Keep this headless probe scheduled; production retains WebKit's default policy.
if #available(macOS 14.0, *) { config.preferences.inactiveSchedulingPolicy = .none }
config.setURLSchemeHandler(probe, forURLScheme:"quickdock-test")
config.userContentController.add(probe,name:"probe")
probe.view=WKWebView(frame:NSRect(x:0,y:0,width:960,height:660),configuration:config)
probe.view.navigationDelegate=probe
probe.view.load(URLRequest(url:URL(string:"quickdock-test://localhost/")!))
DispatchQueue.main.asyncAfter(deadline:.now()+180) { print("FAIL timeout");exit(1) }
app.run()
