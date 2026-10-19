package runtimeplatform

import "context"

// Dialer is a trusted network effect. Connection remains a native adapter type;
// callers still own destination validation, admission, authorization and closure.
type Dialer[Connection any] interface {
	DialContext(ctx context.Context, network, address string) (Connection, error)
}
