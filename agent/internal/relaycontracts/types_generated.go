// Code generated from docs/protocol/schemas/native-relay-v1.schema.json. DO NOT EDIT.
package relaycontracts

type Id = string

type Counter = uint64

type Digest = string

type Binding struct {
	ScopeId              Id      `json:"scopeId"`
	ForwardId            Id      `json:"forwardId"`
	IngressNodeId        Id      `json:"ingressNodeId"`
	EgressNodeId         Id      `json:"egressNodeId"`
	IngressAssignmentId  Id      `json:"ingressAssignmentId"`
	EgressAssignmentId   Id      `json:"egressAssignmentId"`
	ProfileId            Id      `json:"profileId"`
	ForwardRevision      Counter `json:"forwardRevision"`
	DeploymentGeneration Counter `json:"deploymentGeneration"`
	IngressSessionEpoch  Counter `json:"ingressSessionEpoch"`
	EgressSessionEpoch   Counter `json:"egressSessionEpoch"`
	IngressFence         Counter `json:"ingressFence"`
	EgressFence          Counter `json:"egressFence"`
	ProfileRevision      Counter `json:"profileRevision"`
	ProfileDigest        Digest  `json:"profileDigest"`
}

type ProfileConfig struct {
	Driver                  string   `json:"driver"`
	WireVersion             uint64   `json:"wireVersion"`
	Security                string   `json:"security"`
	Protocols               []string `json:"protocols"`
	HandshakeTimeoutSeconds uint64   `json:"handshakeTimeoutSeconds"`
	IdleTimeoutSeconds      uint64   `json:"idleTimeoutSeconds"`
	MaxFrameBytes           uint64   `json:"maxFrameBytes"`
	MaxUdpDatagramBytes     uint64   `json:"maxUdpDatagramBytes"`
	MaxConnectionsPerNode   uint64   `json:"maxConnectionsPerNode"`
}

type Open struct {
	WireVersion uint64  `json:"wireVersion"`
	Type        string  `json:"type"`
	Action      string  `json:"action"`
	RequestId   Id      `json:"requestId"`
	Binding     Binding `json:"binding"`
}

type Accept struct {
	WireVersion   uint64 `json:"wireVersion"`
	Type          string `json:"type"`
	RequestId     Id     `json:"requestId"`
	BindingDigest Digest `json:"bindingDigest"`
}

type Reject struct {
	WireVersion uint64 `json:"wireVersion"`
	Type        string `json:"type"`
	RequestId   Id     `json:"requestId"`
	Code        string `json:"code"`
	Retryable   bool   `json:"retryable"`
}
