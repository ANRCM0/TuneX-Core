package control

import (
	"context"
	"crypto/tls"

	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
)

type credentialBundle = agentidentity.CredentialBundle
type rotationRequest = agentidentity.RotationRequest

func loadCredential(options Options) (tls.Certificate, error) {
	return agentidentity.LoadCredential(options.Certificate, options.PrivateKey)
}
func prepareRotation(path, nodeID string) (rotationRequest, error) {
	return agentidentity.PrepareRotation(path, nodeID)
}

func (runner *Runner) reloadCredential() error {
	identity, err := runner.identityProvider().LoadMachine(runner.credentialLocations(), runner.options.NodeID, runner.roots)
	if err != nil {
		return err
	}
	certificate, hash := identity.Certificate, identity.Fingerprint
	runner.mutex.Lock()
	changed := runner.credentialFingerprint != hash
	if changed {
		runner.closeProbeLocked()
	}
	runner.certificate = certificate
	runner.credentialUntil = identity.Until
	runner.credentialFingerprint = hash
	guard := runner.guard
	runner.mutex.Unlock()
	if guard != nil {
		if err := guard.Credential(identity.Until); err != nil {
			return err
		}
	}
	if changed && runner.client != nil {
		runner.channelProvider().CloseIdleConnections(runner.client)
	}
	return nil
}
func (runner *Runner) rotate(ctx context.Context) error {
	provider := runner.identityProvider()
	locations := runner.credentialLocations()
	request, err := provider.PrepareRotation(locations.MachineRequest, runner.options.NodeID)
	if err != nil {
		return err
	}
	body, _ := nativeexecution.EncodeCredentialRotation(request)
	raw, err := runner.request(ctx, "POST", "/agent/v3/credentials/rotate", body, true)
	if err != nil {
		return err
	}
	bundle, err := provider.ValidateMachineRotation(locations, runner.options.NodeID, request, raw)
	if err != nil {
		return err
	}
	if err := provider.SaveMachine(locations.MachineBundle, bundle); err != nil {
		return err
	}
	if err := runner.reloadCredential(); err != nil {
		return err
	}
	// An atomic bundle survives a crash with the same pending replay request.
	return provider.Remove(locations.MachineRequest, true)
}
