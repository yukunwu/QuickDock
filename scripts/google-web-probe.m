// Actual native Google page integration; no Wails bridge in the remote view.
#import "../internal/platform/google_web_darwin.m"
int main(int argc,const char**argv){
 @autoreleasepool {
 NSApplication *app=[NSApplication sharedApplication];[app setActivationPolicy:NSApplicationActivationPolicyProhibited];
 NSWindow *window=[[[NSWindow alloc]initWithContentRect:NSMakeRect(0,0,960,660) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskResizable backing:NSBackingStoreBuffered defer:NO]autorelease];
 const char *options="{\"text\":\"我爱你\",\"source\":\"zh-CN\",\"target\":\"en\",\"submit\":true,\"rect\":{\"x\":0,\"y\":68,\"width\":960,\"height\":564}}";
 qd_google_attach(window,argv[1],options);
 QDGooglePage *page=objc_getAssociatedObject(window,&qdGoogleKey);
 if (@available(macOS 14.0,*))page.view.configuration.preferences.inactiveSchedulingPolicy=WKInactiveSchedulingPolicyNone;
 if(!page || page.view.configuration.userContentController.userScripts.count!=1){puts("FAIL isolated view");return 1;}
 __block int tries=0;
 [NSTimer scheduledTimerWithTimeInterval:1 repeats:YES block:^(NSTimer*timer){
  [page.view evaluateJavaScript:@"JSON.stringify({title:document.title,input:!!document.querySelector('textarea'),bridge:typeof window._wails,translated:/I love you/i.test(document.body.innerText)})" completionHandler:^(id value,NSError *error){
   NSDictionary *result=[value isKindOfClass:[NSString class]]?[NSJSONSerialization JSONObjectWithData:[value dataUsingEncoding:NSUTF8StringEncoding]options:0 error:nil]:nil;
   if([result[@"translated"]boolValue] && [result[@"input"]boolValue] && [result[@"bridge"]isEqualToString:@"undefined"]){
    [timer invalidate];puts("PASS native Google page 我爱你 -> I love you, editable input, no Wails bridge");
    [page.view evaluateJavaScript:@"window.webkit.messageHandlers.quickdockGoogleDraft.postMessage({text:'native-web-draft',source:'zh-CN',target:'en'})" completionHandler:^(id value,NSError *error){
     qd_google_flush(window);
     NSData *saved=[NSData dataWithContentsOfFile:[NSString stringWithUTF8String:argv[1]]];
     NSDictionary *state=saved?[NSJSONSerialization JSONObjectWithData:saved options:0 error:nil]:nil;
     if(![state[@"text"]isEqualToString:@"native-web-draft"]){puts("FAIL persistence");exit(1);}
     qd_google_detach(window);
     if(objc_getAssociatedObject(window,&qdGoogleKey)){puts("FAIL detach");exit(1);}
     qd_google_attach(window,argv[1],"{\"text\":\"\",\"source\":\"auto\",\"target\":\"en\",\"rect\":{\"x\":0,\"y\":68,\"width\":960,\"height\":564}}");
     QDGooglePage *restored=objc_getAssociatedObject(window,&qdGoogleKey);
     if(![restored.state[@"text"]isEqualToString:@"native-web-draft"]){puts("FAIL restore");exit(1);}
     qd_google_detach(window);puts("PASS remote-origin draft persistence, detach, restore");exit(0);
    }];
   }else if(++tries>=30){NSLog(@"FAIL Google page: %@ %@",result,error);exit(1);}
  }];
 }];
 [app run];
 }
 return 0;
}
