#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
#include <sys/stat.h>

@interface QDGooglePage : NSObject<WKNavigationDelegate,WKUIDelegate,WKScriptMessageHandler>
@property(retain) WKWebView *view;
@property(copy) NSString *path;
@property(retain) NSDictionary *state;
@property(retain) NSTextField *message;
- (void)save;
@end
@implementation QDGooglePage
- (void)save {
 if(!self.path.length || !self.state)return;
 NSData *data=[NSJSONSerialization dataWithJSONObject:self.state options:0 error:nil];
 if([data writeToFile:self.path options:NSDataWritingAtomic error:nil])chmod(self.path.fileSystemRepresentation,0600);
}
- (void)userContentController:(WKUserContentController*)controller didReceiveScriptMessage:(WKScriptMessage*)message {
 if(![message.frameInfo.securityOrigin.host isEqualToString:@"translate.google.com"] || ![message.body isKindOfClass:[NSDictionary class]])return;
 NSDictionary *body=message.body;
 NSString *text=body[@"text"],*source=body[@"source"],*target=body[@"target"];
 if(![text isKindOfClass:[NSString class]]||text.length>10000||![source isKindOfClass:[NSString class]]||![target isKindOfClass:[NSString class]])return;
 self.state=@{@"text":text,@"source":source,@"target":target};
 [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(save) object:nil];
 [self performSelector:@selector(save) withObject:nil afterDelay:0.25];
}
- (void)webView:(WKWebView*)view didFinishNavigation:(WKNavigation*)navigation {self.message.hidden=YES;}
- (void)webView:(WKWebView*)view didFailProvisionalNavigation:(WKNavigation*)navigation withError:(NSError*)error {
 if(error.code==NSURLErrorCancelled)return;
 self.message.stringValue=@"Google 翻译网页加载失败，请检查网络后点击重新加载";self.message.hidden=NO;
}
- (void)webView:(WKWebView*)view didFailNavigation:(WKNavigation*)navigation withError:(NSError*)error {[self webView:view didFailProvisionalNavigation:navigation withError:error];}
- (void)webView:(WKWebView*)view decidePolicyForNavigationAction:(WKNavigationAction*)action decisionHandler:(void(^)(WKNavigationActionPolicy))handler {
 NSURL *url=action.request.URL;
 if(!action.targetFrame.mainFrame && action.targetFrame){handler(WKNavigationActionPolicyAllow);return;}
 NSString *host=url.host.lowercaseString;
 if([url.scheme isEqualToString:@"https"] && ([host isEqualToString:@"translate.google.com"]||[host isEqualToString:@"accounts.google.com"]||[host isEqualToString:@"consent.google.com"]||[host isEqualToString:@"www.google.com"])){handler(WKNavigationActionPolicyAllow);return;}
 if(action.navigationType==WKNavigationTypeLinkActivated && ([url.scheme isEqualToString:@"https"]||[url.scheme isEqualToString:@"http"]))[[NSWorkspace sharedWorkspace]openURL:url];
 handler(WKNavigationActionPolicyCancel);
}
- (WKWebView*)webView:(WKWebView*)view createWebViewWithConfiguration:(WKWebViewConfiguration*)config forNavigationAction:(WKNavigationAction*)action windowFeatures:(WKWindowFeatures*)features {
 if(!action.targetFrame && [action.request.URL.scheme isEqualToString:@"https"])[[NSWorkspace sharedWorkspace]openURL:action.request.URL];return nil;
}
- (void)dealloc {
 [NSObject cancelPreviousPerformRequestsWithTarget:self];[self save];
 [self.view.configuration.userContentController removeScriptMessageHandlerForName:@"quickdockGoogleDraft"];
 self.view.navigationDelegate=nil;self.view.UIDelegate=nil;
 [_view release];[_path release];[_state release];[_message release];[super dealloc];
}
@end
static char qdGoogleKey;
static NSString *qdGoogleURL(NSDictionary *state){
 NSURLComponents *url=[NSURLComponents componentsWithString:@"https://translate.google.com/"];
 url.queryItems=@[[NSURLQueryItem queryItemWithName:@"sl" value:state[@"source"]?:@"auto"],[NSURLQueryItem queryItemWithName:@"tl" value:state[@"target"]?:@"zh-CN"],[NSURLQueryItem queryItemWithName:@"text" value:state[@"text"]?:@""],[NSURLQueryItem queryItemWithName:@"op" value:@"translate"]];
 return url.string;
}
void qd_google_detach(void *raw){
 NSWindow *window=(NSWindow*)raw;QDGooglePage *page=objc_getAssociatedObject(window,&qdGoogleKey);
 if(!page)return;
 [page save];[page.view stopLoading];[page.view removeFromSuperview];[page.message removeFromSuperview];
 [page.view.configuration.userContentController removeScriptMessageHandlerForName:@"quickdockGoogleDraft"];
 objc_setAssociatedObject(window,&qdGoogleKey,nil,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
void qd_google_attach(void *raw,const char *path,const char *json){
 @autoreleasepool {
 NSWindow *window=(NSWindow*)raw;
 QDGooglePage *page=objc_getAssociatedObject(window,&qdGoogleKey);
 NSDictionary *requested=[NSJSONSerialization JSONObjectWithData:[[NSString stringWithUTF8String:json]dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
 if(page){
  if([requested[@"browser"]boolValue]){[[NSWorkspace sharedWorkspace]openURL:[NSURL URLWithString:qdGoogleURL(page.state)]];return;}
  NSDictionary *rect=requested[@"rect"];
  if([rect isKindOfClass:[NSDictionary class]]){NSRect b=window.contentView.bounds;page.view.frame=NSMakeRect([rect[@"x"]doubleValue],b.size.height-[rect[@"y"]doubleValue]-[rect[@"height"]doubleValue],[rect[@"width"]doubleValue],[rect[@"height"]doubleValue]);}
  if([requested[@"reload"]boolValue]){page.message.hidden=NO;[page.view reload];}
  else if([requested[@"submit"]boolValue]){page.state=requested;[page save];[page.view loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:qdGoogleURL(requested)]]];}
  return;
 }
 page=[[[QDGooglePage alloc]init]autorelease];page.path=[NSString stringWithUTF8String:path];
 NSData *saved=[NSData dataWithContentsOfFile:page.path];
 NSDictionary *state=saved?[NSJSONSerialization JSONObjectWithData:saved options:0 error:nil]:nil;
 if(![state isKindOfClass:[NSDictionary class]]||![state[@"text"]isKindOfClass:[NSString class]]||![state[@"source"]isKindOfClass:[NSString class]]||![state[@"target"]isKindOfClass:[NSString class]])state=nil;
 page.state=[requested[@"submit"]boolValue]?requested:(state?:requested);
 WKWebViewConfiguration *config=[[[WKWebViewConfiguration alloc]init]autorelease];
 // Dedicated controller: remote Google scripts never receive Wails bindings.
 NSString *script=@"(()=>{const send=()=>{const p=new URL(location.href).searchParams;const input=document.querySelector('textarea');window.webkit.messageHandlers.quickdockGoogleDraft.postMessage({text:input ? input.value : (p.get('text') || ''),source:p.get('sl')||'auto',target:p.get('tl')||'zh-CN'});};document.addEventListener('input',e=>{if(e.target instanceof HTMLTextAreaElement)send();},true);document.addEventListener('click',()=>setTimeout(send,300),true);window.addEventListener('popstate',send);})();";
 [config.userContentController addUserScript:[[[WKUserScript alloc]initWithSource:script injectionTime:WKUserScriptInjectionTimeAtDocumentEnd forMainFrameOnly:YES]autorelease]];
 [config.userContentController addScriptMessageHandler:page name:@"quickdockGoogleDraft"];
 NSView *content=window.contentView;
 NSRect frame=content.bounds;NSDictionary *rect=requested[@"rect"];frame=NSMakeRect([rect[@"x"]doubleValue],content.bounds.size.height-[rect[@"y"]doubleValue]-[rect[@"height"]doubleValue],[rect[@"width"]doubleValue],[rect[@"height"]doubleValue]);
 page.view=[[[WKWebView alloc]initWithFrame:frame configuration:config]autorelease];
 page.view.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;page.view.navigationDelegate=page;page.view.UIDelegate=page;
 [content addSubview:page.view];
 page.message=[NSTextField labelWithString:@"正在加载 Google 翻译网页…"];
 page.message.frame=NSMakeRect(20,NSMidY(frame),frame.size.width-40,30);page.message.autoresizingMask=NSViewWidthSizable|NSViewMinYMargin|NSViewMaxYMargin;
 [content addSubview:page.message positioned:NSWindowAbove relativeTo:page.view];
 objc_setAssociatedObject(window,&qdGoogleKey,page,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
 [page.view loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:qdGoogleURL(page.state)]]];
 }
}
void qd_google_flush(void *raw){QDGooglePage *page=objc_getAssociatedObject((NSWindow*)raw,&qdGoogleKey);[page save];}
