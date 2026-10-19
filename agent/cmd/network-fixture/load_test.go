package main

import (
	"fmt"
	"io"
	"net"
	"os"
	"testing"
)

func TestClassifyLoadError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"payload", nil, "payload-mismatch"},
		{"timeout", &net.OpError{Op: "read", Net: "udp", Err: os.ErrDeadlineExceeded}, "timeout"},
		{"eof", fmt.Errorf("wrapped: %w", io.EOF), "eof"},
		{"closed", net.ErrClosed, "closed"},
		{"other", fmt.Errorf("general I/O failure"), "io-error"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := classifyLoadError(tt.err); got != tt.want {
				t.Fatalf("classifyLoadError(%v) = %q, want %q", tt.err, got, tt.want)
			}
		})
	}
}
