package relay

import (
    "fmt"
    "net"
    "github.com/tunex/vnext/agent/internal/forward"
)

// ObserveIngress pins only the current original socket, never a replacement listener.
func (e *Engine) ObserveIngress(protocol string) (forward.IngressObservation, error) {
    e.mutex.Lock()
    defer e.mutex.Unlock()
    if e.assignment.Role != "relay-ingress" || e.assignment.Protocol != protocol || !e.active || e.draining || e.check() != nil {
        return forward.IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED: Active ingress required")
    }
    listener, udp := e.listener, e.udp
    var address string
    var port int
    if protocol == "tcp" && listener != nil {
        a, ok := listener.Addr().(*net.TCPAddr)
        if !ok || a == nil || a.Zone != "" { return forward.IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED") }
        address, port = a.IP.String(), a.Port
    } else if protocol == "udp" && udp != nil {
        a, ok := udp.LocalAddr().(*net.UDPAddr)
        if !ok || a == nil || a.Zone != "" { return forward.IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED") }
        address, port = a.IP.String(), a.Port
    } else { return forward.IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED") }
    if port < 1 || port > 65535 { return forward.IngressObservation{}, fmt.Errorf("AUTHORIZATION_DENIED") }
    return forward.IngressObservation{Address:address,Port:uint64(port),Check:func() error {
        e.mutex.Lock()
        defer e.mutex.Unlock()
        if !e.active || e.draining || e.listener != listener || e.udp != udp { return fmt.Errorf("AUTHORIZATION_DENIED: Ingress changed") }
        return e.check()
    }}, nil
}
