package platformruntime

import (
	"context"
	"net"
)

type Dialer struct{ value net.Dialer }

// Each old Probe constructor owned one zero-configured native dialer.
func NewDialer() *Dialer { return &Dialer{} }
func (dialer *Dialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	return dialer.value.DialContext(ctx, network, address)
}
