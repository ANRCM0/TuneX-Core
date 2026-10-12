//go:build !linux && !windows

package authorization

import (
	"fmt"
	"time"
)

func uptime() (time.Duration, error) {
	return 0, fmt.Errorf("suspend-aware execution clock is unsupported on this platform")
}
