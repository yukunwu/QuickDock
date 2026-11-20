package platform

/*
int qd_lock_screen(void);
*/
import "C"
import "os/exec"

// LockScreen uses the login framework's immediate lock, the same call as the
// menu bar's Lock Screen; without it, sleeping the display locks when a
// password is required after sleep.
func LockScreen() error {
	if C.qd_lock_screen() == 1 {
		return nil
	}
	return exec.Command("/usr/bin/pmset", "displaysleepnow").Run()
}
func Sleep() error { return exec.Command("/usr/bin/pmset", "sleepnow").Run() }
