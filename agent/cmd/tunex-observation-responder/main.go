package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/tunex/vnext/agent/internal/observationresponder"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	scope := flag.String("scope-id", "", "Explicit original Scope identity; source CIDRs do not authenticate Scope membership")
	service := flag.String("service-id", "", "Explicit independent observation service identity")
	serverName := flag.String("server-name", "", "Exact lowercase DNS certificate/SNI name, never resolved as a target")
	listen := flag.String("listen", "", "Explicit canonical numeric unicast IP:port; no wildcard or port zero")
	certificate := flag.String("cert", "", "Operator file containing exactly one dedicated observation server leaf")
	key := flag.String("key", "", "Separate owner-only operator private-key file; no Agent or Relay identity loading")
	allow := flag.String("allow-cidrs", "", "Required comma-separated canonical incoming source CIDRs, at most 32; not authentication")
	until := flag.String("valid-until", "", "Required canonical UTC millisecond expiry within seven days, not later than leaf NotAfter")
	maximum := flag.Int("max-connections", observationresponder.DefaultMaxConnections, "Active TLS connections, from 1 to 64; excess accepted sockets close without queueing")
	rate := flag.Int("handshakes-per-second", observationresponder.DefaultHandshakesPerSecond, "Global TLS admission token rate from 1 to 64; burst is min(rate,max-connections)")
	flag.Parse()
	if flag.NArg() != 0 || *allow == "" || len(*allow) > observationresponder.MaximumAllowedCIDRs*65 ||
		*maximum < 1 || *maximum > observationresponder.MaximumConnections || *rate < 1 || *rate > observationresponder.MaximumHandshakesPerSecond {
		return fmt.Errorf("OBSERVATION_CONFIG_INVALID: explicit bounded flags and nonempty source CIDRs required")
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	return observationresponder.Run(ctx, observationresponder.Config{ScopeID: *scope, ServiceID: *service, ServerName: *serverName,
		Listen: *listen, CertificatePath: *certificate, PrivateKeyPath: *key, AllowCIDRs: strings.Split(*allow, ","), ValidUntil: *until,
		MaxConnections: *maximum, HandshakesPerSecond: *rate})
}
