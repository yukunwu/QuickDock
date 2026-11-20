#include <dlfcn.h>
// Private but long-stable (macOS 10.13+); looked up at runtime so a missing
// symbol falls back instead of failing to launch.
int qd_lock_screen(void){
 void *login=dlopen("/System/Library/PrivateFrameworks/login.framework/Versions/Current/login",RTLD_LAZY);
 if(!login)return 0;
 int (*lock)(void)=(int(*)(void))dlsym(login,"SACLockScreenImmediate");
 if(!lock)return 0;
 lock();
 return 1;
}
