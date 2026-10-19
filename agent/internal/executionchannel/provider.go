// Package executionchannel defines trusted Control channel effects, not authority.
package executionchannel

import (
	"context"
	"errors"
	"fmt"
	"io"
)

const InterfaceVersion uint64 = 1

type HTTPError struct {
	Status int
	Code   string
}

func (problem HTTPError) Error() string {
	return fmt.Sprintf("Control HTTP %d: %s", problem.Status, problem.Code)
}

type Provider[Client, Roots, Certificate any] interface {
	NewClient(roots Roots, certificate func() Certificate) Client
	Request(ctx context.Context, client Client, base, method, path string, body []byte, epoch bool, session uint64) ([]byte, error)
	CloseIdleConnections(client Client)
}

var ErrForbiddenURL = errors.New("Control auxiliary URL refused")

// Body stays caller-owned so validation, cancellation and deferred close keep their original order.
type Reply struct {
	StatusCode int
	Body       io.ReadCloser
}
type Auxiliary[Client any] interface {
	ProbeInstance(ctx context.Context, client Client, base string, raw []byte, epoch uint64) (Reply, error)
	ProbeClaim(ctx context.Context, client Client, base string, raw []byte, epoch uint64) (Reply, error)
	ProbeDelivery(ctx context.Context, client Client, base, path string, raw []byte, epoch uint64) (Reply, error)
	PostTelemetry(ctx context.Context, client Client, base, path string, raw []byte, epoch uint64) (Reply, error)
	CloneTelemetry(client Client, redirectMessage string) (Client, func(), bool)
}
