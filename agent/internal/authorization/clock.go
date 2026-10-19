package authorization

import (
	"github.com/tunex/vnext/agent/internal/executiontime"
	"github.com/tunex/vnext/agent/internal/platformclock"
)

type Sample = executiontime.Sample
type Clock = executiontime.Clock

// Legacy default-provider entry; timing decisions do not depend on platform code.
func SystemClock() (Sample, error) { return platformclock.SystemClock() }
