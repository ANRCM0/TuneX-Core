package control

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"time"

	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/relay"
)

type relayCredentialResponse = agentidentity.RelayResponse
type relayCredentialBundle = agentidentity.RelayBundle

func decodeProtectedJSON(raw []byte, destination any) error {
	return agentidentity.DecodeProtectedJSON(raw, destination)
}
func validateRelayBundle(bundle relayCredentialBundle, node string, roots *x509.CertPool) (tls.Certificate, time.Time, error) {
	return agentidentity.ValidateRelayBundle(bundle, node, roots)
}
func validateRelayBundleAt(bundle relayCredentialBundle, node string, roots *x509.CertPool, checkedAt time.Time) (tls.Certificate, time.Time, error) {
	return agentidentity.ValidateRelayBundleAt(bundle, node, roots, checkedAt)
}

func (runner *Runner) ensureRelayCredential(ctx context.Context) error {
	provider := runner.identityProvider()
	locations := runner.credentialLocations()
	bundle, missing, err := provider.LoadRelay(locations.RelayBundle, runner.key)
	if missing {
		return runner.renewRelayCredential(ctx)
	}
	if err != nil {
		return err
	}
	_, renewAfter, err := nativeexecution.RelayCredentialSchedule(bundle.ValidUntil, bundle.RenewAfter)
	if err != nil {
		return err
	}
	certificate, until, err := provider.ValidateRelay(bundle, runner.options.NodeID, runner.roots)
	if err != nil {
		expired, parseErr := nativeexecution.ParseWireTime(bundle.ValidUntil)
		if parseErr != nil || expired.After(runner.scheduler().Now()) {
			return err
		}
		// Historical verification proves the protected expired identity was well formed.
		// It grants no runtime authority: only authenticated online issuance can restore it.
		if _, _, historyErr := provider.ValidateRelayAt(bundle, runner.options.NodeID, runner.roots, expired.Add(-time.Nanosecond)); historyErr != nil {
			return historyErr
		}
		return runner.renewRelayCredential(ctx)
	}
	runner.mutex.Lock()
	runner.relayCertificate, runner.relayUntil, runner.relayRenewAfter = certificate, until, renewAfter
	runner.mutex.Unlock()
	// A crash after the durable certificate save must not issue or reload its predecessor.
	pending := locations.RelayRequest
	if raw, err := provider.ReadPending(pending); err == nil && bundle.RequestID != "" {
		var request rotationRequest
		if err := provider.DecodeProtected(raw, &request); err != nil {
			return err
		}
		if request.RequestID == bundle.RequestID {
			if err := provider.Remove(pending, false); err != nil {
				return err
			}
		}
	} else if err != nil && !provider.Missing(err) {
		return err
	}
	return nil
}

func (runner *Runner) credentialRenewalLead() time.Duration {
	policy := runner.hello.Policy
	return time.Duration(max(60, policy.LeaseSeconds+2*policy.MaxClockSkewSeconds+2*policy.PollIntervalSeconds)) * time.Second
}

func (runner *Runner) relayRenewalDue() bool {
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	return !runner.scheduler().Now().Before(runner.relayRenewAfter) && runner.scheduler().Until(runner.relayUntil) <= runner.credentialRenewalLead()
}

func (runner *Runner) renewRelayCredential(ctx context.Context) error {
	return runner.renewRelayCredentialAttempt(ctx, true)
}

func (runner *Runner) renewRelayCredentialAttempt(ctx context.Context, retryExpired bool) error {
	provider := runner.identityProvider()
	locations := runner.credentialLocations()
	pending := locations.RelayRequest
	request, err := provider.PrepareRotation(pending, runner.options.NodeID)
	if err != nil {
		return err
	}
	body, _ := nativeexecution.EncodeCredentialRotation(request)
	raw, err := runner.request(ctx, "POST", "/agent/v3/relay-credential", body, true)
	if err != nil {
		return err
	}
	var response relayCredentialResponse
	if err := provider.DecodeProtected(raw, &response); err != nil {
		return err
	}
	bundle := nativeexecution.RelayCredentialResponseBundle(response, request)
	certificate, until, err := provider.ValidateRelay(bundle, runner.options.NodeID, runner.roots)
	if err != nil {
		expiry, parseErr := nativeexecution.ParseWireTime(bundle.ValidUntil)
		if retryExpired && parseErr == nil && !expiry.After(runner.scheduler().Now()) {
			// A committed replay may have expired while this Agent was stopped.
			// Authenticate its exact CSR/keypair/Node before discarding the pending
			// request and obtaining fresh authority; no expired bundle is executed.
			if _, _, verifyErr := provider.ValidateRelayAt(bundle, runner.options.NodeID, runner.roots, expiry.Add(-time.Nanosecond)); verifyErr != nil {
				return verifyErr
			}
			if err := provider.Remove(pending, false); err != nil {
				return err
			}
			return runner.renewRelayCredentialAttempt(ctx, false)
		}
		return err
	}
	var renewAfter time.Time
	if response.OverlapUntil != nil {
		overlap, err := nativeexecution.ParseWireTime(*response.OverlapUntil)
		if err != nil || overlap.After(runner.scheduler().Now().Add(300*time.Second)) || overlap.After(until) {
			return fmt.Errorf("INTEGRITY_FAILURE: Relay overlap is not bounded")
		}
		renewAfter = overlap.Add(time.Second)
		if !renewAfter.Before(until) {
			return fmt.Errorf("AUTHORIZATION_DENIED: Relay credential cannot outlive its overlap")
		}
		bundle = nativeexecution.RelayCredentialWithRenewal(bundle, renewAfter)
	}
	if err := provider.SaveRelay(locations.RelayBundle, runner.key, bundle); err != nil {
		return err
	}
	if err := provider.Remove(pending, true); err != nil {
		return err
	}
	runner.mutex.Lock()
	runner.relayCertificate, runner.relayUntil, runner.relayRenewAfter = certificate, until, renewAfter
	runner.mutex.Unlock()
	return nil
}

func (runner *Runner) relayIdentity() (relay.Identity, time.Time, error) {
	if !runner.options.Relay || runner.relayCertificate.Leaf == nil || !runner.scheduler().Now().Before(runner.relayUntil) {
		return relay.Identity{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Valid Relay identity required")
	}
	return relay.Identity{Certificate: runner.relayCertificate, Roots: runner.roots}, runner.relayUntil, nil
}
