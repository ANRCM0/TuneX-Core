package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/state"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	output := flag.String("out", "", "MAC-protected short-lived OS time status file")
	keyPath := flag.String("key", "", "Protected proof key, separate from status directory")
	watch := flag.Bool("watch", false, "Refresh OS status every five seconds")
	check := flag.Bool("check", false, "Validate synchronization and error budget without changing the OS clock")
	flag.Parse()
	if *check {
		if err := authorization.ValidateProofBoundary(*output, *keyPath, ""); err != nil {
			return err
		}
		clock := authorization.SynchronizedClock(5*time.Second, authorization.ProofOptions{Path: *output, KeyPath: *keyPath})
		sample, err := clock()
		if err != nil {
			return err
		}
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"synchronized": true, "checkedAt": sample.Wall.UTC().Format(time.RFC3339Nano), "maxSkewSeconds": 5})
	}
	if *output == "" && *keyPath == "" {
		status, err := authorization.ReadSystemSynchronization()
		if err != nil {
			return err
		}
		return json.NewEncoder(os.Stdout).Encode(status)
	}
	if *output == "" || *keyPath == "" {
		return fmt.Errorf("out and key must be provided together")
	}
	if err := authorization.ValidateProofBoundary(*output, *keyPath, ""); err != nil {
		return err
	}
	statusDirectory, err := filepath.Abs(filepath.Dir(*output))
	if err != nil {
		return err
	}
	keyDirectory, err := filepath.Abs(filepath.Dir(*keyPath))
	if err != nil {
		return err
	}
	if statusDirectory == keyDirectory {
		return fmt.Errorf("proof key must be separate from writable status directory")
	}
	if err := os.MkdirAll(statusDirectory, 0700); err != nil {
		return err
	}
	if err := os.MkdirAll(keyDirectory, 0700); err != nil {
		return err
	}
	key, err := os.ReadFile(*keyPath)
	if os.IsNotExist(err) {
		key = make([]byte, 32)
		if _, err = rand.Read(key); err != nil {
			return err
		}
		if err := state.AtomicWrite(*keyPath, key); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	if len(key) != 32 {
		return fmt.Errorf("invalid existing proof key")
	}
	context, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	for {
		status, err := authorization.ReadSystemSynchronization()
		if err != nil {
			status = authorization.SyncStatus{Source: "provider-unavailable", Synchronized: false, ObservedAt: time.Now().UTC().Format(time.RFC3339Nano)}
		}
		if err := authorization.WriteProof(*output, key, status); err != nil {
			return err
		}
		if !*watch {
			return nil
		}
		select {
		case <-context.Done():
			return nil
		case <-time.After(5 * time.Second):
		}
	}
}
