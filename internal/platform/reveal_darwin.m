#import <Cocoa/Cocoa.h>
int qd_reveal(const char* raw){
 @autoreleasepool {
  NSURL *url=[NSURL fileURLWithPath:[NSString stringWithUTF8String:raw]];
  [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[url]];
  return 1;
 }
}
int qd_open_path(const char* raw){
 @autoreleasepool {
  return [[NSWorkspace sharedWorkspace] openURL:[NSURL fileURLWithPath:[NSString stringWithUTF8String:raw]]]?1:0;
 }
}
