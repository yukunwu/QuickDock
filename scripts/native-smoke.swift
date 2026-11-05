// Run against the local development app. Exercises only QuickDock's window.
import AppKit
import CoreGraphics
if let session=CGSessionCopyCurrentDictionary() as? [String:Any], session["CGSSessionScreenIsLocked"] as? Bool == true {
 print("SKIP: macOS is locked; native keyboard/AX validation requires an unlocked desktop.");exit(77)
}
let pid=pid_t(CommandLine.arguments[1])!
func windows()->[[String:Any]] { (CGWindowListCopyWindowInfo(.optionOnScreenOnly,kCGNullWindowID) as? [[String:Any]] ?? []).filter{ ($0[kCGWindowOwnerPID as String] as? Int)==Int(pid) && ($0[kCGWindowLayer as String] as? Int)==0 && (($0[kCGWindowBounds as String] as? [String:Double])?["Width"] ?? 0)>100 } }
func chord(){let source=CGEventSource(stateID:.hidSystemState);let down=CGEvent(keyboardEventSource:source,virtualKey:49,keyDown:true)!;down.flags = .maskAlternate;down.post(tap:.cghidEventTap);let up=CGEvent(keyboardEventSource:source,virtualKey:49,keyDown:false)!;up.flags = .maskAlternate;up.post(tap:.cghidEventTap)}
func wait(_ visible:Bool)->Double?{let start=Date();while Date().timeIntervalSince(start)<2 {if (!windows().isEmpty)==visible{return Date().timeIntervalSince(start)*1000};Thread.sleep(forTimeInterval:0.005)};return nil}
func require(_ condition:Bool,_ message:String){if !condition{print("FAIL:",message);exit(1)}}
let original=NSEvent.mouseLocation,primaryHeight=NSScreen.screens[0].frame.height
defer{CGWarpMouseCursorPosition(CGPoint(x:original.x,y:primaryHeight-original.y))}
if !windows().isEmpty {chord();require(wait(false) != nil,"initial hide")}
for (i,screen) in NSScreen.screens.enumerated(){
 let point=NSPoint(x:screen.frame.midX,y:screen.frame.midY)
 CGWarpMouseCursorPosition(CGPoint(x:point.x,y:primaryHeight-point.y))
 chord();guard let elapsed=wait(true),let win=windows().first,let bounds=win[kCGWindowBounds as String] as? [String:Double] else{print("FAIL: summon on screen",i);exit(1)}
 let cocoa=NSRect(x:bounds["X"]!,y:primaryHeight-bounds["Y"]!-bounds["Height"]!,width:bounds["Width"]!,height:bounds["Height"]!)
 require(screen.visibleFrame.insetBy(dx:-1,dy:-1).contains(cocoa),"window outside screen \(i): \(cocoa)")
 print("PASS screen=\(i) scale=\(screen.backingScaleFactor) window=\(cocoa) keyToVisibleMs=\(String(format:"%.1f",elapsed))")
 chord();require(wait(false) != nil,"toggle hide on screen \(i)");print("PASS same-shortcut hide screen=\(i)")
}
CGWarpMouseCursorPosition(CGPoint(x:original.x,y:primaryHeight-original.y))
let process=Process();process.executableURL=URL(fileURLWithPath:CommandLine.arguments[2]);try process.run();process.waitUntilExit();require(process.terminationStatus==0,"second instance exits cleanly");require(wait(true) != nil,"second instance summons existing window");print("PASS second instance exits and summons existing window")
