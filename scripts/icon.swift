import AppKit
let dir=CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath:dir,withIntermediateDirectories:true)
for size in [16,32,128,256,512] { for scale in [1,2] {
 let pixels=size*scale
 let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
 let transform=NSAffineTransform();transform.scale(by:CGFloat(pixels)/1024);transform.concat()
 NSColor.clear.setFill();NSRect(x:0,y:0,width:1024,height:1024).fill()
 NSColor(calibratedRed:0.95,green:0.64,blue:0.12,alpha:1).setFill();let bolt=NSBezierPath();bolt.move(to:NSPoint(x:580,y:830));bolt.line(to:NSPoint(x:275,y:450));bolt.line(to:NSPoint(x:475,y:450));bolt.line(to:NSPoint(x:420,y:195));bolt.line(to:NSPoint(x:750,y:590));bolt.line(to:NSPoint(x:535,y:590));bolt.close();bolt.fill();NSGraphicsContext.restoreGraphicsState()
 let suffix=scale==2 ? "@2x" : ""
 try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"\(dir)/icon_\(size)x\(size)\(suffix).png"))
}}
