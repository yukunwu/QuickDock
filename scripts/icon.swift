import AppKit
let dir=CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath:dir,withIntermediateDirectories:true)
for size in [16,32,128,256,512] { for scale in [1,2] {
 let pixels=size*scale
 let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
 let transform=NSAffineTransform();transform.scale(by:CGFloat(pixels)/1024);transform.concat()
 NSColor(calibratedRed:0.96,green:0.58,blue:0.38,alpha:1).setFill();NSBezierPath(roundedRect:NSRect(x:64,y:64,width:896,height:896),xRadius:220,yRadius:220).fill()
 NSColor(calibratedRed:0.13,green:0.11,blue:0.1,alpha:1).setFill();let bolt=NSBezierPath();bolt.move(to:NSPoint(x:580,y:830));bolt.line(to:NSPoint(x:275,y:450));bolt.line(to:NSPoint(x:475,y:450));bolt.line(to:NSPoint(x:420,y:195));bolt.line(to:NSPoint(x:750,y:590));bolt.line(to:NSPoint(x:535,y:590));bolt.close();bolt.fill();NSGraphicsContext.restoreGraphicsState()
 let suffix=scale==2 ? "@2x" : ""
 try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"\(dir)/icon_\(size)x\(size)\(suffix).png"))
}}
