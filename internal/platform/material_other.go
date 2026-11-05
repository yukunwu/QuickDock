//go:build !darwin

package platform

import "unsafe"

func ConfigureMaterial(window unsafe.Pointer) {}
