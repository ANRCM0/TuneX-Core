//go:build !linux

package observationresponder

import "os"

// Non-Linux private-key ownership evidence is deliberately unsupported, including Windows ACLs.
func privateFileAllowed(os.FileInfo) bool { return false }
