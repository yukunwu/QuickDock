#import <Cocoa/Cocoa.h>
int qd_reveal(const char* raw){
 @autoreleasepool {
  NSURL *url=[NSURL fileURLWithPath:[NSString stringWithUTF8String:raw]];
  [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[url]];
  return 1;
 }
}
