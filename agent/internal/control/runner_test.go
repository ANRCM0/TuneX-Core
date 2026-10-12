package control

import (
	"context"
	"encoding/json"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/state"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func TestSnapshotRenewalAndPersistenceBeforeBind(t *testing.T) {
	reservation, _ := net.Listen("tcp", "127.0.0.1:0")
	port := uint64(reservation.Addr().(*net.TCPAddr).Port)
	reservation.Close()
	config := contracts.DirectConfig{Target: contracts.Target{Host: "127.0.0.1", Port: 12345}, EgressPolicyRevision: 1, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}
	configHash, _ := contracts.ComputeDigest(config)
	assignment := contracts.Assignment{AssignmentId: "assignment-a", ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, BindingFence: 1, Role: "direct", Protocol: "tcp", Phase: "active", Listener: contracts.Listen{Address: "127.0.0.1", Port: port}, Driver: contracts.Driver{Id: "native.direct.v1", SchemaVersion: 1, Config: config, ConfigDigest: configHash}, DrainTimeoutSeconds: 30}
	generation := uint64(1)
	stableBody := map[string]any{}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			var report contracts.ReportRequest
			json.NewDecoder(r.Body).Decode(&report)
			json.NewEncoder(w).Encode(contracts.ReportAck{ProtocolVersion: 2, NodeId: report.NodeId, BootId: report.BootId, SessionEpoch: report.SessionEpoch, ReportSequence: report.ReportSequence, Status: "accepted"})
			return
		}
		now := time.Now().UTC()
		body := map[string]any{"protocolVersion": 2, "nodeId": "node-a", "sessionEpoch": 1, "snapshotGeneration": generation, "complete": true, "issuedAt": now.Format(time.RFC3339Nano), "validUntil": now.Add(300 * time.Second).Format(time.RFC3339Nano), "assignments": []contracts.Assignment{assignment}, "tombstones": []contracts.Tombstone{}}
		if generation == 1 {
			now = time.Unix(2000000000, 0).UTC()
			body["issuedAt"] = now.Format(time.RFC3339Nano)
			body["validUntil"] = now.Add(300 * time.Second).Format(time.RFC3339Nano)
		}
		hash, _ := contracts.ComputeDigest(body)
		body["snapshotDigest"] = hash
		if stored, ok := stableBody[fmtPort(generation)]; ok {
			json.NewEncoder(w).Encode(stored)
			return
		}
		stableBody[fmtPort(generation)] = body
		json.NewEncoder(w).Encode(body)
	}))
	defer server.Close()
	runner := &Runner{options: Options{URL: server.URL, NodeID: "node-a", BootID: "boot-a", Journal: filepath.Join(t.TempDir(), "journal.json")}, client: server.Client(), key: make([]byte, 32), journal: state.Journal{Fences: make(map[string]uint64), Retired: make(map[string]uint64)}, hello: contracts.HelloResponse{SessionEpoch: 1, Policy: contracts.Policy{LeaseSeconds: 300, MaxClockSkewSeconds: 5, ConnectTimeoutSeconds: 2, MaxTcpConnectionsPerAssignment: 8}}, instances: make(map[string]running)}
	defer runner.stop()
	ctx := context.Background()
	// Future authorization cannot be used, even if structure and digest are valid.
	if err := runner.poll(ctx); err == nil {
		t.Fatal("future-issued snapshot accepted")
	}
	if len(runner.instances) != 0 {
		t.Fatal("invalid snapshot changed sockets")
	}
	generation = 2
	if err := runner.poll(ctx); err != nil {
		t.Fatal(err)
	}
	key := "tcp/" + fmtPort(port)
	original := runner.instances[key].stream
	deadline := runner.deadline
	if err := runner.poll(ctx); err != nil {
		t.Fatal(err)
	}
	if runner.deadline != deadline || runner.instances[key].stream != original {
		t.Fatal("same generation extended lease or restarted listener")
	}
	generation = 3
	if err := runner.poll(ctx); err != nil {
		t.Fatal(err)
	}
	if runner.instances[key].stream != original {
		t.Fatal("lease renewal restarted listener")
	}
	if !runner.deadline.After(deadline) {
		t.Fatal("new generation did not renew authorization")
	}
	persisted, err := state.Load(runner.options.Journal, runner.key)
	if err != nil || persisted.Generation != 3 || persisted.Fences[key] != 1 {
		t.Fatal("high-water not persisted", err)
	}
	generation = 4
	assignment.Driver.Config.Target.Port++
	assignment.Driver.ConfigDigest, _ = contracts.ComputeDigest(assignment.Driver.Config)
	if err := runner.poll(ctx); err == nil {
		t.Fatal("changed execution config reused generation/fence")
	}
	if runner.journal.Generation != 3 || runner.instances[key].stream != original {
		t.Fatal("execution integrity failure changed state")
	}
	assignment.Driver.Config.Target.Port--
	assignment.Driver.ConfigDigest, _ = contracts.ComputeDigest(assignment.Driver.Config)
	generation = 5
	runner.options.Journal = filepath.Join(t.TempDir(), "missing", "journal.json")
	if err := runner.poll(ctx); err == nil {
		t.Fatal("failed persistence accepted")
	}
	if runner.instances[key].stream != original || runner.journal.Generation != 3 {
		t.Fatal("persistence failure changed state")
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	runner.options.Journal = filepath.Join(t.TempDir(), "journal.json")
	if err := runner.poll(cancelled); err == nil {
		t.Fatal("cancelled reconciliation accepted")
	}
}
func fmtPort(port uint64) string { raw, _ := json.Marshal(port); return string(raw) }
