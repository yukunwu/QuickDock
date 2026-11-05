#import <Cocoa/Cocoa.h>
#include <stdlib.h>
char* qd_metadata(const char* raw) {
 @autoreleasepool {
  NSString *path=[NSString stringWithUTF8String:raw]; NSBundle *bundle=[NSBundle bundleWithPath:path];
  if(!bundle)return NULL;
  NSDictionary *info=bundle.infoDictionary,*localized=bundle.localizedInfoDictionary;
  NSString *name=localized[@"CFBundleDisplayName"]?:localized[@"CFBundleName"]?:info[@"CFBundleDisplayName"]?:info[@"CFBundleName"]?:path.lastPathComponent.stringByDeletingPathExtension;
  NSImage *icon=[[NSWorkspace sharedWorkspace] iconForFile:path];
  NSBitmapImageRep *rep=[[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:96 pixelsHigh:96 bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
  [NSGraphicsContext saveGraphicsState];[NSGraphicsContext setCurrentContext:[NSGraphicsContext graphicsContextWithBitmapImageRep:rep]];[icon drawInRect:NSMakeRect(0,0,96,96) fromRect:NSZeroRect operation:NSCompositingOperationCopy fraction:1];[NSGraphicsContext restoreGraphicsState];
  NSData *png=[rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
  NSDictionary *entry=@{@"name":name,@"bundleId":bundle.bundleIdentifier?:@"",@"icon":[@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]?:@""]};
  NSData *json=[NSJSONSerialization dataWithJSONObject:entry options:0 error:nil];[rep release];
  return json?strdup([[[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding] autorelease].UTF8String):NULL;
 }
}
char* qd_open(const char* raw,int isApp){
 @autoreleasepool {NSString *target=[NSString stringWithUTF8String:raw];NSError *error=nil;
  if(isApp){
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
   NSRunningApplication *app=[[NSWorkspace sharedWorkspace] launchApplicationAtURL:[NSURL fileURLWithPath:target] options:NSWorkspaceLaunchDefault configuration:@{} error:&error];
#pragma clang diagnostic pop
   if(!app)return strdup((error.localizedDescription?:@"应用启动失败").UTF8String);
  }else if(![[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:target]])return strdup("默认浏览器打开失败");
  return NULL;
 }
}

void qd_place(void* raw, int followMouse) {
 @autoreleasepool {
  NSWindow *window=(NSWindow*)raw;
  NSScreen *screen=window.screen;
  if(followMouse){
   NSPoint mouse=[NSEvent mouseLocation];
   for(NSScreen *candidate in [NSScreen screens]){
    if(NSPointInRect(mouse,candidate.frame)){screen=candidate;break;}
   }
  }
  if(!screen)screen=[NSScreen mainScreen];
  if(!screen)return;
  NSRect visible=NSInsetRect(screen.visibleFrame,12,12),frame=window.frame;
  frame.size.width=MIN(frame.size.width,visible.size.width);
  frame.size.height=MIN(frame.size.height,visible.size.height);
  frame.origin=NSMakePoint(NSMidX(visible)-frame.size.width/2,NSMidY(visible)-frame.size.height/2);
  [window setFrame:frame display:YES];
 }
}

// Resolve the user's system proxy (including bypass rules) for this URL.
// PAC execution needs an asynchronous CFNetwork runloop; report it explicitly.
#import <CFNetwork/CFNetwork.h>
char* qd_proxy(const char* raw) {
 @autoreleasepool {
  NSURL *url=[NSURL URLWithString:[NSString stringWithUTF8String:raw]];
  NSDictionary *settings=CFBridgingRelease(CFNetworkCopySystemProxySettings());
  NSArray *proxies=settings ? CFBridgingRelease(CFNetworkCopyProxiesForURL((__bridge CFURLRef)url,(__bridge CFDictionaryRef)settings)) : nil;
  NSDictionary *proxy=proxies.firstObject;
  NSString *type=proxy[(__bridge NSString*)kCFProxyTypeKey];
  if (!type || [type isEqualToString:(__bridge NSString*)kCFProxyTypeNone]) return strdup("");
  if ([type isEqualToString:(__bridge NSString*)kCFProxyTypeAutoConfigurationURL] || [type isEqualToString:(__bridge NSString*)kCFProxyTypeAutoConfigurationJavaScript]) return strdup("PAC");
  NSString *host=proxy[(__bridge NSString*)kCFProxyHostNameKey];
  NSNumber *port=proxy[(__bridge NSString*)kCFProxyPortNumberKey];
  if (!host || !port) return strdup("");
  NSURLComponents *parts=[[NSURLComponents alloc] init];
  parts.scheme=[type isEqualToString:(__bridge NSString*)kCFProxyTypeSOCKS] ? @"socks5" : @"http";
  parts.host=host;parts.port=port;
  char* result=strdup(parts.string.UTF8String);
  [parts release];
  return result;
 }
}
