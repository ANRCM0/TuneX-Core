package diag

import (
	"context"
	"errors"
	"net/netip"
	"os/exec"
	"time"
)

// The Panel derives this peer exclusively from an authorized, Workspace-owned
// topology edge. Literal unicast addresses permit private inter-node networks;
// this action is distinct from public user-originated Looking Glass.
type RouteRequest struct {
	PeerAddress string `json:"peer_address"`
}
type RouteQuality struct {
	PacketsSent     int      `json:"packets_sent"`
	PacketsReceived int      `json:"packets_received"`
	RTTMS           *float64 `json:"rtt_ms"`
}

func RouteProbe(ctx context.Context, request RouteRequest) ([]Result, error) {
	return routeProbe(ctx, request, DetectICMP(), runICMP)
}

func routeProbe(ctx context.Context, request RouteRequest, methods []ICMPAvailability, probe ICMPExec) ([]Result, error) {
	address, err := netip.ParseAddr(request.PeerAddress)
	if err != nil || address.Zone() != "" || address.String() != request.PeerAddress || address.Is4In6() || !address.IsGlobalUnicast() || address.IsLoopback() || address.IsLinkLocalUnicast() {
		return nil, ErrLookingGlassRejected
	}
	method := LookingGlassMethodPing
	if address.Is6() {
		method = LookingGlassMethodPing6
	}
	available := false
	for _, a := range methods {
		if a.Method == method && a.Reason == "" {
			available = true
		}
	}
	result := Result{Host: address.String(), Port: 1, Status: StatusUnsupported}
	if !available {
		return []Result{result}, nil
	}
	binary := ""
	for _, a := range methods {
		if a.Method == method {
			binary = a.Binary
		}
	}
	budget, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	quality := &RouteQuality{}
	total := int64(0)
	result.Status = StatusError
	started := time.Now()
	for i := 0; i < 5; i++ {
		if budget.Err() != nil {
			break
		}
		replied, rtt, _, probeErr := probe(budget, binary, address.String(), 2*time.Second)
		if budget.Err() != nil {
			break
		}
		// Exit 1 is a completed no-reply observation; command/permission failures
		// are absence of evidence, never 100% packet loss.
		if probeErr != nil && !replied {
			var exit *exec.ExitError
			if !errors.As(probeErr, &exit) || exit.ExitCode() != 1 {
				break
			}
		}
		quality.PacketsSent++
		if replied {
			quality.PacketsReceived++
			total += rtt
		}
	}
	result.ElapsedMS = time.Since(started).Milliseconds()
	if quality.PacketsSent == 5 {
		result.Status = StatusTimeout
		if quality.PacketsReceived > 0 {
			result.Status = StatusReachable
			avg := float64(total) / float64(quality.PacketsReceived)
			quality.RTTMS = &avg
		}
		result.RouteQuality = quality
	}
	return []Result{result}, nil
}
