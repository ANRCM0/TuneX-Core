// Package executionenrollment coordinates first enrollment through trusted native ports.
package executionenrollment

import "fmt"

const InterfaceVersion uint64 = 1

type Options struct {
	URL, NodeID, CA, Root, KeyPath, CertificatePath, PrivatePath, JournalPath string
}

type Credential struct{ Certificate, CA string }

// Platform delegates protected files, native credentials and initial Journal creation
// to their existing owners. It cannot grant execution authorization.
type Platform[Roots any] interface {
	RefuseExisting(certificatePath, journalPath, keyPath string) error
	PrepareDirectories(root, keyPath string) error
	PrepareCSR(root, node, privatePath string) ([]byte, error)
	ReadRoots(path string) (Roots, error)
	ValidateCertificate(node, privatePath string, roots Roots, certificate string) error
	ProtectionKey() ([]byte, error)
	AtomicWrite(path string, raw []byte) error
	InitializeJournal(path string, key []byte, node string) error
}

// Client and Reply are native adapter types. The host retains their original
// deferred cleanup lifetime through certificate validation and all final writes.
type Channel[Roots, Client, Reply any] interface {
	EncodeRequest(node, token string, csr []byte) []byte
	Open(roots Roots) Client
	Post(client Client, url string, body []byte) (Reply, error)
	Decode(reply Reply) (Credential, error)
	CloseReply(reply Reply) error
	CloseIdleConnections(client Client)
}

type Host[Roots, Client, Reply any] struct {
	Platform Platform[Roots]
	Channel  Channel[Roots, Client, Reply]
	// Completion stays inside the original deferred reply/client cleanup lifetime.
	Completed func()
}

func (host Host[Roots, Client, Reply]) Enroll(options Options, token string) error {
	if token == "" {
		return fmt.Errorf("TUNEX_ENROLLMENT_TOKEN required")
	}
	platform, channel := host.Platform, host.Channel
	if err := platform.RefuseExisting(options.CertificatePath, options.JournalPath, options.KeyPath); err != nil {
		return err
	}
	if err := platform.PrepareDirectories(options.Root, options.KeyPath); err != nil {
		return err
	}
	csr, err := platform.PrepareCSR(options.Root, options.NodeID, options.PrivatePath)
	if err != nil {
		return err
	}
	body := channel.EncodeRequest(options.NodeID, token, csr)
	roots, err := platform.ReadRoots(options.CA)
	if err != nil {
		return err
	}
	client := channel.Open(roots)
	defer channel.CloseIdleConnections(client)
	reply, err := channel.Post(client, options.URL, body)
	if err != nil {
		return err
	}
	defer channel.CloseReply(reply)
	credential, err := channel.Decode(reply)
	if err != nil {
		return err
	}
	if err := platform.ValidateCertificate(options.NodeID, options.PrivatePath, roots, credential.Certificate); err != nil {
		return err
	}
	protection, err := platform.ProtectionKey()
	if err != nil {
		return err
	}
	if err := platform.AtomicWrite(options.KeyPath, protection); err != nil {
		return err
	}
	if err := platform.InitializeJournal(options.JournalPath, protection, options.NodeID); err != nil {
		return err
	}
	if err := platform.AtomicWrite(options.CertificatePath, []byte(credential.Certificate)); err != nil {
		return err
	}
	if host.Completed != nil {
		host.Completed()
	}
	return nil
}
