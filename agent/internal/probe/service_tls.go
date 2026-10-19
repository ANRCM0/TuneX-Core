package probe

import (
	"context"
	"net"

	"github.com/tunex/vnext/agent/internal/observationtrust"
)

var errTLSBudget = observationtrust.ErrTLSBudget

// Keep the original Probe-facing error and raw-connection ownership contract.
func handshakeService(ctx context.Context, raw net.Conn, trust *observationtrust.Trust, check func() error) (*observationtrust.Verification, error) {
	verified, err := trust.Handshake(ctx, raw, check)
	if err != nil {
		return nil, ErrDenied
	}
	return verified, nil
}
