package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/forward"
	"github.com/tunex/vnext/agent/internal/state"
)

type Options struct{ URL, NodeID, BootID, Certificate, PrivateKey, CA, Journal, JournalKey string }
type httpError struct {
	status int
	code   string
}

func (problem httpError) Error() string {
	return fmt.Sprintf("Control HTTP %d: %s", problem.status, problem.code)
}

type running struct {
	assignment contracts.Assignment
	stream     *forward.TCP
}
type Runner struct {
	options      Options
	client       *http.Client
	key          []byte
	journal      state.Journal
	hello        contracts.HelloResponse
	sequence     uint64
	pending      []byte
	instances    map[string]running
	observations []contracts.Observation
	mutex        sync.Mutex
	deadline     time.Time
	wall         time.Time
	monotonic    time.Time
}

func New(options Options) (*Runner, error) {
	if !strings.HasPrefix(options.URL, "https://") {
		return nil, fmt.Errorf("HTTPS Control URL required")
	}
	ca, err := os.ReadFile(options.CA)
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(ca) {
		return nil, fmt.Errorf("Invalid Control CA")
	}
	certificate, err := tls.LoadX509KeyPair(options.Certificate, options.PrivateKey)
	if err != nil {
		return nil, err
	}
	key, err := os.ReadFile(options.JournalKey)
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("INTEGRITY_FAILURE: journal protection key unavailable")
	}
	journal, err := state.Load(options.Journal, key)
	if err != nil {
		return nil, err
	}
	transport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, Certificates: []tls.Certificate{certificate}, MinVersion: tls.VersionTLS13}}
	return &Runner{options: options, client: &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("Control redirects are forbidden") }}, key: key, journal: journal, instances: make(map[string]running)}, nil
}
func (runner *Runner) request(ctx context.Context, method, path string, body []byte, epoch bool) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(runner.options.URL, "/")+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if epoch {
		request.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(runner.hello.SessionEpoch, 10))
	}
	response, err := runner.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 4194305))
	if err != nil {
		return nil, err
	}
	if response.StatusCode != 200 {
		var problem struct {
			Code string `json:"code"`
		}
		json.Unmarshal(raw, &problem)
		return nil, httpError{response.StatusCode, problem.Code}
	}
	return raw, nil
}
func (runner *Runner) stop() {
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	for key, instance := range runner.instances {
		instance.stream.Close()
		delete(runner.instances, key)
	}
}
func (runner *Runner) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	defer runner.stop()
	defer runner.client.CloseIdleConnections()
	hello := contracts.HelloRequest{ProtocolVersion: 2, NodeId: runner.options.NodeID, BootId: runner.options.BootID, AgentBuild: "vnext-phase1", Capabilities: []string{"native.direct.v1", "tcp"}, LastStoredSnapshotGeneration: runner.journal.Generation}
	body, _ := json.Marshal(hello)
	var raw []byte
	var err error
	for delay := time.Second; ; delay = min(delay*2, 30*time.Second) {
		raw, err = runner.request(ctx, "POST", "/agent/v2/hello", body, false)
		if err == nil {
			break
		}
		var problem httpError
		if errors.As(err, &problem) && (problem.status == 401 || problem.status == 403 || problem.code == "SESSION_SUPERSEDED" || problem.code == "INTEGRITY_FAILURE") {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
	message, err := contracts.ParseMessage("HelloResponse", raw)
	if err != nil {
		return err
	}
	runner.hello = message.(contracts.HelloResponse)
	if runner.hello.NodeId != runner.options.NodeID || runner.hello.BootId != runner.options.BootID {
		return fmt.Errorf("AUTHORIZATION_DENIED: Hello identity mismatch")
	}
	serverTime, err := time.Parse(time.RFC3339Nano, runner.hello.ServerTime)
	if err != nil || time.Since(serverTime) > 5*time.Second || time.Until(serverTime) > 5*time.Second {
		return fmt.Errorf("CLOCK_UNCERTAIN: Clock synchronization required")
	}
	runner.wall = time.Now()
	runner.monotonic = runner.wall
	// Credential validity and wall/monotonic drift are checked independently of network retry/poll intervals.
	cert, err := tls.LoadX509KeyPair(runner.options.Certificate, runner.options.PrivateKey)
	if err != nil {
		return err
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return err
	}
	guardDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		defer close(guardDone)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runner.mutex.Lock()
				expired := !runner.deadline.IsZero() && time.Now().After(runner.deadline)
				if !runner.wall.IsZero() {
					wallElapsed := time.Now().UnixNano() - runner.wall.UnixNano()
					monoElapsed := time.Since(runner.monotonic).Nanoseconds()
					if delta := wallElapsed - monoElapsed; delta > 5e9 || delta < -5e9 {
						expired = true
					}
				}
				expired = expired || time.Now().After(leaf.NotAfter)
				if expired {
					cancel()
					for key, instance := range runner.instances {
						instance.stream.Close()
						delete(runner.instances, key)
					}
				}
				runner.mutex.Unlock()
			}
		}
	}()
	defer func() { cancel(); <-guardDone }()
	// The guard exits when the derived run context is cancelled, including fatal parser/state errors.
	retired := false
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if retired {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Second):
				continue
			}
		}
		if err := runner.poll(ctx); err != nil {
			fmt.Fprintln(os.Stderr, "Agent reconcile failed:", err)
			var problem httpError
			if errors.As(err, &problem) && (problem.status == 401 || problem.status == 403 || problem.code == "SESSION_SUPERSEDED") {
				retired = true
			}
		} else if len(runner.pending) > 0 {
			if err := runner.report(ctx); err != nil {
				fmt.Fprintln(os.Stderr, "Agent report retry pending:", err)
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(runner.hello.Policy.PollIntervalSeconds) * time.Second):
		}
	}
}
func (runner *Runner) poll(ctx context.Context) error {
	if len(runner.pending) > 0 {
		if err := runner.report(ctx); err != nil {
			return err
		}
	}
	raw, err := runner.request(ctx, "GET", "/agent/v2/snapshot?sinceGeneration="+strconv.FormatUint(runner.journal.Generation, 10), nil, true)
	if err != nil {
		return err
	}
	value, err := contracts.ParseMessage("Snapshot", raw)
	if err != nil {
		return err
	}
	snapshot := value.(contracts.Snapshot)
	if snapshot.NodeId != runner.options.NodeID || snapshot.SessionEpoch != runner.hello.SessionEpoch {
		return fmt.Errorf("SESSION_SUPERSEDED")
	}
	if snapshot.SnapshotGeneration < runner.journal.Generation || (snapshot.SnapshotGeneration == runner.journal.Generation && snapshot.SnapshotDigest != runner.journal.Digest) {
		return fmt.Errorf("INTEGRITY_FAILURE: Snapshot history changed")
	}
	now := time.Now()
	valid, err := time.Parse(time.RFC3339Nano, snapshot.ValidUntil)
	if err != nil {
		return err
	}
	issued, err := time.Parse(time.RFC3339Nano, snapshot.IssuedAt)
	if err != nil {
		return err
	}
	remaining := time.Until(valid) - 5*time.Second
	if remaining <= 0 || issued.After(now.Add(5*time.Second)) || valid.Sub(issued) > 300*time.Second {
		return fmt.Errorf("LEASE_EXPIRED: Invalid authorization window")
	}
	changed := snapshot.SnapshotGeneration > runner.journal.Generation
	next := runner.journal
	next.Fences = make(map[string]uint64)
	next.Retired = make(map[string]uint64)
	for key, value := range runner.journal.Fences {
		next.Fences[key] = value
	}
	for key, value := range runner.journal.Retired {
		next.Retired[key] = value
	}
	incoming := make(map[string]bool)
	for _, assignment := range snapshot.Assignments {
		if assignment.Protocol != "tcp" || assignment.Phase != "active" || assignment.Driver.Id != "native.direct.v1" {
			return fmt.Errorf("UNSUPPORTED_CAPABILITY")
		}
		key := fmt.Sprintf("%s/%d", assignment.Protocol, assignment.Listener.Port)
		incoming[key] = true
		if assignment.BindingFence < next.Fences[key] || assignment.BindingFence <= next.Retired[key] {
			return fmt.Errorf("FENCING_REJECTED")
		}
		next.Fences[key] = assignment.BindingFence
	}
	for key, fence := range next.Fences {
		if !incoming[key] {
			next.Retired[key] = max(next.Retired[key], fence)
		}
	}
	for _, tombstone := range snapshot.Tombstones {
		key := fmt.Sprintf("%s/%d", tombstone.Protocol, tombstone.Port)
		next.Retired[key] = max(next.Retired[key], tombstone.BindingFence)
	}
	next.Generation = snapshot.SnapshotGeneration
	next.Digest = snapshot.SnapshotDigest
	next.Snapshot = append([]byte(nil), raw...)
	if changed {
		if err := state.Save(runner.options.Journal, runner.key, next); err != nil {
			return fmt.Errorf("PERSISTENCE_FAILURE: %w", err)
		}
	}
	runner.journal = next
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if ctx.Err() != nil || time.Until(valid) <= 5*time.Second {
		return fmt.Errorf("LEASE_EXPIRED: Authorization ended before execution")
	}
	if changed {
		runner.deadline = now.Add(min(remaining, 300*time.Second))
	}
	if time.Now().After(runner.deadline) {
		return fmt.Errorf("LEASE_EXPIRED: Accepted authorization already ended")
	}
	for key, instance := range runner.instances {
		if !incoming[key] {
			instance.stream.Close()
			delete(runner.instances, key)
		}
	}
	runner.observations = nil
	for _, assignment := range snapshot.Assignments {
		if ctx.Err() != nil || time.Now().After(runner.deadline) {
			return fmt.Errorf("LEASE_EXPIRED: Authorization ended before bind")
		}
		key := fmt.Sprintf("%s/%d", assignment.Protocol, assignment.Listener.Port)
		obs := contracts.Observation{AssignmentId: assignment.AssignmentId, DeploymentGeneration: assignment.DeploymentGeneration, BindingFence: assignment.BindingFence, Phase: "active", Condition: "ready", Retryable: false}
		if existing, ok := runner.instances[key]; ok && (existing.assignment.Driver.ConfigDigest != assignment.Driver.ConfigDigest || existing.assignment.DeploymentGeneration != assignment.DeploymentGeneration || existing.assignment.BindingFence != assignment.BindingFence) {
			code := "UNSUPPORTED_CAPABILITY"
			obs.Condition = "error"
			obs.ErrorCode = &code
		} else if !ok {
			stream, startErr := forward.Start(assignment, runner.hello.Policy)
			if startErr != nil {
				code := "PORT_IN_USE"
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = true
			} else {
				runner.instances[key] = running{assignment, stream}
			}
		}
		runner.observations = append(runner.observations, obs)
	}
	if runner.sequence >= contracts.MaxCounter {
		return fmt.Errorf("RESOURCE_LIMIT: Report sequence exhausted")
	}
	runner.sequence++
	report := contracts.ReportRequest{ProtocolVersion: 2, NodeId: runner.options.NodeID, BootId: runner.options.BootID, SessionEpoch: runner.hello.SessionEpoch, ReportSequence: runner.sequence, ObservedAt: now.UTC().Format(time.RFC3339Nano), AcceptedSnapshotGeneration: runner.journal.Generation, Observations: runner.observations, Drains: []contracts.Drain{}}
	if report.Observations == nil {
		report.Observations = []contracts.Observation{}
	}
	runner.pending, err = json.Marshal(report)
	return err
}
func (runner *Runner) report(ctx context.Context) error {
	raw, err := runner.request(ctx, "POST", "/agent/v2/report", runner.pending, true)
	if err != nil {
		return err
	}
	value, err := contracts.ParseMessage("ReportAck", raw)
	if err != nil {
		return err
	}
	ack := value.(contracts.ReportAck)
	if ack.NodeId != runner.options.NodeID || ack.BootId != runner.options.BootID || ack.SessionEpoch != runner.hello.SessionEpoch || ack.ReportSequence != runner.sequence {
		return fmt.Errorf("INTEGRITY_FAILURE: ACK mismatch")
	}
	runner.pending = nil
	return nil
}
