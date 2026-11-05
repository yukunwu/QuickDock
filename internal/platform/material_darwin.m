#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
static char qdMaterialKey;
static void qd_clear_webview(NSView *view) {
 if([view isKindOfClass:WKWebView.class]) {
  // WKWebView keeps its own opaque backing even when CSS/window are clear.
  // Wails v3.1's default public-API build leaves its transparency hook a no-op.
  @try { [view setValue:@NO forKey:@"drawsBackground"]; }
  @catch(NSException *exception) { NSLog(@"QuickDock WebView transparency unavailable: %@",exception.reason); }
  if(@available(macOS 12.0,*))((WKWebView*)view).underPageBackgroundColor=NSColor.clearColor;
 }
 for(NSView *child in view.subviews)qd_clear_webview(child);
}
void qd_material(void *raw) {
 NSWindow *window=(NSWindow*)raw;
 if(objc_getAssociatedObject(window,&qdMaterialKey))return;
 NSView *content=window.contentView;
 qd_clear_webview(content);
 NSVisualEffectView *effect=[[[NSVisualEffectView alloc]initWithFrame:content.bounds]autorelease];
 effect.material=NSVisualEffectMaterialHUDWindow;
 effect.blendingMode=NSVisualEffectBlendingModeBehindWindow;
 effect.state=NSVisualEffectStateActive;
 effect.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;
 [window setOpaque:NO];[window setBackgroundColor:NSColor.clearColor];
 [content addSubview:effect positioned:NSWindowBelow relativeTo:nil];
 objc_setAssociatedObject(window,&qdMaterialKey,effect,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
