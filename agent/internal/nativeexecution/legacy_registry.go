package nativeexecution

import (
	"fmt"
	"slices"

	"github.com/tunex/vnext/agent/internal/executiondriver"
)

// Legacy prechecks deliberately precede the strict public host registry.
// Function availability is passed before private callback wrappers are built.
func ValidateLegacyDriverHeader(descriptor executiondriver.Descriptor, start, phase, classify bool) error {
	if descriptor.ID == "" || descriptor.HostVersion != executiondriver.HostVersion || descriptor.SchemaVersion == 0 || !start || !phase || !classify {
		return fmt.Errorf("INVALID_CONFIG: Incomplete execution driver")
	}
	return nil
}

// Call after the original owner's duplicate-ID check. These are the exact old
// native declaration rules, not a replacement for bounded host validation.
func ValidateLegacyDriverDeclaration(descriptor executiondriver.Descriptor, ingress bool) error {
	for _, values := range [][]string{descriptor.Roles, descriptor.Phases, descriptor.Protocols, descriptor.Capabilities} {
		seen := make(map[string]bool)
		if len(values) == 0 {
			return fmt.Errorf("INVALID_CONFIG: Empty execution driver declaration")
		}
		for _, value := range values {
			if value == "" || seen[value] {
				return fmt.Errorf("INVALID_CONFIG: Invalid execution driver declaration")
			}
			seen[value] = true
		}
	}
	if !slices.Contains(descriptor.Capabilities, descriptor.ID) || descriptor.RequiresMultihop && !descriptor.RequiresRelay {
		return fmt.Errorf("INVALID_CONFIG: Inconsistent execution driver requirements")
	}
	if !ingress != (len(descriptor.ProbeCapabilities) == 0) {
		return fmt.Errorf("INVALID_CONFIG: Probe port and capabilities must agree")
	}
	probeCapabilities := make(map[string]bool)
	for _, capability := range descriptor.ProbeCapabilities {
		if capability == "" || probeCapabilities[capability] || slices.Contains(descriptor.Capabilities, capability) {
			return fmt.Errorf("INVALID_CONFIG: Invalid Probe capability declaration")
		}
		probeCapabilities[capability] = true
	}
	return nil
}
