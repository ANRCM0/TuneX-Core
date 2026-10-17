// Code generated from docs/protocol/schemas/probe-claim-v1.schema.json. DO NOT EDIT.
package probeclaim

type Id = string

type InstanceId = string

type Counter = uint64

type Time = string

type Binding struct {
	NodeId               Id      `json:"nodeId"`
	BootId               Id      `json:"bootId"`
	SessionEpoch         Counter `json:"sessionEpoch"`
	SnapshotGeneration   Counter `json:"snapshotGeneration"`
	AssignmentId         Id      `json:"assignmentId"`
	ForwardId            Id      `json:"forwardId"`
	ForwardRevision      Counter `json:"forwardRevision"`
	DeploymentGeneration Counter `json:"deploymentGeneration"`
	BindingFence         Counter `json:"bindingFence"`
	ConfigDigest         string  `json:"configDigest"`
	EgressPolicyRevision Counter `json:"egressPolicyRevision"`
}

type Request struct {
	ProtocolVersion    uint64     `json:"protocolVersion"`
	ProbeVersion       uint64     `json:"probeVersion"`
	Kind               string     `json:"kind"`
	NodeId             Id         `json:"nodeId"`
	BootId             Id         `json:"bootId"`
	SessionEpoch       Counter    `json:"sessionEpoch"`
	InstanceId         InstanceId `json:"instanceId"`
	InstanceGeneration Counter    `json:"instanceGeneration"`
	PermitId           Id         `json:"permitId"`
}

type Response struct {
	ProtocolVersion    uint64     `json:"protocolVersion"`
	ProbeVersion       uint64     `json:"probeVersion"`
	Kind               string     `json:"kind"`
	NodeId             Id         `json:"nodeId"`
	BootId             Id         `json:"bootId"`
	SessionEpoch       Counter    `json:"sessionEpoch"`
	InstanceId         InstanceId `json:"instanceId"`
	InstanceGeneration Counter    `json:"instanceGeneration"`
	PermitId           Id         `json:"permitId"`
	Binding            Binding    `json:"binding"`
	TimeoutMs          uint64     `json:"timeoutMs"`
	IssuedAt           Time       `json:"issuedAt"`
	ExpiresAt          Time       `json:"expiresAt"`
	ConsumedAt         Time       `json:"consumedAt"`
	ServerTime         Time       `json:"serverTime"`
	State              string     `json:"state"`
	ExecutionEnabled   bool       `json:"executionEnabled"`
}
