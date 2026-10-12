//go:build !linux && !windows

package state

import "fmt"

func AcquireLock(path string) (func(), error) {
	return nil, fmt.Errorf("Agent runtime supports Linux and Windows development only")
}
