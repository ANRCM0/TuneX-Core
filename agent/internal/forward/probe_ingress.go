package forward

import (
	"fmt"
	"net"
	"net/netip"
)

// IngressObservation is detached current socket metadata, not authority or a dial operation.
type IngressObservation struct {
	Address string
	Port    uint64
	Check   func() error
}

func (stream *TCP) ingressLocked() (IngressObservation, error) {
	if stream.slot.current != stream || stream.ctx.Err() != nil || stream.authorization.Allow() != nil {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: current TCP listener required")
	}
	address, ok := stream.slot.listener.Addr().(*net.TCPAddr)
	bound, err := netip.ParseAddr(stream.binding.Address)
	if !ok || address == nil || err != nil || address.Zone != "" || bound.Zone() != "" ||
		address.Port < 1 || address.Port > 65535 || uint64(address.Port) != stream.binding.Port {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: explicit numeric TCP binding required")
	}
	actual, ok := netip.AddrFromSlice(address.IP)
	if !ok {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: numeric TCP listener required")
	}
	actual, bound = actual.Unmap(), bound.Unmap()
	if actual != bound || actual.IsUnspecified() || actual.IsMulticast() || actual.IsLinkLocalUnicast() ||
		actual.IsLinkLocalMulticast() || actual.Is4() && actual.As4()[0] >= 224 {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: concrete TCP listener required")
	}
	return IngressObservation{Address: actual.String(), Port: uint64(address.Port)}, nil
}

// The slot lock pins only metadata inspection. No network operation runs under this lock.
func (stream *TCP) ObserveIngress() (IngressObservation, error) {
	stream.slot.mutex.Lock()
	value, err := stream.ingressLocked()
	stream.slot.mutex.Unlock()
	if err != nil {
		return IngressObservation{}, err
	}
	value.Check = func() error {
		stream.slot.mutex.Lock()
		defer stream.slot.mutex.Unlock()
		current, err := stream.ingressLocked()
		if err != nil {
			return err
		}
		if current.Address != value.Address || current.Port != value.Port {
			return fmt.Errorf("AUTHORIZATION_DENIED: TCP listener changed")
		}
		return nil
	}
	return value, nil
}

func (stream *UDP) ingressLocked() (IngressObservation, error) {
	if stream.slot.current != stream || stream.ctx.Err() != nil || stream.authorization.Allow() != nil {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: current UDP listener required")
	}
	address, ok := stream.slot.listener.LocalAddr().(*net.UDPAddr)
	bound, err := netip.ParseAddr(stream.binding.Address)
	if !ok || address == nil || err != nil || address.Zone != "" || bound.Zone() != "" ||
		address.Port < 1 || address.Port > 65535 || uint64(address.Port) != stream.binding.Port {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: explicit numeric UDP binding required")
	}
	actual, ok := netip.AddrFromSlice(address.IP)
	if !ok {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: numeric UDP listener required")
	}
	actual, bound = actual.Unmap(), bound.Unmap()
	if actual != bound || actual.IsUnspecified() || actual.IsMulticast() || actual.IsLinkLocalUnicast() ||
		actual.IsLinkLocalMulticast() || actual.Is4() && actual.As4()[0] >= 224 {
		return IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: concrete UDP listener required")
	}
	return IngressObservation{Address: actual.String(), Port: uint64(address.Port)}, nil
}

// This observes the original owner only. Probe socket closure does not shorten business association idle cleanup.
func (stream *UDP) ObserveIngress() (IngressObservation, error) {
	stream.slot.mutex.Lock()
	value, err := stream.ingressLocked()
	stream.slot.mutex.Unlock()
	if err != nil {
		return IngressObservation{}, err
	}
	value.Check = func() error {
		stream.slot.mutex.Lock()
		defer stream.slot.mutex.Unlock()
		current, err := stream.ingressLocked()
		if err != nil {
			return err
		}
		if current.Address != value.Address || current.Port != value.Port {
			return fmt.Errorf("AUTHORIZATION_DENIED: UDP listener changed")
		}
		return nil
	}
	return value, nil
}
