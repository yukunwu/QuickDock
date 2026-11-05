package platform

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
