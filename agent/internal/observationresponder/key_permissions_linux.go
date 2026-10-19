//go:build linux

package observationresponder

import (
	"os"
	"syscall"
)

func privateFileAllowed(info os.FileInfo) bool {
	if info == nil || !info.Mode().IsRegular() || (info.Mode().Perm() != 0400 && info.Mode().Perm() != 0600) {
		return false
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	uid := os.Geteuid()
	return ok && stat != nil && uid >= 0 && stat.Uid == uint32(uid)
}
