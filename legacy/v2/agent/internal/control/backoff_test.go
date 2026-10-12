package control

import (
	"context"
	"testing"
	"time"
)

func TestPollBackoffIsBoundedAndResetsAtZero(t *testing.T) {
	tests := []struct {
		failures int
		want     time.Duration
	}{
		{failures: -1, want: time.Second},
		{failures: 0, want: time.Second},
		{failures: 1, want: time.Second},
		{failures: 2, want: 2 * time.Second},
		{failures: 3, want: 4 * time.Second},
		{failures: 4, want: 8 * time.Second},
		{failures: 5, want: 16 * time.Second},
		{failures: 6, want: 30 * time.Second},
		{failures: 100, want: 30 * time.Second},
	}
	for _, test := range tests {
		if got := pollBackoff(test.failures); got != test.want {
			t.Errorf("pollBackoff(%d) = %s, want %s", test.failures, got, test.want)
		}
	}
}

func TestWaitForPollHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	started := time.Now()
	if err := waitForPoll(ctx, time.Hour); err != context.Canceled {
		t.Fatalf("waitForPoll returned %v, want context.Canceled", err)
	}
	if elapsed := time.Since(started); elapsed > 250*time.Millisecond {
		t.Fatalf("cancelled wait took %s", elapsed)
	}
}
