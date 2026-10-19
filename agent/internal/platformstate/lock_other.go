//go:build !linux && !windows

package platformstate

import "fmt"

func AcquireLock(path string) (func(), error) {
	return nil, fmt.Errorf("Agent runtime supports Linux and Windows development only")
}
