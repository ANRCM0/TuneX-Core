package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"runtime"
	runtimepprof "runtime/pprof"
	"testing"

	"github.com/tunex/agent/internal/manager"
)

// /debug/runtime exists so the TCP performance baseline can record
// goroutine count, which /proc cannot provide (it only has OS threads). These
// tests pin the two properties that matter for a measurement endpoint: it is
// authenticated like the rest of the management plane, and its numbers are real
// gauge readings rather than zero-valued placeholders.

func TestDebugRuntimeRequiresAuth(t *testing.T) {
	srv := newTestServer(t, manager.NewTunnelManager(manager.NewEgressManager(), ""))
	req := httptest.NewRequest(http.MethodGet, "/debug/runtime", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated /debug/runtime must be 401, got %d", rec.Code)
	}
}

func TestDebugRuntimeRejectsNonGet(t *testing.T) {
	srv := newTestServer(t, manager.NewTunnelManager(manager.NewEgressManager(), ""))
	req := httptest.NewRequest(http.MethodPost, "/debug/runtime", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /debug/runtime must be 405, got %d", rec.Code)
	}
}

func TestDebugRuntimeReportsLiveGauges(t *testing.T) {
	srv := newTestServer(t, manager.NewTunnelManager(manager.NewEgressManager(), ""))
	// A goroutine that provably exists while the handler runs: the measurement
	// must see *this* process, not a copy or a zero value.
	blocked := make(chan struct{})
	started := make(chan struct{})
	go func() {
		close(started)
		<-blocked
	}()
	<-started
	defer close(blocked)

	req := httptest.NewRequest(http.MethodGet, "/debug/runtime", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var stats RuntimeStats
	if err := json.Unmarshal(rec.Body.Bytes(), &stats); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if stats.Goroutines < 2 {
		t.Fatalf("goroutines = %d, want at least the test's two live goroutines", stats.Goroutines)
	}
	if stats.GoVersion != runtime.Version() {
		t.Fatalf("go_version = %q, want %q", stats.GoVersion, runtime.Version())
	}
	if stats.GoMaxProcs < 1 {
		t.Fatalf("gomaxprocs = %d, want >= 1", stats.GoMaxProcs)
	}
	// Heap gauges must be non-zero in any process that has allocated at all:
	// a zero here would mean the JSON shape is wrong (wrong struct tag or a
	// forgotten field), and a baseline recorded with zeros is worse than none.
	if stats.HeapAllocBytes == 0 || stats.HeapSysBytes == 0 {
		t.Fatalf("heap gauges must be real readings, got alloc=%d sys=%d",
			stats.HeapAllocBytes, stats.HeapSysBytes)
	}
}

func TestPprofIsDisabledByDefault(t *testing.T) {
	srv := newTestServer(t, manager.NewTunnelManager(manager.NewEgressManager(), ""))
	req := httptest.NewRequest(http.MethodGet, "/debug/pprof/heap", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("pprof must be disabled by default, got %d", rec.Code)
	}
}

func TestPprofUsesAdminAuthenticationWhenEnabled(t *testing.T) {
	tunnels := manager.NewTunnelManager(manager.NewEgressManager(), "")
	srv, err := New(Options{ListenHost: "127.0.0.1", Token: "test-token", Profile: true}, tunnels, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	unauthenticated := httptest.NewRequest(http.MethodGet, "/debug/pprof/heap", nil)
	unauthenticatedRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(unauthenticatedRec, unauthenticated)
	if unauthenticatedRec.Code != http.StatusUnauthorized {
		t.Fatalf("pprof must require admin auth, got %d", unauthenticatedRec.Code)
	}
	authenticated := httptest.NewRequest(http.MethodGet, "/debug/pprof/heap", nil)
	authenticated.Header.Set("Authorization", "Bearer test-token")
	authenticatedRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(authenticatedRec, authenticated)
	if authenticatedRec.Code != http.StatusOK {
		t.Fatalf("authenticated pprof heap = %d, want 200", authenticatedRec.Code)
	}
}

func TestPprofRoutesRequireAuthAndGet(t *testing.T) {
	tunnels := manager.NewTunnelManager(manager.NewEgressManager(), "")
	srv, err := New(Options{Token: "test-token", Profile: true}, tunnels, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := srv.Handler()
	paths := []string{"/debug/pprof/", "/debug/pprof/profile", "/debug/pprof/trace", "/debug/pprof/symbol"}
	for _, name := range profileNames {
		paths = append(paths, "/debug/pprof/"+name)
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			unauthenticated := httptest.NewRecorder()
			handler.ServeHTTP(unauthenticated, httptest.NewRequest(http.MethodGet, path, nil))
			if unauthenticated.Code != http.StatusUnauthorized {
				t.Fatalf("unauthenticated status = %d", unauthenticated.Code)
			}
			req := httptest.NewRequest(http.MethodPost, path, nil)
			req.Header.Set("Authorization", "Bearer test-token")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusMethodNotAllowed || rec.Header().Get("Allow") != http.MethodGet {
				t.Fatalf("POST status = %d, Allow = %q", rec.Code, rec.Header().Get("Allow"))
			}
		})
	}
}

func TestPprofPrefixDoesNotExposeOtherRuntimeProfiles(t *testing.T) {
	const name = "tunex-api-private-test"
	profile := runtimepprof.Lookup(name)
	if profile == nil {
		profile = runtimepprof.NewProfile(name)
	}
	value := new(int)
	profile.Add(value, 0)
	defer profile.Remove(value)
	tunnels := manager.NewTunnelManager(manager.NewEgressManager(), "")
	srv, err := New(Options{Token: "test-token", Profile: true}, tunnels, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/debug/pprof/" + name, "/debug/pprof/cmdline", "/debug/pprof/heap/extra"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer test-token")
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s status = %d, want 404", path, rec.Code)
		}
	}
}
