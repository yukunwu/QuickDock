#import <Cocoa/Cocoa.h>
#import <ServiceManagement/ServiceManagement.h>
#include <stdlib.h>
static int launchedAtLogin=0;
int qd_login_status(void){
 @autoreleasepool { return (int)[SMAppService mainAppService].status; }
}
char* qd_login_set(int enabled){
 @autoreleasepool {
  NSError *error=nil;SMAppService *service=[SMAppService mainAppService];
  BOOL ok=enabled?[service registerAndReturnError:&error]:[service unregisterAndReturnError:&error];
  // Unregistering an item that was never registered is already the wanted state.
  if(ok||(!enabled&&service.status==SMAppServiceStatusNotRegistered))return NULL;
  return strdup((error.localizedDescription?:@"开机启动设置失败").UTF8String);
 }
}
void qd_login_settings(void){ [SMAppService openSystemSettingsLoginItems]; }
void qd_watch_login_launch(void){
 [[NSNotificationCenter defaultCenter] addObserverForName:NSApplicationDidFinishLaunchingNotification object:nil queue:nil usingBlock:^(NSNotification *note){
  NSAppleEventDescriptor *event=[[NSAppleEventManager sharedAppleEventManager] currentAppleEvent];
  launchedAtLogin=event.eventID==kAEOpenApplication&&[event paramDescriptorForKeyword:keyAEPropData].enumCodeValue==keyAELaunchedAsLogInItem;
 }];
}
int qd_launched_at_login(void){ return launchedAtLogin; }
