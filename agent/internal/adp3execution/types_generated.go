// Code generated from docs/protocol/schemas/adp-v3-execution.schema.json. DO NOT EDIT.
package adp3execution

type Id = string

type Counter = uint64

type CounterOrZero = uint64

type Time = string

type Digest = string

type Protocol = string

type Phase = string

type Condition = string

type Listen struct {
	Address string `json:"address"`
	Port    uint64 `json:"port"`
}

type Target struct {
	Host string `json:"host"`
	Port uint64 `json:"port"`
}

type DirectConfig struct {
	Target                  Target   `json:"target"`
	EgressPolicyRevision    Counter  `json:"egressPolicyRevision"`
	AllowMetadataTargets    bool     `json:"allowMetadataTargets"`
	AllowedDestinationCidrs []string `json:"allowedDestinationCidrs"`
}

type Driver struct {
	Id            string        `json:"id"`
	SchemaVersion uint64        `json:"schemaVersion"`
	ConfigDigest  Digest        `json:"configDigest"`
	Config        RuntimeConfig `json:"config"`
}

type Assignment struct {
	AssignmentId         Id       `json:"assignmentId"`
	ForwardId            Id       `json:"forwardId"`
	ForwardRevision      Counter  `json:"forwardRevision"`
	DeploymentGeneration Counter  `json:"deploymentGeneration"`
	BindingFence         Counter  `json:"bindingFence"`
	Role                 string   `json:"role"`
	Protocol             Protocol `json:"protocol"`
	Phase                Phase    `json:"phase"`
	Driver               Driver   `json:"driver"`
	DrainTimeoutSeconds  uint64   `json:"drainTimeoutSeconds"`
	Resource             Resource `json:"resource"`
}

type Tombstone struct {
	AssignmentId         Id       `json:"assignmentId"`
	ForwardId            Id       `json:"forwardId"`
	Protocol             Protocol `json:"protocol"`
	Port                 uint64   `json:"port"`
	BindingFence         Counter  `json:"bindingFence"`
	RetirementGeneration Counter  `json:"retirementGeneration"`
	PhysicalProtocol     Protocol `json:"physicalProtocol"`
	Role                 string   `json:"role"`
}

type Observation struct {
	AssignmentId         Id        `json:"assignmentId"`
	DeploymentGeneration Counter   `json:"deploymentGeneration"`
	BindingFence         Counter   `json:"bindingFence"`
	Phase                string    `json:"phase"`
	Condition            Condition `json:"condition"`
	ErrorCode            *string   `json:"errorCode"`
	Retryable            bool      `json:"retryable"`
}

type Drain struct {
	AssignmentId         Id      `json:"assignmentId"`
	DeploymentGeneration Counter `json:"deploymentGeneration"`
	BindingFence         Counter `json:"bindingFence"`
	StartedAt            Time    `json:"startedAt"`
	Deadline             Time    `json:"deadline"`
	RemainingConnections uint64  `json:"remainingConnections"`
	Condition            string  `json:"condition"`
}

type Policy struct {
	PollIntervalSeconds            uint64 `json:"pollIntervalSeconds"`
	LeaseSeconds                   uint64 `json:"leaseSeconds"`
	RenewalLeadSeconds             uint64 `json:"renewalLeadSeconds"`
	MaxClockSkewSeconds            uint64 `json:"maxClockSkewSeconds"`
	ObservationFreshnessSeconds    uint64 `json:"observationFreshnessSeconds"`
	DrainTimeoutSeconds            uint64 `json:"drainTimeoutSeconds"`
	ConnectTimeoutSeconds          uint64 `json:"connectTimeoutSeconds"`
	UdpIdleTimeoutSeconds          uint64 `json:"udpIdleTimeoutSeconds"`
	MaxTcpConnectionsPerAssignment uint64 `json:"maxTcpConnectionsPerAssignment"`
	MaxUdpSessionsPerAssignment    uint64 `json:"maxUdpSessionsPerAssignment"`
	MaxSnapshotBytes               uint64 `json:"maxSnapshotBytes"`
	MaxReportBytes                 uint64 `json:"maxReportBytes"`
	MaxAssignmentsPerNode          uint64 `json:"maxAssignmentsPerNode"`
}

type HelloRequest struct {
	ProtocolVersion              uint64        `json:"protocolVersion"`
	NodeId                       Id            `json:"nodeId"`
	BootId                       Id            `json:"bootId"`
	AgentBuild                   string        `json:"agentBuild"`
	Capabilities                 []Id          `json:"capabilities"`
	LastStoredSnapshotGeneration CounterOrZero `json:"lastStoredSnapshotGeneration"`
}

type HelloResponse struct {
	ProtocolVersion uint64  `json:"protocolVersion"`
	NodeId          Id      `json:"nodeId"`
	BootId          Id      `json:"bootId"`
	SessionEpoch    Counter `json:"sessionEpoch"`
	ServerTime      Time    `json:"serverTime"`
	Policy          Policy  `json:"policy"`
}

type ResourceLimitBucket struct {
	BucketId       Id             `json:"bucketId"`
	ScopeId        Id             `json:"scopeId"`
	ActorId        Id             `json:"actorId"`
	NodeId         Id             `json:"nodeId"`
	Revision       Counter        `json:"revision"`
	StartsAt       string         `json:"startsAt"`
	EndsAt         string         `json:"endsAt"`
	BytesPerSecond *CounterOrZero `json:"bytesPerSecond"`
	BurstBytes     uint64         `json:"burstBytes"`
	ByteLimit      *CounterOrZero `json:"byteLimit"`
	AssignmentIds  []Id           `json:"assignmentIds"`
}

type ResourceLimits struct {
	Version uint64                `json:"version"`
	Buckets []ResourceLimitBucket `json:"buckets"`
}

type Snapshot struct {
	ResourceLimits     *ResourceLimits `json:"resourceLimits,omitempty"`
	ProtocolVersion    uint64          `json:"protocolVersion"`
	NodeId             Id              `json:"nodeId"`
	SessionEpoch       Counter         `json:"sessionEpoch"`
	SnapshotGeneration Counter         `json:"snapshotGeneration"`
	Complete           bool            `json:"complete"`
	IssuedAt           Time            `json:"issuedAt"`
	ValidUntil         Time            `json:"validUntil"`
	SnapshotDigest     Digest          `json:"snapshotDigest"`
	Assignments        []Assignment    `json:"assignments"`
	Tombstones         []Tombstone     `json:"tombstones"`
	ExecutionExtension *uint64         `json:"executionExtension,omitempty"`
}

type ReportRequest struct {
	ProtocolVersion            uint64        `json:"protocolVersion"`
	NodeId                     Id            `json:"nodeId"`
	BootId                     Id            `json:"bootId"`
	SessionEpoch               Counter       `json:"sessionEpoch"`
	ReportSequence             Counter       `json:"reportSequence"`
	ObservedAt                 Time          `json:"observedAt"`
	AcceptedSnapshotGeneration CounterOrZero `json:"acceptedSnapshotGeneration"`
	Observations               []Observation `json:"observations"`
	Drains                     []Drain       `json:"drains"`
}

type ReportAck struct {
	ProtocolVersion uint64  `json:"protocolVersion"`
	NodeId          Id      `json:"nodeId"`
	BootId          Id      `json:"bootId"`
	SessionEpoch    Counter `json:"sessionEpoch"`
	ReportSequence  Counter `json:"reportSequence"`
	Status          string  `json:"status"`
}

type ErrorResponse struct {
	Code              string  `json:"code"`
	Message           string  `json:"message"`
	Retryable         bool    `json:"retryable"`
	RetryAfterSeconds *uint64 `json:"retryAfterSeconds,omitempty"`
	RequestId         Id      `json:"requestId"`
}

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

type RuntimeConfig struct {
	Role                    *string        `json:"role,omitempty"`
	Binding                 *Binding       `json:"binding,omitempty"`
	Profile                 *ProfileConfig `json:"profile,omitempty"`
	PeerFingerprints        *[]Digest      `json:"peerFingerprints,omitempty"`
	PeerEndpoint            *Target        `json:"peerEndpoint,omitempty"`
	Target                  *Target        `json:"target,omitempty"`
	EgressPolicyRevision    *Counter       `json:"egressPolicyRevision,omitempty"`
	AllowMetadataTargets    *bool          `json:"allowMetadataTargets,omitempty"`
	AllowedDestinationCidrs *[]string      `json:"allowedDestinationCidrs,omitempty"`
	Hop                     *HopConfig     `json:"hop,omitempty"`
}

type Resource struct {
	Address  string `json:"address"`
	Port     uint64 `json:"port"`
	Protocol string `json:"protocol"`
}

type HopNode struct {
	NodeId          Id      `json:"nodeId"`
	AssignmentId    Id      `json:"assignmentId"`
	SessionEpoch    Counter `json:"sessionEpoch"`
	BindingFence    Counter `json:"bindingFence"`
	PeerFingerprint Digest  `json:"peerFingerprint"`
	ListenAddress   string  `json:"listenAddress"`
	Host            string  `json:"host"`
	Port            uint64  `json:"port"`
}

type HopConfig struct {
	ScopeId                 Id            `json:"scopeId"`
	ForwardId               Id            `json:"forwardId"`
	ForwardRevision         Counter       `json:"forwardRevision"`
	DeploymentGeneration    Counter       `json:"deploymentGeneration"`
	ProfileId               Id            `json:"profileId"`
	ProfileRevision         Counter       `json:"profileRevision"`
	ProfileDigest           Digest        `json:"profileDigest"`
	PathDigest              Digest        `json:"pathDigest"`
	Protocol                Protocol      `json:"protocol"`
	HopIndex                uint64        `json:"hopIndex"`
	Path                    []HopNode     `json:"path"`
	Profile                 ProfileConfig `json:"profile"`
	Target                  Target        `json:"target"`
	EgressPolicyRevision    Counter       `json:"egressPolicyRevision"`
	AllowedDestinationCidrs []string      `json:"allowedDestinationCidrs"`
	AllowMetadataTargets    bool          `json:"allowMetadataTargets"`
}

type MultihopConfig struct {
	Hop HopConfig `json:"hop"`
}
