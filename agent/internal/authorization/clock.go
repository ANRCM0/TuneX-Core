package authorization

import (
	"fmt"
	"time"
)

type Sample struct {
	Wall   time.Time
	Uptime time.Duration
}
type Clock func() (Sample, error)

// SystemClock uses a platform uptime counter that includes suspend. The wall value
// is read immediately after it so a resumed host cannot keep a pre-suspend lease.
func SystemClock() (Sample, error) {
	elapsed, err := uptime()
	if err != nil {
		return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: %w", err)
	}
	return Sample{Wall: time.Now().UTC(), Uptime: elapsed}, nil
}
