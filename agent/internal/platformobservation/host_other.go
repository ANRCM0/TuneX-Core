//go:build !linux

package platformobservation

func CaptureHost() HostResources {
	return EmptyHostResources("unsupported")
}
