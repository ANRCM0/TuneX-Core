// Package probeservices validates closed Probe v3 service-bound receipts, never executable grants.
package probeservices

import "github.com/tunex/vnext/agent/internal/probetypes"

type Binding = probetypes.Binding

type Machine struct {
	ProtocolVersion    uint64 `json:"protocolVersion"`
	ProbeVersion       uint64 `json:"probeVersion"`
	NodeId             string `json:"nodeId"`
	BootId             string `json:"bootId"`
	SessionEpoch       uint64 `json:"sessionEpoch"`
	InstanceId         string `json:"instanceId"`
	InstanceGeneration uint64 `json:"instanceGeneration"`
	RequestId          string `json:"requestId"`
}
type Descriptor struct {
	Measurement string `json:"measurement"`
	TaskKind    string `json:"taskKind"`
	Point       string `json:"point"`
	Capability  string `json:"capability"`
}
type Selection struct {
	ScopeId        string `json:"scopeId"`
	ServiceId      string `json:"serviceId"`
	Revision       uint64 `json:"revision"`
	ConfigRevision uint64 `json:"configRevision"`
	ConfigDigest   string `json:"configDigest"`
	ContextDigest  string `json:"contextDigest"`
}
type ServiceEndpoint struct {
	Address string `json:"address"`
	Port    uint64 `json:"port"`
}
type ServiceTrust struct {
	Mode           string `json:"mode"`
	ServerName     string `json:"serverName"`
	CertificateDer string `json:"certificateDer"`
}
type ServiceConfig struct {
	Version    uint64          `json:"version"`
	Purpose    string          `json:"purpose"`
	Endpoint   ServiceEndpoint `json:"endpoint"`
	Trust      ServiceTrust    `json:"trust"`
	ValidFrom  uint64          `json:"validFrom"`
	ValidUntil uint64          `json:"validUntil"`
}
type ServiceContext struct {
	Selection
	Config ServiceConfig `json:"config"`
}
type TLSResult struct {
	Version         string `json:"version"`
	ALPN            string `json:"alpn"`
	LeafFingerprint string `json:"leafFingerprint"`
	Verified        bool   `json:"verified"`
}
type Offer struct {
	Descriptor
	PermitId       string          `json:"permitId"`
	Binding        Binding         `json:"binding"`
	TimeoutMs      uint64          `json:"timeoutMs"`
	IssuedAt       string          `json:"issuedAt"`
	ExpiresAt      string          `json:"expiresAt"`
	ServiceContext *ServiceContext `json:"serviceContext"`
}
type QualificationRequest struct {
	Machine
	Kind         string   `json:"kind"`
	Action       string   `json:"action"`
	Measurements []string `json:"measurements"`
}
type QualificationResponse struct {
	Machine
	Kind             string   `json:"kind"`
	Action           string   `json:"action"`
	Measurements     []string `json:"measurements"`
	Qualified        bool     `json:"qualified"`
	QualifiedAt      *string  `json:"qualifiedAt"`
	ExpiresAt        *string  `json:"expiresAt"`
	ServerTime       string   `json:"serverTime"`
	ExecutionEnabled bool     `json:"executionEnabled"`
}
type PollRequest struct {
	Machine
	Kind         string   `json:"kind"`
	Measurements []string `json:"measurements"`
}
type PollResponse struct {
	Machine
	Kind             string   `json:"kind"`
	Measurements     []string `json:"measurements"`
	ObservedAt       string   `json:"observedAt"`
	ServerTime       string   `json:"serverTime"`
	ExecutionEnabled bool     `json:"executionEnabled"`
	Offer            *Offer   `json:"offer"`
}
type ClaimRequest struct {
	Machine
	Descriptor
	Kind     string     `json:"kind"`
	PermitId string     `json:"permitId"`
	Service  *Selection `json:"service"`
}
type ClaimResponse struct {
	Machine
	Descriptor
	Kind             string     `json:"kind"`
	PermitId         string     `json:"permitId"`
	Service          *Selection `json:"service"`
	Binding          Binding    `json:"binding"`
	TimeoutMs        uint64     `json:"timeoutMs"`
	IssuedAt         string     `json:"issuedAt"`
	ExpiresAt        string     `json:"expiresAt"`
	ConsumedAt       string     `json:"consumedAt"`
	ServerTime       string     `json:"serverTime"`
	State            string     `json:"state"`
	ExecutionEnabled bool       `json:"executionEnabled"`
}
type StatusRequest struct {
	Machine
	Descriptor
	Kind     string     `json:"kind"`
	PermitId string     `json:"permitId"`
	Service  *Selection `json:"service"`
}
type StatusResponse struct {
	ClaimResponse
	CheckedAt string `json:"checkedAt"`
}
type ResultRequest struct {
	Machine
	Descriptor
	Kind                    string     `json:"kind"`
	PermitId                string     `json:"permitId"`
	Service                 *Selection `json:"service"`
	Binding                 Binding    `json:"binding"`
	TimeoutMs               uint64     `json:"timeoutMs"`
	IssuedAt                string     `json:"issuedAt"`
	ExpiresAt               string     `json:"expiresAt"`
	ConsumedAt              string     `json:"consumedAt"`
	MeasuredAt              string     `json:"measuredAt"`
	ValidUntil              string     `json:"validUntil"`
	ElapsedMs               uint64     `json:"elapsedMs"`
	Status                  string     `json:"status"`
	Code                    string     `json:"code"`
	TLS                     *TLSResult `json:"tls"`
	ApplicationHealth       string     `json:"applicationHealth"`
	Source                  string     `json:"source"`
	ApplicationPayloadBytes uint64     `json:"applicationPayloadBytes"`
}
type ResultResponse struct {
	Machine
	Descriptor
	Kind             string     `json:"kind"`
	PermitId         string     `json:"permitId"`
	Service          *Selection `json:"service"`
	ResultDigest     string     `json:"resultDigest"`
	AcceptedAt       string     `json:"acceptedAt"`
	ServerTime       string     `json:"serverTime"`
	Duplicate        bool       `json:"duplicate"`
	Health           string     `json:"health"`
	ExecutionEnabled bool       `json:"executionEnabled"`
}
