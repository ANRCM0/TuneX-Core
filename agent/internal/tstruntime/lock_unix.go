//go:build linux || darwin || freebsd

package tstruntime

import (
	"os"
	"path/filepath"
	"syscall"
)

func tightenDirectory(string) error   { return nil }
func protectPrivateFile(string) error { return nil }

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
	if syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		f.Close()
		return nil, ErrCache
	}
	return func() { f.Close() }, nil
}
