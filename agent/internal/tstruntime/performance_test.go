package tstruntime

// Opt-in measured workloads. These use production runtimes and durable traffic
// accounting, but do not add a runtime capability, dependency or public endpoint.
import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand/v2"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/tunex/agent/internal/forwarder"
	"github.com/tunex/agent/internal/manager"
)

type perfCase struct {
	Kind        string  `json:"kind"`
	Bytes       int     `json:"bytes"`
	Connections int     `json:"connections"`
	Rounds      int     `json:"rounds"`
	Duration    int     `json:"duration_seconds"`
	RTT         float64 `json:"rtt_ms"`
	Loss        float64 `json:"loss_percent"`
	Output      string  `json:"output"`
}

type perfResources struct {
	Elapsed    float64  `json:"elapsed_seconds"`
	Goroutines int      `json:"goroutines"`
	Heap       uint64   `json:"heap_alloc_bytes"`
	HeapObjs   uint64   `json:"heap_objects"`
	RSS        *uint64  `json:"rss_bytes"`
	FD         *int     `json:"fd_count"`
	CPUTicks   *float64 `json:"cpu_ticks"`
}

func perfGauge(start time.Time) perfResources {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	r := perfResources{Elapsed: time.Since(start).Seconds(), Goroutines: runtime.NumGoroutine(), Heap: mem.HeapAlloc, HeapObjs: mem.HeapObjects}
	if entries, err := os.ReadDir("/proc/self/fd"); err == nil {
		n := len(entries)
		r.FD = &n
	}
	if raw, err := os.ReadFile("/proc/self/status"); err == nil {
		for _, line := range strings.Split(string(raw), "\n") {
			if strings.HasPrefix(line, "VmRSS:") {
				n, _ := strconv.ParseUint(strings.Fields(line)[1], 10, 64)
				n *= 1024
				r.RSS = &n
			}
		}
	}
	if raw, err := os.ReadFile("/proc/self/stat"); err == nil {
		fields := strings.Fields(string(raw)[strings.LastIndex(string(raw), ")")+1:])
		if len(fields) >= 13 {
			a, _ := strconv.ParseFloat(fields[11], 64)
			b, _ := strconv.ParseFloat(fields[12], 64)
			n := a + b
			r.CPUTicks = &n
		}
	}
	return r
}

func perfShape(t *testing.T, c perfCase, port int, protocol string) func() map[string]any {
	t.Helper()
	if c.RTT == 0 && c.Loss == 0 {
		return func() map[string]any { return map[string]any{"mode": "unshaped"} }
	}
	// Never replace a host qdisc: the Python driver owns an isolated namespace.
	self, se := os.Readlink("/proc/self/ns/net")
	host, he := os.Readlink("/proc/1/ns/net")
	if runtime.GOOS != "linux" || os.Getenv("TUNEX_PERF_NETNS") != self || se != nil || he != nil || self == host {
		t.Fatal("shaping requires an isolated Linux network namespace")
	}
	run := func(args ...string) string {
		raw, err := exec.Command("tc", args...).CombinedOutput()
		if err != nil {
			t.Fatalf("isolated netem command failed: %v", err)
		}
		return string(raw)
	}
	commands := [][]string{
		{"qdisc", "add", "dev", "lo", "root", "handle", "1:", "prio", "bands", "3", "priomap", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"},
		{"qdisc", "add", "dev", "lo", "parent", "1:3", "handle", "30:", "netem", "limit", "10000", "delay", fmt.Sprintf("%.3fms", c.RTT/2), "loss", fmt.Sprintf("%.3f%%", c.Loss)},
	}
	for i, direction := range []string{"dst_port", "src_port"} {
		commands = append(commands, []string{"filter", "add", "dev", "lo", "protocol", "ip", "parent", "1:", "prio", strconv.Itoa(i + 1), "flower", "ip_proto", protocol, direction, strconv.Itoa(port), "flowid", "1:3"})
	}
	for _, command := range commands {
		run(command...)
	}
	var cleanupOnce sync.Once
	cleanup := func() { cleanupOnce.Do(func() { run("qdisc", "del", "dev", "lo", "root") }) }
	t.Cleanup(cleanup)
	initialQdisc := json.RawMessage(run("-j", "-s", "qdisc", "show", "dev", "lo"))
	return func() map[string]any {
		stats := json.RawMessage(run("-j", "-s", "qdisc", "show", "dev", "lo"))
		filters := run("-s", "filter", "show", "dev", "lo", "parent", "1:")
		cleanup()
		return map[string]any{
			"mode":          "netem",
			"interface":     "lo",
			"carrier_port":  port,
			"netns":         self,
			"protocol":      protocol,
			"rtt_ms":        c.RTT,
			"loss_percent":  c.Loss,
			"qdisc_stats":   stats,
			"initial_qdisc": initialQdisc,
			"filter_stats":  filters,
			"commands":      commands,
			"cleanup":       "qdisc_deleted",
		}
	}
}

// Echo fixture owns listeners, accepted sockets and workers until shutdown.
func perfEcho(t *testing.T) (int, int, func()) {
	t.Helper()
	tcp, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	udp, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1")})
	if err != nil {
		tcp.Close()
		t.Fatal(err)
	}
	// Eight maximum-size matrix senders can otherwise overflow the target's
	// small platform default before its echo worker is scheduled. This fixture
	// request does not alter the production runtime or host socket defaults.
	if err = udp.SetReadBuffer(4 << 20); err != nil {
		t.Fatal(err)
	}
	if err = udp.SetWriteBuffer(4 << 20); err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var wg sync.WaitGroup
	clients := map[net.Conn]bool{}
	closed := false
	wg.Add(2)
	go func() {
		defer wg.Done()
		for {
			conn, err := tcp.Accept()
			if err != nil {
				return
			}
			mu.Lock()
			if closed {
				mu.Unlock()
				conn.Close()
				return
			}
			clients[conn] = true
			wg.Add(1)
			mu.Unlock()
			go func() {
				defer wg.Done()
				defer conn.Close()
				io.Copy(conn, conn)
				mu.Lock()
				delete(clients, conn)
				mu.Unlock()
			}()
		}
	}()
	go func() {
		defer wg.Done()
		buf := make([]byte, 65507)
		for {
			n, addr, err := udp.ReadFromUDP(buf)
			if err != nil {
				return
			}
			if _, err = udp.WriteToUDP(buf[:n], addr); err != nil {
				return
			}
		}
	}()
	var once sync.Once
	closeAll := func() {
		once.Do(func() {
			mu.Lock()
			closed = true
			for c := range clients {
				c.Close()
			}
			mu.Unlock()
			tcp.Close()
			udp.Close()
			wg.Wait()
		})
	}
	t.Cleanup(closeAll)
	return tcp.Addr().(*net.TCPAddr).Port, udp.LocalAddr().(*net.UDPAddr).Port, closeAll
}

func perfTopology(t *testing.T, c perfCase) (map[string]int, func() map[string]any, func(), *Manager) {
	t.Helper()
	tcp, udp, closeEcho := perfEcho(t)
	ports := map[string]int{"tcp": tcp, "udp": udp}
	carrier, protocol := tcp, "tcp"
	var stop func()
	var mi *Manager
	switch c.Kind {
	case "plain_tcp":
	case "plain_udp":
		carrier, protocol = udp, "udp"
	case "native_relay":
		carrier = freePort(t)
		selector := manager.New(manager.RoundRobin, []forwarder.Target{{Host: "127.0.0.1", Port: tcp, Weight: 1}})
		eg, err := forwarder.NewEgress(forwarder.TunnelConfig{ID: "perf-egress", Mode: forwarder.ModeEgress, Protocol: forwarder.ProtocolTCP, ListenHost: "127.0.0.1", EgressPort: carrier, Targets: []forwarder.Target{{Host: "127.0.0.1", Port: tcp, Weight: 1}}, LBStrategy: forwarder.LBRoundRobin}, selector)
		if err != nil {
			t.Fatal(err)
		}
		if err = eg.Start(); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { eg.Shutdown(0) })
		listen := freePort(t)
		in, err := forwarder.NewSingleHop(forwarder.TunnelConfig{ID: "perf-relay", Mode: forwarder.ModeRelay, Protocol: forwarder.ProtocolTCP, ListenHost: "127.0.0.1", IngressPort: listen, NextHop: fmt.Sprintf("127.0.0.1:%d", carrier)})
		if err != nil {
			t.Fatal(err)
		}
		if err = in.Start(); err != nil {
			t.Fatal(err)
		}
		var stopOnce sync.Once
		stop = func() { stopOnce.Do(func() { in.Shutdown(0); eg.Shutdown(0) }) }
		t.Cleanup(stop)
		ports["tcp"] = listen
		shape := perfShape(t, c, carrier, protocol)
		return ports, shape, func() { stop(); closeEcho() }, nil
	case "tst_tcp", "tst_udp", "tst_mixed":
		carrier = freePort(t)
		used := map[int]bool{carrier: true, tcp: true, udp: true}
		inBindings, outBindings := []Binding{}, []Binding{}
		for i, p := range []string{"tcp", "udp"} {
			if c.Kind != "tst_mixed" && c.Kind != "tst_"+p {
				continue
			}
			listen := freePort(t)
			for used[listen] {
				listen = freePort(t)
			}
			used[listen] = true
			inBindings = append(inBindings, Binding{ForwardID: int64(101 + i), Revision: 1, Protocol: p, ListenHost: "127.0.0.1", ListenPort: listen})
			outBindings = append(outBindings, Binding{ForwardID: int64(101 + i), Revision: 1, Protocol: p, TargetHost: "127.0.0.1", TargetPort: ports[p]})
			ports[p] = listen
		}
		a, b := identities(t)
		mi = testManager(t, t.TempDir(), "perf-in")
		me := testManager(t, t.TempDir(), "perf-out")
		in, out := configFor(t, "ingress", a, carrier, inBindings), configFor(t, "egress", b, carrier, outBindings)
		lease := time.Now().Add(time.Duration(c.Duration)*time.Second + 20*time.Minute).UTC().Format(time.RFC3339Nano)
		in.LeaseExpiresAt, out.LeaseExpiresAt = lease, lease
		shape := perfShape(t, c, carrier, protocol)
		if _, err := me.Apply(out); err != nil {
			t.Fatal(err)
		}
		if _, err := mi.Apply(in); err != nil {
			t.Fatal(err)
		}
		end := time.Now().Add(20 * time.Second)
		for !mi.Status()[0].Ready {
			if time.Now().After(end) {
				t.Fatal("authenticated carrier not ready")
			}
			time.Sleep(10 * time.Millisecond)
		}
		return ports, shape, func() { mi.Close(); me.Close(); closeEcho() }, mi
	default:
		t.Fatal("unknown performance topology")
	}
	shape := perfShape(t, c, carrier, protocol)
	return ports, shape, closeEcho, mi
}

type perfLatency struct {
	Count   int       `json:"count"`
	Median  float64   `json:"median"`
	P95     float64   `json:"p95"`
	P99     float64   `json:"p99"`
	Samples []float64 `json:"samples"`
}

func perfSummary(raw []float64) perfLatency {
	r := perfLatency{Count: len(raw), Samples: raw}
	if len(raw) == 0 {
		return r
	}
	ordered := append([]float64(nil), raw...)
	sort.Float64s(ordered)
	quantile := func(p float64) float64 {
		rank := p * float64(len(ordered)-1)
		low, high := int(math.Floor(rank)), int(math.Ceil(rank))
		return ordered[low] + (ordered[high]-ordered[low])*(rank-float64(low))
	}
	r.Median, r.P95, r.P99 = quantile(.5), quantile(.95), quantile(.99)
	return r
}

func TestPerformanceCase(t *testing.T) {
	path := os.Getenv("TUNEX_PERF_CASE")
	if path == "" {
		t.Skip("opt-in performance matrix/soak")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var c perfCase
	if err = json.Unmarshal(raw, &c); err != nil {
		t.Fatal("invalid performance case JSON")
	}
	if c.Bytes < 16 || c.Bytes > 1<<20 || c.Connections < 1 || c.Connections > 64 || c.Rounds < 2 || c.Rounds > 1000 || c.Duration < 0 || c.Duration > 1800 || math.IsNaN(c.RTT) || math.IsNaN(c.Loss) || c.RTT < 0 || c.RTT > 500 || c.Loss < 0 || c.Loss > 10 || c.Output == "" || c.Kind == "tst_mixed" && c.Connections < 2 {
		t.Fatal("invalid performance case bounds")
	}
	if (strings.HasSuffix(c.Kind, "udp") || c.Kind == "tst_mixed") && c.Bytes > 65507 {
		t.Fatal("datagram payload exceeds protocol limit")
	}
	if err = os.MkdirAll(filepath.Dir(c.Output), 0755); err != nil {
		t.Fatal(err)
	}
	// Initialize the process-wide network poller before the baseline. Its
	// persistent epoll/eventfd descriptors are infrastructure, not case leaks.
	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	probe.Close()
	start := time.Now()
	runtime.GC()
	initial := perfGauge(start)
	ports, shape, stop, mi := perfTopology(t, c)
	defer stop()
	startLoad := time.Now()
	before := perfGauge(start)
	var mu sync.Mutex
	latencies := map[string][]float64{}
	errors := map[string]int{}
	corrupt := map[string]int{}
	counts := map[string]int{}
	random := map[string]*rand.Rand{"tcp": rand.New(rand.NewPCG(1, 2)), "udp": rand.New(rand.NewPCG(3, 4))}
	done := make(chan struct{})
	resources := []perfResources{before}
	var sampler sync.WaitGroup
	sampler.Add(1)
	go func() {
		defer sampler.Done()
		tick := time.NewTicker(time.Second)
		defer tick.Stop()
		for {
			select {
			case <-done:
				return
			case <-tick.C:
				gauge := perfGauge(start)
				resources = append(resources, gauge)
				// A crash or interrupted soak still leaves periodic, redacted evidence.
				mu.Lock()
				progress, encodeErr := json.Marshal(map[string]any{"kind": "tunex-performance-progress", "resource": gauge, "completed": counts, "errors": errors, "corrupt": corrupt})
				mu.Unlock()
				if encodeErr == nil {
					if writeErr := os.WriteFile(c.Output+".progress.json", append(progress, '\n'), 0644); writeErr != nil {
						t.Error("cannot retain periodic performance receipt")
					}
				}
			}
		}
	}()
	var workers sync.WaitGroup
	barrier := make(chan struct{})
	for i := 0; i < c.Connections; i++ {
		protocol := "tcp"
		if strings.HasSuffix(c.Kind, "udp") || c.Kind == "tst_mixed" && i%2 == 1 {
			protocol = "udp"
		}
		workers.Add(1)
		go func(index int, protocol string) {
			defer workers.Done()
			<-barrier
			payload := bytes.Repeat([]byte{byte(index + 1)}, c.Bytes)
			response := make([]byte, len(payload)+1)
			var conn net.Conn
			defer func() {
				if conn != nil {
					conn.Close()
				}
			}()
			for n := 0; ; n++ {
				if c.Duration == 0 && n >= c.Rounds || c.Duration > 0 && time.Since(startLoad) >= time.Duration(c.Duration)*time.Second {
					return
				}
				var err error
				binary.BigEndian.PutUint64(payload[:8], uint64(index+1))
				binary.BigEndian.PutUint64(payload[8:16], uint64(n+1))
				if conn == nil {
					conn, err = net.DialTimeout(protocol, fmt.Sprintf("127.0.0.1:%d", ports[protocol]), 10*time.Second)
					if err != nil {
						mu.Lock()
						errors[protocol]++
						mu.Unlock()
						return
					}
				}
				stamp := time.Now()
				timeout := 5 * time.Second
				if c.Kind == "plain_udp" && c.Loss > 0 {
					timeout = 500 * time.Millisecond
				}
				conn.SetDeadline(stamp.Add(timeout))
				written := 0
				if protocol == "tcp" {
					var copied int64
					copied, err = io.CopyN(conn, bytes.NewReader(payload), int64(len(payload)))
					written = int(copied)
				} else {
					written, err = conn.Write(payload)
				}
				nread := 0
				if err == nil {
					if protocol == "tcp" {
						nread, err = io.ReadFull(conn, response[:len(payload)])
					} else {
						for {
							nread, err = conn.Read(response)
							// A delayed echo of an earlier timed-out datagram is not
							// an echo of this exchange; keep the original deadline.
							if err != nil || nread < 16 || binary.BigEndian.Uint64(response[8:16]) >= uint64(n+1) {
								break
							}
						}
					}
				}
				mu.Lock()
				if err != nil || written != len(payload) || nread != len(payload) || !bytes.Equal(payload, response[:nread]) {
					errors[protocol]++
					if err == nil {
						corrupt[protocol]++
					}
				} else {
					counts[protocol]++
					latency := time.Since(stamp).Seconds() * 1000
					if len(latencies[protocol]) < 10000 {
						latencies[protocol] = append(latencies[protocol], latency)
					} else if slot := random[protocol].IntN(counts[protocol]); slot < 10000 {
						latencies[protocol][slot] = latency
					}
				}
				mu.Unlock()
				if err != nil {
					conn.Close()
					conn = nil
					if protocol == "tcp" || c.Kind != "plain_udp" || c.Loss == 0 {
						return
					}
				}
				if c.Duration > 0 && protocol == "tcp" && (n+1)%20 == 0 {
					conn.Close()
					conn = nil
				}
			}
		}(i, protocol)
	}
	close(barrier)
	workers.Wait()
	elapsed := time.Since(startLoad).Seconds()
	close(done)
	sampler.Wait()
	resources = append(resources, perfGauge(start))
	netem := shape()
	durable := false
	accounted := map[int64]map[string]int64{}
	if mi != nil {
		until := time.Now().Add(5 * time.Second)
		for {
			samples, err := mi.TrafficSamples()
			if err != nil {
				t.Fatal("durable traffic sample unavailable")
			}
			accounted = map[int64]map[string]int64{}
			for _, sample := range samples {
				if accounted[sample.ForwardID] == nil {
					accounted[sample.ForwardID] = map[string]int64{}
				}
				for _, p := range [][2]string{{"in", sample.BytesIn}, {"out", sample.BytesOut}} {
					n, _ := strconv.ParseInt(p[1], 10, 64)
					accounted[sample.ForwardID][p[0]] += n
				}
			}
			durable = true
			for i, protocol := range []string{"tcp", "udp"} {
				if count := counts[protocol]; count > 0 {
					want := int64(count) * int64(c.Bytes)
					entry := accounted[int64(101+i)]
					durable = durable && entry["in"] >= want && entry["out"] >= want
				}
			}
			if durable || time.Now().After(until) {
				break
			}
			time.Sleep(20 * time.Millisecond)
		}
		if !durable {
			t.Error("durable accounting omitted completed payload bytes")
		}
	}
	stop()
	deadline := time.Now().Add(10 * time.Second)
	var stableSince time.Time
	var after perfResources
	for {
		runtime.GC()
		after = perfGauge(start)
		if after.Goroutines <= initial.Goroutines+1 && (initial.FD == nil || after.FD != nil && *after.FD <= *initial.FD+1) {
			if stableSince.IsZero() {
				stableSince = time.Now()
			}
			if time.Since(stableSince) >= time.Second {
				break
			}
		} else {
			stableSince = time.Time{}
		}
		if time.Now().After(deadline) {
			t.Error("workload resources did not quiesce")
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	metrics := map[string]any{}
	for p, count := range counts {
		metrics[p] = map[string]any{"completed": count, "errors": errors[p], "corrupt": corrupt[p], "rtt_ms": perfSummary(latencies[p]), "roundtrip_mib_s": float64(count*c.Bytes*2) / (1 << 20) / elapsed}
	}
	if len(counts) == 0 {
		t.Error("no completed payload")
	}
	for p, n := range errors {
		if n > 0 && !(c.Kind == "plain_udp" && c.Loss > 0 && corrupt[p] == 0) {
			t.Errorf("%s workload failed %d exchanges", p, n)
		}
	}
	if c.Duration == 0 {
		completed := 0
		for _, n := range counts {
			completed += n
		}
		failed := 0
		for _, n := range errors {
			failed += n
		}
		if completed+failed != c.Connections*c.Rounds {
			t.Error("workload population incomplete")
		}
	} else if elapsed < float64(c.Duration) {
		t.Error("soak exited before declared duration")
	}
	result := map[string]any{"kind": "tunex-runtime-performance", "schema_version": 1, "case": c, "platform": runtime.GOOS + "/" + runtime.GOARCH, "go_version": runtime.Version(), "gomaxprocs": runtime.GOMAXPROCS(0), "elapsed_seconds": elapsed, "metrics": metrics, "errors": errors, "corrupt": corrupt, "durable_accounting": durable, "accounted_bytes": accounted, "netem": netem, "initial": initial, "resources": resources, "after_cleanup": after, "passed": !t.Failed(), "latency_sampling": "uniform_reservoir_10000_per_protocol_pcg_1_2_3_4", "resource_sampling_seconds": 1, "cleanup_stable_seconds": 1, "fixture_udp_socket_buffer_requested_bytes": 4 << 20}
	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err = os.MkdirAll(filepath.Dir(c.Output), 0755); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(c.Output, append(encoded, '\n'), 0644); err != nil {
		t.Fatal(err)
	}
	// No generated identity, credentials, config, payload or raw state is emitted.
}
