package nativeexecution

import (
	"slices"

	"github.com/tunex/vnext/agent/internal/executiondriver"
)

// BuiltinDrivers is the original compiled native order, not dynamic registration.
func BuiltinDrivers() []executiondriver.Driver {
	return []executiondriver.Driver{Direct(), Relay(), Multihop()}
}

// Capabilities projects native wire declarations. It never grants execution or
// enables a feature; callers still supply their original explicit opt-ins.
func Capabilities(drivers []executiondriver.Driver, features executiondriver.Features, probeIngress, probeServices, probeEcho bool) []string {
	capabilities := []string{"adp.3"}
	for _, driver := range drivers {
		if !executiondriver.EnabledOnCurrentPlatform(driver.Descriptor, features) {
			continue
		}
		for _, capability := range driver.Descriptor.Capabilities {
			if !slices.Contains(capabilities, capability) {
				capabilities = append(capabilities, capability)
			}
		}
		if probeIngress && driver.ProbeIngress != nil {
			for _, capability := range driver.Descriptor.ProbeCapabilities {
				if !slices.Contains(capabilities, capability) {
					capabilities = append(capabilities, capability)
				}
			}
			if probeServices && !slices.Contains(capabilities, "probe.tcp-ingress-tls.v1") {
				capabilities = append(capabilities, "probe.tcp-ingress-tls.v1")
			}
			if probeEcho && probeServices && driver.ProbeUDPIngress != nil {
				for _, capability := range []string{"probe.tcp-ingress-echo.v1", "probe.udp-ingress-echo.v1"} {
					if !slices.Contains(capabilities, capability) {
						capabilities = append(capabilities, capability)
					}
				}
			}
		}
	}
	return capabilities
}
