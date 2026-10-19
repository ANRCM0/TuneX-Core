// Package probetypes validates closed typed Probe v2 receipts, never executable grants.
package probetypes

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
type Binding struct {
	NodeId               string `json:"nodeId"`
	BootId               string `json:"bootId"`
	SessionEpoch         uint64 `json:"sessionEpoch"`
	SnapshotGeneration   uint64 `json:"snapshotGeneration"`
	AssignmentId         string `json:"assignmentId"`
	ForwardId            string `json:"forwardId"`
	ForwardRevision      uint64 `json:"forwardRevision"`
	DeploymentGeneration uint64 `json:"deploymentGeneration"`
	BindingFence         uint64 `json:"bindingFence"`
	ConfigDigest         string `json:"configDigest"`
	EgressPolicyRevision uint64 `json:"egressPolicyRevision"`
}
type Offer struct {
	Descriptor
	PermitId  string  `json:"permitId"`
	Binding   Binding `json:"binding"`
	TimeoutMs uint64  `json:"timeoutMs"`
	IssuedAt  string  `json:"issuedAt"`
	ExpiresAt string  `json:"expiresAt"`
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
	Kind     string `json:"kind"`
	PermitId string `json:"permitId"`
}
type ClaimResponse struct {
	Machine
	Descriptor
	Kind             string  `json:"kind"`
	PermitId         string  `json:"permitId"`
	Binding          Binding `json:"binding"`
	TimeoutMs        uint64  `json:"timeoutMs"`
	IssuedAt         string  `json:"issuedAt"`
	ExpiresAt        string  `json:"expiresAt"`
	ConsumedAt       string  `json:"consumedAt"`
	ServerTime       string  `json:"serverTime"`
	State            string  `json:"state"`
	ExecutionEnabled bool    `json:"executionEnabled"`
}
type StatusRequest struct {
	Machine
	Descriptor
	Kind     string `json:"kind"`
	PermitId string `json:"permitId"`
}
type StatusResponse struct {
	ClaimResponse
	CheckedAt string `json:"checkedAt"`
}
type ResultRequest struct {
	Machine
	Descriptor
	Kind                    string  `json:"kind"`
	PermitId                string  `json:"permitId"`
	Binding                 Binding `json:"binding"`
	TimeoutMs               uint64  `json:"timeoutMs"`
	IssuedAt                string  `json:"issuedAt"`
	ExpiresAt               string  `json:"expiresAt"`
	ConsumedAt              string  `json:"consumedAt"`
	MeasuredAt              string  `json:"measuredAt"`
	ValidUntil              string  `json:"validUntil"`
	ElapsedMs               uint64  `json:"elapsedMs"`
	Status                  string  `json:"status"`
	Code                    string  `json:"code"`
	ApplicationHealth       string  `json:"applicationHealth"`
	Source                  string  `json:"source"`
	ApplicationPayloadBytes uint64  `json:"applicationPayloadBytes"`
}
type ResultResponse struct {
	Machine
	Descriptor
	Kind             string `json:"kind"`
	PermitId         string `json:"permitId"`
	ResultDigest     string `json:"resultDigest"`
	AcceptedAt       string `json:"acceptedAt"`
	ServerTime       string `json:"serverTime"`
	Duplicate        bool   `json:"duplicate"`
	Health           string `json:"health"`
	ExecutionEnabled bool   `json:"executionEnabled"`
}
