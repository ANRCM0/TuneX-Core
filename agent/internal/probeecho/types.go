// Package probeecho owns closed v4 public messages and pure controlled-echo proofs, never authority or networking.
package probeecho

import "github.com/tunex/vnext/agent/internal/probeservices"

type Binding = probeservices.Binding
type Selection = probeservices.Selection
type Machine = probeservices.Machine
type TLSResult = probeservices.TLSResult
type Descriptor struct {
	Measurement      string `json:"measurement"`
	TaskKind         string `json:"taskKind"`
	Point            string `json:"point"`
	Capability       string `json:"capability"`
	BusinessProtocol string `json:"businessProtocol"`
}
type ServiceEndpoint struct {
	Address   string   `json:"address"`
	Port      uint64   `json:"port"`
	Protocols []string `json:"protocols,omitempty"`
}
type ServiceTrust struct {
	Mode           string `json:"mode"`
	ServerName     string `json:"serverName,omitempty"`
	CertificateDer string `json:"certificateDer,omitempty"`
	PublicKey      string `json:"publicKey,omitempty"`
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
type Challenge struct {
	Nonce            string `json:"nonce"`
	InvocationDigest string `json:"invocationDigest"`
}
type Proof struct {
	Algorithm     string `json:"algorithm"`
	RequestDigest string `json:"requestDigest"`
	Signature     string `json:"signature"`
	Verified      bool   `json:"verified"`
}
type Invocation struct {
	Domain             string    `json:"domain"`
	ProbeVersion       uint64    `json:"probeVersion"`
	Measurement        string    `json:"measurement"`
	PermitId           string    `json:"permitId"`
	Binding            Binding   `json:"binding"`
	InstanceId         string    `json:"instanceId"`
	InstanceGeneration uint64    `json:"instanceGeneration"`
	TimeoutMs          uint64    `json:"timeoutMs"`
	IssuedAt           string    `json:"issuedAt"`
	ExpiresAt          string    `json:"expiresAt"`
	Service            Selection `json:"service"`
	Nonce              string    `json:"nonce"`
}
type Execution struct {
	Context    ServiceContext
	Challenge  Challenge
	Invocation Invocation
}

func CloneContext(value ServiceContext) ServiceContext {
	value.Config.Endpoint.Protocols = append([]string(nil), value.Config.Endpoint.Protocols...)
	return value
}
func CloneExecution(value Execution) Execution {
	value.Context = CloneContext(value.Context)
	return value
}

type Offer struct {
	Descriptor
	PermitId       string          `json:"permitId"`
	Binding        Binding         `json:"binding"`
	TimeoutMs      uint64          `json:"timeoutMs"`
	IssuedAt       string          `json:"issuedAt"`
	ExpiresAt      string          `json:"expiresAt"`
	ServiceContext *ServiceContext `json:"serviceContext"`
	Challenge      *Challenge      `json:"challenge"`
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
	Kind      string     `json:"kind"`
	PermitId  string     `json:"permitId"`
	Service   *Selection `json:"service"`
	Challenge *Challenge `json:"challenge"`
}
type ClaimResponse struct {
	Machine
	Descriptor
	Kind             string     `json:"kind"`
	PermitId         string     `json:"permitId"`
	Service          *Selection `json:"service"`
	Challenge        *Challenge `json:"challenge"`
	Binding          Binding    `json:"binding"`
	TimeoutMs        uint64     `json:"timeoutMs"`
	IssuedAt         string     `json:"issuedAt"`
	ExpiresAt        string     `json:"expiresAt"`
	ConsumedAt       string     `json:"consumedAt"`
	ServerTime       string     `json:"serverTime"`
	State            string     `json:"state"`
	ExecutionEnabled bool       `json:"executionEnabled"`
}
type StatusRequest = ClaimRequest
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
	Challenge               *Challenge `json:"challenge"`
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
	Echo                    *Proof     `json:"echo"`
	RequestBytes            uint64     `json:"requestBytes"`
	ResponseBytes           uint64     `json:"responseBytes"`
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
	Challenge        *Challenge `json:"challenge"`
	ResultDigest     string     `json:"resultDigest"`
	AcceptedAt       string     `json:"acceptedAt"`
	ServerTime       string     `json:"serverTime"`
	Duplicate        bool       `json:"duplicate"`
	Health           string     `json:"health"`
	ExecutionEnabled bool       `json:"executionEnabled"`
}
