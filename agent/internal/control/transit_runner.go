package control

import (
	"fmt"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3transit"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/state"
)

// TransitObservation is local diagnostic evidence only, NOT a production ADP/3
// Report. Future Control must publish and acknowledge it under a durable lease.
type TransitObservation struct {
	AssignmentID string
	Generation   uint64
	Fence        uint64
	Phase        string
	Condition    string
	ErrorCode    string
}

// TransitController is a pre-integration executor adapter. It deliberately has
// NO call site in Runner.Run / Runner.poll, which only receive Direct/Relay.
// Future live integration must provide an authenticated Control authority,
// a confirmed capability negotiation and an exclusive physical-port guard.
type TransitController struct {
	mu               sync.Mutex
	path             string
	key              []byte
	node             string
	epoch            uint64
	journal          state.TransitJournal
	identity         nativeexecution.OfflineTransitIdentity
	capabilities     []string
	authorize        func() error
	reserveLocalPort func(adp3transit.Assignment) error
	engines          map[string]executionhost.PreparedInstance
	now              func() time.Time
	closed           bool
}

func NewTransitController(
	path string, key []byte, node string, epoch uint64, advertised []string,
	certificate nativeexecution.OfflineTransitCertificate, roots *nativeexecution.OfflineTransitRoots,
	authorize func() error, reserveLocalPort func(adp3transit.Assignment) error,
) (*TransitController, error) {
	if authorize == nil || reserveLocalPort == nil || !nativeexecution.OfflineTransitIdentityAvailable(certificate, roots) || epoch == 0 {
		return nil, fmt.Errorf("AUTHORIZATION_DENIED: Live Transit authorizer, peer identity, Node epoch and resource guard required")
	}
	if err := adp3transit.RequireCapabilities(advertised); err != nil {
		return nil, err
	}
	journal, err := state.LoadTransitJournal(path, key, node)
	if err != nil {
		return nil, err
	}
	if err = authorize(); err != nil {
		return nil, err
	}
	return &TransitController{
		path: path, key: append([]byte(nil), key...), node: node, epoch: epoch,
		journal: journal, identity: nativeexecution.OfflineTransitPeerIdentity(certificate, roots),
		capabilities: append([]string(nil), advertised...),
		authorize:    authorize, reserveLocalPort: reserveLocalPort,
		engines: map[string]executionhost.PreparedInstance{}, now: (platformruntime.Schedule{}).Now,
	}, nil
}
func transitErrorCode(err error) string { return nativeexecution.OfflineTransitErrorCode(err) }

// ApplyTransitSnapshot persists complete high-water before creating any Engine.
// This is intentionally NOT attached to the deployed ADP/3 HTTP poll loop.
// A cached snapshot is never resumed after restart: require a new generation.
func (c *TransitController) ApplyTransitSnapshot(raw []byte) ([]TransitObservation, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil, fmt.Errorf("LEASE_EXPIRED: Transit controller stopped")
	}
	if err := adp3transit.RequireCapabilities(c.capabilities); err != nil {
		return nil, err
	}
	if err := c.authorize(); err != nil {
		return nil, err
	}
	s, err := adp3transit.ParseSnapshot(raw)
	if err != nil {
		return nil, err
	}
	if s.NodeId != c.node || s.SessionEpoch != c.epoch {
		return nil, fmt.Errorf("SESSION_SUPERSEDED: Transit Node identity/epoch differs")
	}
	if s.SnapshotGeneration <= c.journal.Generation {
		return nil, fmt.Errorf("FENCING_REJECTED: Transit replay requires a new generation")
	}
	issued, err := nativeexecution.ParseWireTime(s.IssuedAt)
	if err != nil {
		return nil, err
	}
	deadline, err := nativeexecution.ParseWireTime(s.ValidUntil)
	if err != nil {
		return nil, err
	}
	now := c.now()
	if issued.After(now.Add(time.Second)) || !now.Before(deadline) {
		return nil, fmt.Errorf("LEASE_EXPIRED: Current Transit Snapshot authorization required")
	}
	for _, a := range s.Assignments {
		if err := c.authorize(); err != nil {
			return nil, err
		}
		if err := c.reserveLocalPort(a); err != nil {
			return nil, err
		}
	}
	if err := c.authorize(); err != nil {
		return nil, err
	}
	next, err := state.AcceptTransitSnapshot(c.path, c.key, c.journal, *s)
	if err != nil {
		return nil, err
	}
	// Once the high-water has committed, retire every prior in-memory Engine.
	// A failed preparation remains durable but cannot resurrect its old Fence.
	c.journal = next
	for key, engine := range c.engines {
		engine.Close()
		delete(c.engines, key)
	}
	observations := make([]TransitObservation, 0, len(s.Assignments))
	for _, a := range s.Assignments {
		observation := TransitObservation{
			AssignmentID: a.AssignmentId, Generation: a.DeploymentGeneration,
			Fence: a.BindingFence, Phase: a.Phase, Condition: "prepared",
		}
		check := func() error {
			if err := c.authorize(); err != nil {
				return err
			}
			if !c.now().Before(deadline) {
				return fmt.Errorf("LEASE_EXPIRED: Transit Snapshot ended")
			}
			return nil
		}
		if err := check(); err != nil {
			observation.Condition = "error"
			observation.ErrorCode = transitErrorCode(err)
			observations = append(observations, observation)
			continue
		}
		rawIntent, marshalErr := nativeexecution.EncodeOfflineTransitIntent(a)
		if marshalErr != nil {
			return observations, marshalErr
		}
		engine, prepareErr := nativeexecution.PrepareOfflineTransit(rawIntent, c.identity, check)
		if prepareErr == nil && a.Phase == "active" {
			prepareErr = engine.Activate() // requires authenticated downstream readiness probe
		}
		if prepareErr != nil {
			if engine != nil {
				engine.Close()
			}
			observation.Condition = "error"
			observation.ErrorCode = transitErrorCode(prepareErr)
		} else if a.Phase == "draining" {
			engine.Close() // no ingress accepted during a drain transition
			observation.Condition = "removed"
		} else {
			if a.Phase == "active" {
				observation.Condition = "ready"
			}
			c.engines[a.AssignmentId] = engine
		}
		observations = append(observations, observation)
	}
	return observations, nil
}
func (c *TransitController) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	c.closed = true
	for key, engine := range c.engines {
		engine.Close()
		delete(c.engines, key)
	}
}

// CurrentJournal exposes only the committed high-water, never a lease or
// network permission. A new controller cannot restart cached engines.
func (c *TransitController) CurrentJournal() (uint64, string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.journal.Generation, c.journal.Digest
}
