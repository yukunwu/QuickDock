package platform

import (
	"github.com/ebitengine/purego"
	"os"
	"sync"
	"unsafe"
)

func PlaceWindow(window unsafe.Pointer, followMouse bool) {
	// Wayland deliberately delegates placement to the compositor; global pointer
	// coordinates and arbitrary top-level movement are not available to clients.
	if os.Getenv("WAYLAND_DISPLAY") != "" || os.Getenv("XDG_SESSION_TYPE") == "wayland" {
		return
	}
	positionLinuxOnce.Do(loadLinuxPosition)
	if positionLinuxMove == nil {
		return
	}
	display, seat, pointer, position, monitor, area, getSize, move := positionLinuxDisplay, positionLinuxSeat, positionLinuxPointer, positionLinuxPosition, positionLinuxMonitor, positionLinuxArea, positionLinuxSize, positionLinuxMove
	d := display()
	if d == 0 {
		return
	}
	p := pointer(seat(d))
	if p == 0 {
		return
	}
	var x, y int32
	position(p, nil, &x, &y)
	m := monitor(d, x, y)
	if m == 0 {
		return
	}
	var r [4]int32
	area(m, &r)
	var width, height int32
	getSize(uintptr(window), &width, &height)
	move(uintptr(window), r[0]+max(0, (r[2]-width)/2), r[1]+max(0, (r[3]-height)/2))
}

var positionLinuxOnce sync.Once
var positionLinuxDisplay func() uintptr
var positionLinuxSeat, positionLinuxPointer func(uintptr) uintptr
var positionLinuxPosition func(uintptr, *uintptr, *int32, *int32)
var positionLinuxMonitor func(uintptr, int32, int32) uintptr
var positionLinuxArea func(uintptr, *[4]int32)
var positionLinuxSize func(uintptr, *int32, *int32)
var positionLinuxMove func(uintptr, int32, int32)

func loadLinuxPosition() {
	lib, err := purego.Dlopen("libgdk-3.so.0", purego.RTLD_NOW|purego.RTLD_GLOBAL)
	if err != nil {
		return
	}
	var display func() uintptr
	var seat func(uintptr) uintptr
	var pointer func(uintptr) uintptr
	var position func(uintptr, *uintptr, *int32, *int32)
	var monitor func(uintptr, int32, int32) uintptr
	var area func(uintptr, *[4]int32)
	purego.RegisterLibFunc(&display, lib, "gdk_display_get_default")
	purego.RegisterLibFunc(&seat, lib, "gdk_display_get_default_seat")
	purego.RegisterLibFunc(&pointer, lib, "gdk_seat_get_pointer")
	purego.RegisterLibFunc(&position, lib, "gdk_device_get_position")
	purego.RegisterLibFunc(&monitor, lib, "gdk_display_get_monitor_at_point")
	purego.RegisterLibFunc(&area, lib, "gdk_monitor_get_workarea")
	gtk, err := purego.Dlopen("libgtk-3.so.0", purego.RTLD_NOW|purego.RTLD_GLOBAL)
	if err != nil {
		return
	}
	var getSize func(uintptr, *int32, *int32)
	var move func(uintptr, int32, int32)
	purego.RegisterLibFunc(&getSize, gtk, "gtk_window_get_size")
	purego.RegisterLibFunc(&move, gtk, "gtk_window_move")

	positionLinuxDisplay, positionLinuxSeat, positionLinuxPointer, positionLinuxPosition, positionLinuxMonitor, positionLinuxArea, positionLinuxSize, positionLinuxMove = display, seat, pointer, position, monitor, area, getSize, move
}
