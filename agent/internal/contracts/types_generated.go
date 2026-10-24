// Code generated from packages/contracts/schemas/adp-v2-direct.schema.json. DO NOT EDIT.
package contracts

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
	Id            string       `json:"id"`
	SchemaVersion uint64       `json:"schemaVersion"`
	ConfigDigest  Digest       `json:"configDigest"`
	Config        DirectConfig `json:"config"`
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
	Listener             Listen   `json:"listener"`
	Driver               Driver   `json:"driver"`
	DrainTimeoutSeconds  uint64   `json:"drainTimeoutSeconds"`
}

type Tombstone struct {
	AssignmentId         Id       `json:"assignmentId"`
	ForwardId            Id       `json:"forwardId"`
	Protocol             Protocol `json:"protocol"`
	Port                 uint64   `json:"port"`
	BindingFence         Counter  `json:"bindingFence"`
	RetirementGeneration Counter  `json:"retirementGeneration"`
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

type Snapshot struct {
	ProtocolVersion    uint64       `json:"protocolVersion"`
	NodeId             Id           `json:"nodeId"`
	SessionEpoch       Counter      `json:"sessionEpoch"`
	SnapshotGeneration Counter      `json:"snapshotGeneration"`
	Complete           bool         `json:"complete"`
	IssuedAt           Time         `json:"issuedAt"`
	ValidUntil         Time         `json:"validUntil"`
	SnapshotDigest     Digest       `json:"snapshotDigest"`
	Assignments        []Assignment `json:"assignments"`
	Tombstones         []Tombstone  `json:"tombstones"`
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
