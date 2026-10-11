package diag

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestRouteProbePinnedPeersAndRealSampleBasis(t *testing.T) {
	calls := 0
	run := func(ctx context.Context, binary, address string, timeout time.Duration) (bool, int64, string, error) {
		calls++
		if address != "10.20.0.2" || binary != "/bin/ping" || timeout != 2*time.Second {
			t.Fatal("unbounded or unpinned probe")
		}
		return true, int64(calls), "private output must never escape", nil
	}
	got, err := routeProbe(context.Background(), RouteRequest{PeerAddress: "10.20.0.2"}, []ICMPAvailability{{Method: "ping", Binary: "/bin/ping"}}, run)
	if err != nil || calls != 5 || len(got) != 1 || got[0].Status != StatusReachable {
		t.Fatalf("bad measurement: %+v %v", got, err)
	}
	q := got[0].RouteQuality
	if q == nil || q.PacketsSent != 5 || q.PacketsReceived != 5 || q.RTTMS == nil || *q.RTTMS != 3 || got[0].Detail != "" {
		t.Fatalf("bad quality: %+v", got)
	}
}

func TestRouteProbeRejectsUnsafeOrUnimplementedPeersWithoutPackets(t *testing.T) {
	for _, addr := range []string{"169.254.169.254", "127.0.0.1", "0.0.0.0", "224.0.0.1", "node.test", "10.20.0.2;id", "fe80::1%eth0", "::ffff:10.20.0.2", "::1"} {
		_, err := routeProbe(context.Background(), RouteRequest{PeerAddress: addr}, []ICMPAvailability{{Method: "ping", Binary: "/bin/ping"}}, func(context.Context, string, string, time.Duration) (bool, int64, string, error) {
			t.Fatal("invalid address emitted a packet")
			return false, 0, "", nil
		})
		if err == nil {
			t.Fatalf("accepted %s", addr)
		}
	}
	got, err := routeProbe(context.Background(), RouteRequest{PeerAddress: "10.20.0.2"}, nil, nil)
	if err != nil || got[0].Status != StatusUnsupported || got[0].RouteQuality != nil {
		t.Fatal("unavailable probe became packet loss")
	}
}

func TestRouteProbeLocalExecutionFailureIsUnmeasured(t *testing.T) {
	got, err := routeProbe(context.Background(), RouteRequest{PeerAddress: "10.20.0.2"}, []ICMPAvailability{{Method: "ping", Binary: "/bin/ping"}}, func(context.Context, string, string, time.Duration) (bool, int64, string, error) {
		return false, 0, "permission denied", errors.New("cannot execute")
	})
	if err != nil || got[0].Status != StatusError || got[0].RouteQuality != nil {
		t.Fatal("local execution failure became network loss")
	}
}
