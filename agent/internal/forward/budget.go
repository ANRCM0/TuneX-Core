package forward

import (
	"fmt"
	"sync"
)

// AcquireNodeBudget shares direct and Relay resource counts, including connecting and draining instances.
func AcquireNodeBudget(protocol string) (func(), error) {
	var permits chan struct{}
	switch protocol {
	case "tcp":
		permits = tcpNodePermits
	case "udp":
		permits = udpNodePermits
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
	select {
	case permits <- struct{}{}:
		var once sync.Once
		return func() { once.Do(func() { <-permits }) }, nil
	default:
		return nil, fmt.Errorf("RESOURCE_LIMIT: Agent process budget exhausted")
	}
}
