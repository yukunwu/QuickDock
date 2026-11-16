//go:build !darwin

package platform

import "unsafe"

func ConfigureMaterial(window unsafe.Pointer, theme string) {}

func SetMaterialTheme(window unsafe.Pointer, theme string) {}
