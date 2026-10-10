//go:build windows

package tstruntime

import (
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

// Chmod does not protect secrets on Windows. Protect the dedicated directory's
// DACL and inherit owner, SYSTEM and Administrators access into every state file.
func tightenDirectory(dir string) error {
	return protectWindowsDACL(dir, "D:P(A;OICI;FA;;;OW)(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)")
}
func protectPrivateFile(path string) error {
	return protectWindowsDACL(path, "D:P(A;;FA;;;OW)(A;;FA;;;SY)(A;;FA;;;BA)")
}
func protectWindowsDACL(target, descriptorText string) error {
	path, e := syscall.UTF16PtrFromString(target)
	if e != nil {
		return ErrCache
	}
	sddl, e := syscall.UTF16PtrFromString(descriptorText)
	if e != nil {
		return ErrCache
	}
	advapi := syscall.NewLazyDLL("advapi32.dll")
	var descriptor uintptr
	r, _, _ := advapi.NewProc("ConvertStringSecurityDescriptorToSecurityDescriptorW").Call(uintptr(unsafe.Pointer(sddl)), 1, uintptr(unsafe.Pointer(&descriptor)), 0)
	if r == 0 {
		return ErrCache
	}
	defer syscall.NewLazyDLL("kernel32.dll").NewProc("LocalFree").Call(descriptor)
	r, _, _ = advapi.NewProc("SetFileSecurityW").Call(uintptr(unsafe.Pointer(path)), 0x80000004, descriptor)
	if r == 0 {
		return ErrCache
	}
	return nil
}

// An OS-held byte lock survives neither Close nor process exit. A stale file
// after a crash is harmless; a second Agent cannot overwrite active fences.
func lockStateDirectory(dir string) (func(), error) {
	if privateDirectory(dir) != nil {
		return nil, ErrCache
	}
	path := filepath.Join(dir, "owner.lock")
	if i, e := os.Lstat(path); e == nil && !i.Mode().IsRegular() {
		return nil, ErrCache
	}
	f, e := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if e != nil {
		return nil, ErrCache
	}
	overlapped := &syscall.Overlapped{}
	lock := syscall.NewLazyDLL("kernel32.dll").NewProc("LockFileEx")
	r, _, _ := lock.Call(f.Fd(), 3, 0, 1, 0, uintptr(unsafe.Pointer(overlapped)))
	if r == 0 {
		f.Close()
		return nil, ErrCache
	}
	return func() { f.Close() }, nil
}
