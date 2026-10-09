// Eye Lab Overlay: applies the Eye Lab vision filters to the whole Mac screen.
//
// Captures every display with ScreenCaptureKit (excluding this app's own windows),
// filters each frame on the GPU with Metal, and shows the result in a borderless,
// click-through, always-on-top window. Other apps keep working normally underneath.
//
// Controlled by Eye Lab through a small JSON state file ({"mode": 1, "lod": 3.0, "gain": 1.6, "keep": 0, "mix": 1}),
// and from its own menu bar icon. Minutes with the filter on are written to
// overlay_time.json next to the state file so they count toward the daily goal.
//
// Usage: EyeLabOverlay --state <path/to/overlay.json>

import AppKit
import CoreMedia
import CoreVideo
import Metal
import MetalPerformanceShaders
import Network
import QuartzCore
import ScreenCaptureKit

// MARK: - Settings shared between the UI thread and the capture queues

struct FilterSettings: Codable, Equatable {
    var mode: Int = 1        // 0 off, 1 high-pass, 2 low-pass
    var lod: Double = 3.0    // blur scale = 2^lod physical pixels (same meaning as in Eye Lab)
    // Optional so older state files (mode and lod only) still decode.
    var gain: Double? = nil  // high-pass contrast gain (default 1.6)
    var keep: Double? = nil  // high-pass: share of the coarse (low-pass) image kept, 0...1
    var mix: Double? = nil   // low-pass: blend from original (0) to fully blurred (1)
}

let modeNames = ["Off", "High-pass", "Low-pass"]

final class SettingsBox {
    private let lock = NSLock()
    private var value = FilterSettings()
    func get() -> FilterSettings { lock.lock(); defer { lock.unlock() }; return value }
    func set(_ v: FilterSettings) { lock.lock(); value = v; lock.unlock() }
}

let settings = SettingsBox()

// MARK: - Metal

let shaderSource = """
#include <metal_stdlib>
using namespace metal;

struct VOut { float4 pos [[position]]; float2 uv; };

vertex VOut vmain(uint vid [[vertex_id]]) {
    float2 p = float2((vid << 1) & 2, vid & 2);
    VOut o;
    o.pos = float4(p * 2.0 - 1.0, 0.0, 1.0);
    o.uv = float2(p.x, 1.0 - p.y);
    return o;
}

struct Params { int mode; float gain; float keep; float mix; };

fragment float4 fmain(VOut in [[stage_in]],
                      texture2d<float> src [[texture(0)]],
                      texture2d<float> blur [[texture(1)]],
                      constant Params& P [[buffer(0)]]) {
    constexpr sampler s(filter::linear, address::clamp_to_edge);
    float3 c = src.sample(s, in.uv).rgb;
    float3 o = c;
    if (P.mode == 1) {
        float3 b = blur.sample(s, in.uv).rgb;
        o = 0.5 + (c - b) * P.gain + (b - 0.5) * P.keep;
    } else if (P.mode == 2) {
        o = mix(c, blur.sample(s, in.uv).rgb, P.mix);
    }
    return float4(o, 1.0);
}
"""

struct Params {
    var mode: Int32
    var gain: Float
    var keep: Float
    var mix: Float
}

final class GPU {
    let device: MTLDevice
    let queue: MTLCommandQueue
    let pipeline: MTLRenderPipelineState
    let scaler: MPSImageBilinearScale

    init?() {
        guard let d = MTLCreateSystemDefaultDevice(), let q = d.makeCommandQueue() else { return nil }
        device = d
        queue = q
        do {
            let lib = try d.makeLibrary(source: shaderSource, options: nil)
            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction = lib.makeFunction(name: "vmain")
            desc.fragmentFunction = lib.makeFunction(name: "fmain")
            desc.colorAttachments[0].pixelFormat = .bgra8Unorm
            pipeline = try d.makeRenderPipelineState(descriptor: desc)
        } catch {
            NSLog("EyeLabOverlay: shader error \(error)")
            return nil
        }
        scaler = MPSImageBilinearScale(device: d)
    }
}

// MARK: - One overlay per display

final class DisplayOverlay: NSObject, SCStreamOutput, SCStreamDelegate {
    let gpu: GPU
    let window: NSWindow
    let layer: CAMetalLayer
    let pixelSize: CGSize
    var stream: SCStream?
    var textureCache: CVMetalTextureCache?
    var small: MTLTexture?
    var blurred: MTLTexture?
    var smallFactor = 0
    let start = CACurrentMediaTime()
    let queue: DispatchQueue

    init(gpu: GPU, screen: NSScreen, index: Int) {
        self.gpu = gpu
        queue = DispatchQueue(label: "eyelab.overlay.\(index)", qos: .userInteractive)
        let scale = screen.backingScaleFactor
        pixelSize = CGSize(width: screen.frame.width * scale, height: screen.frame.height * scale)

        window = NSWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
        window.level = .screenSaver
        window.ignoresMouseEvents = true
        window.isOpaque = true
        window.hasShadow = false
        window.backgroundColor = .black
        window.sharingType = .none
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        window.setFrame(screen.frame, display: false)

        layer = CAMetalLayer()
        layer.device = gpu.device
        layer.pixelFormat = .bgra8Unorm
        layer.framebufferOnly = true
        layer.contentsScale = scale
        layer.drawableSize = pixelSize
        layer.colorspace = CGColorSpace(name: CGColorSpace.sRGB)
        let view = NSView(frame: NSRect(origin: .zero, size: screen.frame.size))
        view.wantsLayer = true
        view.layer = layer
        window.contentView = view
        super.init()
        CVMetalTextureCacheCreate(nil, nil, gpu.device, nil, &textureCache)
    }

    func start(display: SCDisplay, excluding app: SCRunningApplication?) async throws {
        let filter = SCContentFilter(display: display, excludingApplications: app.map { [$0] } ?? [], exceptingWindows: [])
        let config = SCStreamConfiguration()
        config.width = Int(pixelSize.width)
        config.height = Int(pixelSize.height)
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.colorSpaceName = CGColorSpace.sRGB
        config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        config.showsCursor = false      // the real cursor is drawn above every window
        config.queueDepth = 4
        let s = SCStream(filter: filter, configuration: config, delegate: self)
        try s.addStreamOutput(self, type: .screen, sampleHandlerQueue: queue)
        try await s.startCapture()
        stream = s
        await MainActor.run { window.orderFrontRegardless() }
    }

    func stop() {
        stream?.stopCapture { _ in }
        stream = nil
        window.orderOut(nil)
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        NSLog("EyeLabOverlay: stream stopped: \(error)")
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sb.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let rawStatus = attachments.first?[.status] as? Int,
              SCFrameStatus(rawValue: rawStatus) == .complete,
              let pb = CMSampleBufferGetImageBuffer(sb) else { return }
        render(pb)
    }

    var framesRendered = 0

    private func render(_ pb: CVPixelBuffer) {
        guard let cache = textureCache else { return }
        framesRendered += 1
        if framesRendered == 1 || framesRendered == 120 {
            NSLog("EyeLabOverlay: rendered \(framesRendered) frames at \(CVPixelBufferGetWidth(pb))x\(CVPixelBufferGetHeight(pb))")
        }
        let w = CVPixelBufferGetWidth(pb)
        let h = CVPixelBufferGetHeight(pb)
        var cvTex: CVMetalTexture?
        CVMetalTextureCacheCreateTextureFromImage(nil, cache, pb, nil, .bgra8Unorm, w, h, 0, &cvTex)
        guard let cvTex, let src = CVMetalTextureGetTexture(cvTex) else { return }

        let st = settings.get()
        guard let cmd = gpu.queue.makeCommandBuffer() else { return }

        // Blur on a downscaled copy: cheap even for very coarse cutoffs.
        let sigmaFull = 0.8 * pow(2.0, st.lod)
        let factor = max(1, min(16, Int(pow(2.0, max(0.0, st.lod - 2.0)))))
        if [1, 2, 3].contains(st.mode) {
            ensureBlurTextures(width: w, height: h, factor: factor)
            if let small, let blurred {
                gpu.scaler.encode(commandBuffer: cmd, sourceTexture: src, destinationTexture: small)
                let blur = MPSImageGaussianBlur(device: gpu.device, sigma: Float(max(0.5, sigmaFull / Double(factor))))
                blur.edgeMode = .clamp
                blur.encode(commandBuffer: cmd, sourceTexture: small, destinationTexture: blurred)
            }
        }

        guard let drawable = layer.nextDrawable() else { cmd.commit(); return }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = drawable.texture
        pass.colorAttachments[0].loadAction = .dontCare
        pass.colorAttachments[0].storeAction = .store
        guard let enc = cmd.makeRenderCommandEncoder(descriptor: pass) else { return }
        var params = Params(mode: Int32(st.mode), gain: Float(st.gain ?? 1.6),
                            keep: Float(st.keep ?? 0.0), mix: Float(st.mix ?? 1.0))
        enc.setRenderPipelineState(gpu.pipeline)
        enc.setFragmentTexture(src, index: 0)
        enc.setFragmentTexture(blurred ?? src, index: 1)
        enc.setFragmentBytes(&params, length: MemoryLayout<Params>.stride, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
        cmd.present(drawable)
        // Keep the capture buffer alive until the GPU is done with it.
        cmd.addCompletedHandler { _ in _ = cvTex }
        cmd.commit()
    }

    private func ensureBlurTextures(width: Int, height: Int, factor: Int) {
        if factor == smallFactor, small != nil { return }
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm,
                                                         width: max(1, width / factor),
                                                         height: max(1, height / factor),
                                                         mipmapped: false)
        d.usage = [.shaderRead, .shaderWrite]
        d.storageMode = .private
        small = gpu.device.makeTexture(descriptor: d)
        blurred = gpu.device.makeTexture(descriptor: d)
        smallFactor = factor
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate {
    var gpu: GPU!
    var overlays: [DisplayOverlay] = []
    var statusItem: NSStatusItem!
    var statePath: URL!
    var timePath: URL!
    var pollTimer: Timer?
    var lastStateData: Data?
    var secondsUnsaved = 0.0
    var server: LocalServer?

    func applicationDidFinishLaunching(_ note: Notification) {
        let args = CommandLine.arguments
        if args.contains("--selftest") {
            // Compile the GPU pipeline and report, without capturing anything.
            let ok = GPU() != nil
            print(ok ? "selftest: GPU pipeline OK, screen capture permission: \(CGPreflightScreenCaptureAccess())" : "selftest: GPU pipeline FAILED")
            exit(ok ? 0 : 1)
        }
        let fromDesktopApp: Bool
        if let i = args.firstIndex(of: "--state"), i + 1 < args.count {
            statePath = URL(fileURLWithPath: args[i + 1])
            fromDesktopApp = true
        } else {
            // Launched by the website (eyelab-overlay:// link) or by hand: keep our own state.
            let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("Eye Lab Overlay")
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            statePath = dir.appendingPathComponent("overlay.json")
            fromDesktopApp = false
        }
        timePath = statePath.deletingLastPathComponent().appendingPathComponent("overlay_time.json")
        if !fromDesktopApp {
            // The file may still say "off" from last time; the link or the page sets the real mode next.
            var s = (try? Data(contentsOf: statePath)).flatMap { try? JSONDecoder().decode(FilterSettings.self, from: $0) } ?? FilterSettings()
            if s.mode == 0 { s.mode = 1 }
            writeState(s, menu: false)
        }
        readState()
        server = LocalServer(app: self)
        server?.start()

        guard let g = GPU() else { fail("This Mac's graphics card couldn't be set up."); return }
        gpu = g
        setupStatusItem()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.tick() }
        // --no-capture (development): run the menu and local server without capturing,
        // so the website link can be tested without a screen-recording prompt.
        if !args.contains("--no-capture") { Task { await self.startCapture() } }
    }

    func startCapture() async {
        let content: SCShareableContent
        do {
            content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        } catch {
            await MainActor.run { self.askForPermission() }
            return
        }
        let me = content.applications.first { $0.processID == ProcessInfo.processInfo.processIdentifier }
        for (i, screen) in NSScreen.screens.enumerated() {
            guard let id = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID,
                  let display = content.displays.first(where: { $0.displayID == id }) else { continue }
            nonisolated(unsafe) let scr = screen
            let overlay = await MainActor.run { DisplayOverlay(gpu: gpu, screen: scr, index: i) }
            do {
                try await overlay.start(display: display, excluding: me)
                overlays.append(overlay)
            } catch {
                NSLog("EyeLabOverlay: capture failed on display \(id): \(error)")
            }
        }
        if overlays.isEmpty {
            await MainActor.run { self.askForPermission() }
        }
    }

    func askForPermission() {
        CGRequestScreenCaptureAccess()
        let alert = NSAlert()
        alert.messageText = "Eye Lab needs screen recording permission"
        alert.informativeText = "To filter your whole screen, turn on \"Eye Lab Overlay\" in System Settings › Privacy & Security › Screen & System Audio Recording, then switch the whole-screen filter on again.\n\nIf it already looks switched on, the app was updated since you allowed it: select it, remove it with the − button, and switch the filter on again to re-allow it."
        alert.addButton(withTitle: "Open System Settings")
        alert.addButton(withTitle: "Cancel")
        NSApp.activate(ignoringOtherApps: true)
        if alert.runModal() == .alertFirstButtonReturn,
           let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
            NSWorkspace.shared.open(url)
        }
        NSApp.terminate(nil)
    }

    func fail(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Eye Lab Overlay can't start"
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }

    // State file: Eye Lab writes it; the menu bar writes it too, so both stay in sync.
    func readState() {
        guard let data = try? Data(contentsOf: statePath), data != lastStateData else { return }
        lastStateData = data
        if let s = try? JSONDecoder().decode(FilterSettings.self, from: data) {
            settings.set(s)
            if s.mode == 0 { quit() }
        }
    }

    func writeState(_ s: FilterSettings, menu: Bool = true) {
        settings.set(s)
        if let data = try? JSONEncoder().encode(s) {
            try? data.write(to: statePath)
            lastStateData = data
        }
        if menu { rebuildMenu() }
    }

    /// Settings from the website, through the eyelab-overlay:// link or the local server.
    func apply(_ s: FilterSettings) {
        writeState(s)
        if s.mode == 0 { quit() }
    }

    /// Filter seconds per day, including what hasn't been flushed yet.
    func loggedSeconds() -> [String: Double] {
        flushTime()
        guard let data = try? Data(contentsOf: timePath),
              let d = try? JSONDecoder().decode([String: Double].self, from: data) else { return [:] }
        return d
    }

    // eyelab-overlay://on?mode=1&lod=3&gain=1.6&keep=0&mix=1 and eyelab-overlay://off
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where url.scheme == "eyelab-overlay" {
            var s = settings.get()
            if url.host == "off" {
                s.mode = 0
            } else {
                let q = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
                func num(_ name: String) -> Double? { q.first { $0.name == name }?.value.flatMap(Double.init) }
                if let m = num("mode") { s.mode = max(0, min(2, Int(m))) }
                if let v = num("lod") { s.lod = max(0.5, min(7, v)) }
                if let v = num("gain") { s.gain = max(0.5, min(4, v)) }
                if let v = num("keep") { s.keep = max(0, min(1, v)) }
                if let v = num("mix") { s.mix = max(0, min(1, v)) }
                if s.mode == 0 { s.mode = 1 }
            }
            apply(s)
        }
    }

    func tick() {
        readState()
        secondsUnsaved += 0.5
        if secondsUnsaved >= 5 { flushTime() }
    }

    func flushTime() {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.locale = Locale(identifier: "en_US_POSIX")
        let today = fmt.string(from: Date())
        var dict: [String: Double] = [:]
        if let data = try? Data(contentsOf: timePath),
           let d = try? JSONDecoder().decode([String: Double].self, from: data) { dict = d }
        dict[today, default: 0] += secondsUnsaved
        secondsUnsaved = 0
        if let data = try? JSONEncoder().encode(dict) { try? data.write(to: timePath) }
    }

    // Menu bar icon for switching filters without opening Eye Lab.
    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "eye.circle.fill", accessibilityDescription: "Eye Lab filter")
        rebuildMenu()
    }

    func rebuildMenu() {
        let menu = NSMenu()
        let header = NSMenuItem(title: "Eye Lab: whole-screen filter", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())
        let current = settings.get()
        for m in 1..<modeNames.count {
            let item = NSMenuItem(title: modeNames[m], action: #selector(pickMode(_:)), keyEquivalent: "")
            item.tag = m
            item.target = self
            item.state = current.mode == m ? .on : .off
            menu.addItem(item)
        }
        menu.addItem(.separator())
        let finer = NSMenuItem(title: "Finer detail", action: #selector(finer), keyEquivalent: "")
        finer.target = self
        menu.addItem(finer)
        let coarser = NSMenuItem(title: "Coarser detail", action: #selector(coarser), keyEquivalent: "")
        coarser.target = self
        menu.addItem(coarser)
        menu.addItem(.separator())
        let off = NSMenuItem(title: "Turn off", action: #selector(turnOff), keyEquivalent: "q")
        off.target = self
        menu.addItem(off)
        statusItem.menu = menu
    }

    @objc func pickMode(_ sender: NSMenuItem) {
        var s = settings.get()
        s.mode = sender.tag
        writeState(s)
    }

    @objc func finer() {
        var s = settings.get()
        s.lod = max(0.5, s.lod - 0.5)
        writeState(s)
    }

    @objc func coarser() {
        var s = settings.get()
        s.lod = min(7.0, s.lod + 0.5)
        writeState(s)
    }

    @objc func turnOff() {
        var s = settings.get()
        s.mode = 0
        writeState(s)
        quit()
    }

    func quit() {
        flushTime()
        overlays.forEach { $0.stop() }
        NSApp.terminate(nil)
    }

    func applicationWillTerminate(_ note: Notification) {
        flushTime()
    }
}

// MARK: - Local server for the website

/// A tiny HTTP server on 127.0.0.1:47823 so the Eye Lab website can see that the
/// helper is running and change its settings live. Only answers this machine
/// (bound to the loopback address), only with a Host of 127.0.0.1/localhost (so a
/// rebound DNS name can't reach it), and only grants CORS to the Eye Lab site and
/// local development origins.
///   GET  /status  {"running", "version", "permission", "state", "seconds"}
///   POST /state   {"mode", "lod", "gain", "keep", "mix"}  (mode 0 turns off and quits)
final class LocalServer {
    static let port: UInt16 = 47823
    weak var app: AppDelegate?
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "eyelab.server")

    init(app: AppDelegate) { self.app = app }

    func start() {
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: LocalServer.port)!)
        params.allowLocalEndpointReuse = true
        guard let l = try? NWListener(using: params) else {
            NSLog("EyeLabOverlay: local server unavailable")
            return
        }
        l.newConnectionHandler = { [weak self] c in self?.serve(c) }
        l.start(queue: queue)
        listener = l
    }

    private func serve(_ c: NWConnection) {
        c.start(queue: queue)
        read(c, Data())
    }

    private func read(_ c: NWConnection, _ buffer: Data) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, error in
            guard let self else { return }
            var buf = buffer
            if let data { buf.append(data) }
            if error != nil || buf.count > 65536 { c.cancel(); return }
            guard let headEnd = buf.range(of: Data("\r\n\r\n".utf8)) else {
                if done { c.cancel() } else { self.read(c, buf) }
                return
            }
            let head = String(decoding: buf[..<headEnd.lowerBound], as: UTF8.self)
            let lines = head.components(separatedBy: "\r\n")
            let parts = (lines.first ?? "").split(separator: " ")
            var headers: [String: String] = [:]
            for line in lines.dropFirst() {
                if let i = line.firstIndex(of: ":") {
                    headers[line[..<i].lowercased()] = line[line.index(after: i)...].trimmingCharacters(in: .whitespaces)
                }
            }
            let length = Int(headers["content-length"] ?? "0") ?? 0
            let body = buf[headEnd.upperBound...]
            if body.count < length {
                if done { c.cancel() } else { self.read(c, buf) }
                return
            }
            let method = parts.count > 0 ? String(parts[0]) : ""
            let path = parts.count > 1 ? String(parts[1]) : ""
            self.respond(c, method: method, path: path, headers: headers, body: Data(body.prefix(length)))
        }
    }

    private func allowedOrigin(_ origin: String?) -> String? {
        guard let origin, let url = URL(string: origin), let host = url.host else { return nil }
        if ["https://mateolarreaferro.com", "https://www.mateolarreaferro.com"].contains(origin) { return origin }
        if url.scheme == "http" && (host == "localhost" || host == "127.0.0.1") { return origin }
        return nil
    }

    private func respond(_ c: NWConnection, method: String, path: String, headers: [String: String], body: Data) {
        let host = headers["host"] ?? ""
        guard host == "127.0.0.1:\(LocalServer.port)" || host == "localhost:\(LocalServer.port)" else {
            send(c, 421, "{}", origin: nil)
            return
        }
        let origin = allowedOrigin(headers["origin"])
        if headers["origin"] != nil && origin == nil {
            send(c, 403, "{\"error\":\"origin not allowed\"}", origin: nil)
            return
        }
        switch (method, path) {
        case ("OPTIONS", _):
            send(c, 204, "", origin: origin, preflight: true)
        case ("GET", "/status"):
            DispatchQueue.main.async {
                guard let app = self.app else { return }
                let s = settings.get()
                let reply: [String: Any] = [
                    "running": true,
                    "version": 2,
                    "permission": CGPreflightScreenCaptureAccess(),
                    "state": ["mode": s.mode, "lod": s.lod, "gain": s.gain ?? 1.6, "keep": s.keep ?? 0, "mix": s.mix ?? 1],
                    "seconds": app.loggedSeconds(),
                ]
                let json = (try? JSONSerialization.data(withJSONObject: reply)).map { String(decoding: $0, as: UTF8.self) } ?? "{}"
                self.queue.async { self.send(c, 200, json, origin: origin) }
            }
        case ("POST", "/state"):
            guard let s = try? JSONDecoder().decode(FilterSettings.self, from: body) else {
                send(c, 400, "{\"error\":\"bad state\"}", origin: origin)
                return
            }
            var clean = s
            clean.mode = max(0, min(2, s.mode))
            clean.lod = max(0.5, min(7, s.lod))
            send(c, 200, "{\"ok\":true}", origin: origin)
            // Apply after the reply is on its way: mode 0 quits the app.
            queue.asyncAfter(deadline: .now() + 0.05) {
                DispatchQueue.main.async { self.app?.apply(clean) }
            }
        default:
            send(c, 404, "{}", origin: origin)
        }
    }

    private func send(_ c: NWConnection, _ status: Int, _ body: String, origin: String?, preflight: Bool = false) {
        let reason = [200: "OK", 204: "No Content", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 421: "Misdirected Request"][status] ?? "OK"
        var h = "HTTP/1.1 \(status) \(reason)\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: \(body.utf8.count)\r\n"
        if let origin {
            h += "Access-Control-Allow-Origin: \(origin)\r\nVary: Origin\r\n"
            if preflight {
                h += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Max-Age: 600\r\n"
            }
        }
        c.send(content: Data((h + "\r\n" + body).utf8), completion: .contentProcessed { _ in c.cancel() })
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
