package control

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/tunex/agent/internal/tstruntime"
)

// NewLinkRuntime is deliberately opt-in. Setting a path alone does not enable
// capability advertising. It has no relationship to the public support gate.
func NewLinkRuntime(stateDir, agentID string, guard tstruntime.PortGuard) (*tstruntime.Manager, RuntimeFacts, error) {
	enabled, _ := strconv.ParseBool(strings.TrimSpace(os.Getenv("TUNEX_TST_ENABLED")))
	if !enabled {
		return nil, RuntimeFacts{}, nil
	}
	if stateDir == "" {
		return nil, RuntimeFacts{}, tstruntime.ErrCache
	}
	links, err := tstruntime.New(filepath.Join(stateDir, "tst"), agentID)
	if err != nil {
		return nil, RuntimeFacts{}, err
	}
	if guard == nil {
		_ = links.Close()
		return nil, RuntimeFacts{}, tstruntime.ErrPortConflict
	}
	if err := links.SetPortGuard(guard); err != nil {
		_ = links.Close()
		return nil, RuntimeFacts{}, err
	}
	return links, RuntimeFacts{TSTLink: true}, nil
}

// RestoreLinks uses private cache only for network/5xx outages. Authorization,
// redirects, malformed snapshots and foreign identity never enable fallback.
func RestoreLinks(ctx context.Context, source tstruntime.HTTPSource, links *tstruntime.Manager) (fromCache bool, err error) {
	if links == nil {
		return false, nil
	}
	snapshot, err := source.FetchSnapshot(ctx)
	if err == nil {
		_, err = links.Reconcile(snapshot)
		return false, err
	}
	if !errors.Is(err, tstruntime.ErrPanelUnavailable) {
		return false, err
	}
	if links.NodeDBID() == 0 {
		return false, tstruntime.ErrIdentityMismatch
	}
	_, err = links.Restore()
	return true, err
}

func linkAckCode(err error) string {
	switch {
	case errors.Is(err, tstruntime.ErrStaleGeneration):
		return "stale_generation"
	case errors.Is(err, tstruntime.ErrGenerationConflict):
		return "generation_conflict"
	case errors.Is(err, tstruntime.ErrLeaseExpired):
		return "lease_expired"
	case errors.Is(err, tstruntime.ErrIdentityMismatch):
		return "identity_mismatch"
	case errors.Is(err, tstruntime.ErrPortConflict):
		return "port_conflict"
	case errors.Is(err, tstruntime.ErrCache):
		return "cache_unavailable"
	case errors.Is(err, tstruntime.ErrInvalidConfig), errors.Is(err, tstruntime.ErrDigestMismatch), errors.Is(err, tstruntime.ErrLeaseRegression):
		return "invalid_payload"
	default:
		return "link_failed"
	}
}
