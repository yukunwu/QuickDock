package platform

// #include <stdlib.h>
import "C"
import (
	"sync"
	"unsafe"
)

var googleEscapeHandlers sync.Map

func setGoogleEscape(window unsafe.Pointer, handler func()) {
	if handler == nil {
		googleEscapeHandlers.Delete(uintptr(window))
	} else {
		googleEscapeHandlers.Store(uintptr(window), handler)
	}
}

//export qdGoogleEscape
func qdGoogleEscape(window unsafe.Pointer) {
	if handler, ok := googleEscapeHandlers.Load(uintptr(window)); ok {
		handler.(func())()
	}
}

//export qdGoogleHistory
func qdGoogleHistory(window unsafe.Pointer, raw *C.char) {
	googleHistory(uintptr(window), C.GoString(raw))
}
