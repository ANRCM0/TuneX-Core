// Code generated from packages/contracts/schemas/adp-v3-relay.schema.json. DO NOT EDIT.
package adp3relay

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

type Target struct {
	Host string `json:"host"`
	Port uint64 `json:"port"`
}

type Listen struct {
	Address string `json:"address"`
	Port    uint64 `json:"port"`
}

type DirectConfig struct {
	Target                  Target   `json:"target"`
	EgressPolicyRevision    Counter  `json:"egressPolicyRevision"`
	AllowMetadataTargets    bool     `json:"allowMetadataTargets"`
	AllowedDestinationCidrs []string `json:"allowedDestinationCidrs"`
}

type Resource struct {
	Address  string `json:"address"`
	Port     uint64 `json:"port"`
	Protocol string `json:"protocol"`
}

type RelayConfig struct {
	Role                    string        `json:"role"`
	Binding                 Binding       `json:"binding"`
	Profile                 ProfileConfig `json:"profile"`
	PeerFingerprints        []Digest      `json:"peerFingerprints"`
	PeerEndpoint            *Target       `json:"peerEndpoint,omitempty"`
	Target                  *Target       `json:"target,omitempty"`
	EgressPolicyRevision    Counter       `json:"egressPolicyRevision"`
	AllowMetadataTargets    bool          `json:"allowMetadataTargets"`
	AllowedDestinationCidrs []string      `json:"allowedDestinationCidrs"`
}

type RelayDriver struct {
	Id            string      `json:"id"`
	SchemaVersion uint64      `json:"schemaVersion"`
	ConfigDigest  Digest      `json:"configDigest"`
	Config        RelayConfig `json:"config"`
}

type Assignment struct {
	ProtocolVersion      uint64      `json:"protocolVersion"`
	NodeId               Id          `json:"nodeId"`
	SessionEpoch         Counter     `json:"sessionEpoch"`
	AssignmentId         Id          `json:"assignmentId"`
	ForwardId            Id          `json:"forwardId"`
	ForwardRevision      Counter     `json:"forwardRevision"`
	DeploymentGeneration Counter     `json:"deploymentGeneration"`
	BindingFence         Counter     `json:"bindingFence"`
	Role                 string      `json:"role"`
	Protocol             string      `json:"protocol"`
	Phase                string      `json:"phase"`
	Resource             Resource    `json:"resource"`
	Driver               RelayDriver `json:"driver"`
	DrainTimeoutSeconds  uint64      `json:"drainTimeoutSeconds"`
}

type Tombstone struct {
	ProtocolVersion      uint64  `json:"protocolVersion"`
	NodeId               Id      `json:"nodeId"`
	AssignmentId         Id      `json:"assignmentId"`
	ForwardId            Id      `json:"forwardId"`
	Protocol             string  `json:"protocol"`
	PhysicalProtocol     string  `json:"physicalProtocol"`
	Port                 uint64  `json:"port"`
	BindingFence         Counter `json:"bindingFence"`
	RetirementGeneration Counter `json:"retirementGeneration"`
	Role                 string  `json:"role"`
}
