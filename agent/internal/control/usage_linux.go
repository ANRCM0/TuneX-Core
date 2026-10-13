//go:build linux

package control

import "syscall"

func processUsage() (*int64, *int64) {
	var usage syscall.Rusage
	if syscall.Getrusage(syscall.RUSAGE_SELF, &usage) != nil {
		return nil, nil
	}
	cpu := usage.Utime.Nano() + usage.Stime.Nano()
	rss := usage.Maxrss * 1024
	return &cpu, &rss
}
