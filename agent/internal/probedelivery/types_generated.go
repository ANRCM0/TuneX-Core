// Code generated from docs/protocol/schemas/probe-delivery-v1.schema.json. DO NOT EDIT.
package probedelivery

type Id = string

type Token = string

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

type Offer struct {
	PermitId  Id      `json:"permitId"`
	Binding   Binding `json:"binding"`
	TimeoutMs uint64  `json:"timeoutMs"`
	IssuedAt  Time    `json:"issuedAt"`
	ExpiresAt Time    `json:"expiresAt"`
}

type PollRequest struct {
	ProtocolVersion    uint64  `json:"protocolVersion"`
	ProbeVersion       uint64  `json:"probeVersion"`
	NodeId             Id      `json:"nodeId"`
	BootId             Id      `json:"bootId"`
	SessionEpoch       Counter `json:"sessionEpoch"`
	InstanceId         Token   `json:"instanceId"`
	InstanceGeneration Counter `json:"instanceGeneration"`
	RequestId          Token   `json:"requestId"`
	Kind               string  `json:"kind"`
}

type PollResponse struct {
	ProtocolVersion    uint64  `json:"protocolVersion"`
	ProbeVersion       uint64  `json:"probeVersion"`
	NodeId             Id      `json:"nodeId"`
	BootId             Id      `json:"bootId"`
	SessionEpoch       Counter `json:"sessionEpoch"`
	InstanceId         Token   `json:"instanceId"`
	InstanceGeneration Counter `json:"instanceGeneration"`
	RequestId          Token   `json:"requestId"`
	Kind               string  `json:"kind"`
	ObservedAt         Time    `json:"observedAt"`
	ServerTime         Time    `json:"serverTime"`
	ExecutionEnabled   bool    `json:"executionEnabled"`
	Offer              *Offer  `json:"offer"`
}

type StatusRequest struct {
	ProtocolVersion    uint64  `json:"protocolVersion"`
	ProbeVersion       uint64  `json:"probeVersion"`
	NodeId             Id      `json:"nodeId"`
	BootId             Id      `json:"bootId"`
	SessionEpoch       Counter `json:"sessionEpoch"`
	InstanceId         Token   `json:"instanceId"`
	InstanceGeneration Counter `json:"instanceGeneration"`
	RequestId          Token   `json:"requestId"`
	Kind               string  `json:"kind"`
	PermitId           Id      `json:"permitId"`
}

type StatusResponse struct {
	ProtocolVersion    uint64  `json:"protocolVersion"`
	ProbeVersion       uint64  `json:"probeVersion"`
	NodeId             Id      `json:"nodeId"`
	BootId             Id      `json:"bootId"`
	SessionEpoch       Counter `json:"sessionEpoch"`
	InstanceId         Token   `json:"instanceId"`
	InstanceGeneration Counter `json:"instanceGeneration"`
	RequestId          Token   `json:"requestId"`
	Kind               string  `json:"kind"`
	PermitId           Id      `json:"permitId"`
	Binding            Binding `json:"binding"`
	TimeoutMs          uint64  `json:"timeoutMs"`
	IssuedAt           Time    `json:"issuedAt"`
	ExpiresAt          Time    `json:"expiresAt"`
	ConsumedAt         Time    `json:"consumedAt"`
	CheckedAt          Time    `json:"checkedAt"`
	ServerTime         Time    `json:"serverTime"`
	State              string  `json:"state"`
	ExecutionEnabled   bool    `json:"executionEnabled"`
}
