package platform

import (
	"golang.org/x/sys/windows"
	"unsafe"
)

var user32 = windows.NewLazySystemDLL("user32.dll")

type winPoint struct{ X, Y int32 }
type winRect struct{ Left, Top, Right, Bottom int32 }
type monitorInfo struct {
	Size          uint32
	Monitor, Work winRect
	Flags         uint32
}

func PlaceWindow(window unsafe.Pointer, followMouse bool) {
	var monitor uintptr
	if followMouse {
		var point winPoint
		ok, _, _ := user32.NewProc("GetCursorPos").Call(uintptr(unsafe.Pointer(&point)))
		if ok != 0 {
			packed := uint64(uint32(point.X)) | uint64(uint32(point.Y))<<32
			monitor, _, _ = user32.NewProc("MonitorFromPoint").Call(uintptr(packed), 2)
		}
	}
	if monitor == 0 {
		monitor, _, _ = user32.NewProc("MonitorFromWindow").Call(uintptr(window), 2)
	}
	info := monitorInfo{Size: uint32(unsafe.Sizeof(monitorInfo{}))}
	ok, _, _ := user32.NewProc("GetMonitorInfoW").Call(monitor, uintptr(unsafe.Pointer(&info)))
	if ok == 0 {
		return
	}
	var rect winRect
	user32.NewProc("GetWindowRect").Call(uintptr(window), uintptr(unsafe.Pointer(&rect)))
	width := min(rect.Right-rect.Left, info.Work.Right-info.Work.Left)
	height := min(rect.Bottom-rect.Top, info.Work.Bottom-info.Work.Top)
	x := info.Work.Left + (info.Work.Right-info.Work.Left-width)/2
	y := info.Work.Top + (info.Work.Bottom-info.Work.Top-height)/2
	user32.NewProc("SetWindowPos").Call(uintptr(window), 0, uintptr(x), uintptr(y), uintptr(width), uintptr(height), 0x4|0x10)
}
