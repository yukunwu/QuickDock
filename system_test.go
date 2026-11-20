package main

import "testing"

func TestUnknownSystemCommandIsRejectedBeforeHiding(t *testing.T) {
	// No window exists here: reaching Hide would panic.
	if err := newService(t.TempDir()).RunSystemCommand("shutdown"); err == nil {
		t.Fatal("unknown command accepted")
	}
}
