#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
static char qdMaterialKey;
// Keep in sync with the native shell radius in ui.css.
static const CGFloat qdCornerRadius=14;
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
// A stretchable rounded mask shapes both the blur and the window shadow.
static NSImage *qd_corner_mask(CGFloat radius) {
 CGFloat edge=radius*2+1;
 NSImage *mask=[NSImage imageWithSize:NSMakeSize(edge,edge) flipped:NO drawingHandler:^BOOL(NSRect rect) {
  [NSColor.blackColor setFill];
  [[NSBezierPath bezierPathWithRoundedRect:rect xRadius:radius yRadius:radius] fill];
  return YES;
 }];
 mask.capInsets=NSEdgeInsetsMake(radius,radius,radius,radius);
 mask.resizingMode=NSImageResizingModeStretch;
 return mask;
}
static void qd_apply_theme(NSWindow *window,const char *theme) {
 // Match the glass to the app theme, not only the system appearance.
 if(theme && strcmp(theme,"light")==0)window.appearance=[NSAppearance appearanceNamed:NSAppearanceNameAqua];
 else if(theme && strcmp(theme,"dark")==0)window.appearance=[NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
 else window.appearance=nil;
}
void qd_material(void *raw,const char *theme) {
 NSWindow *window=(NSWindow*)raw;
 qd_apply_theme(window,theme);
 if(objc_getAssociatedObject(window,&qdMaterialKey))return;
 NSView *content=window.contentView;
 qd_clear_webview(content);
 NSVisualEffectView *effect=[[[NSVisualEffectView alloc]initWithFrame:content.bounds]autorelease];
 effect.material=NSVisualEffectMaterialHUDWindow;
 effect.blendingMode=NSVisualEffectBlendingModeBehindWindow;
 effect.state=NSVisualEffectStateActive;
 effect.maskImage=qd_corner_mask(qdCornerRadius);
 effect.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;
 [window setOpaque:NO];[window setBackgroundColor:NSColor.clearColor];[window setHasShadow:YES];
 [content addSubview:effect positioned:NSWindowBelow relativeTo:nil];
 [window invalidateShadow];
 objc_setAssociatedObject(window,&qdMaterialKey,effect,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
void qd_material_theme(void *raw,const char *theme) {
 NSWindow *window=(NSWindow*)raw;
 qd_apply_theme(window,theme);
 [window invalidateShadow];
}
