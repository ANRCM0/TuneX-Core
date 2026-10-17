// Code generated from docs/protocol/schemas/probe-result-v1.schema.json. DO NOT EDIT.
package proberesult

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

type Request struct {
	ProtocolVersion         uint64  `json:"protocolVersion"`
	ProbeVersion            uint64  `json:"probeVersion"`
	Kind                    string  `json:"kind"`
	NodeId                  Id      `json:"nodeId"`
	BootId                  Id      `json:"bootId"`
	SessionEpoch            Counter `json:"sessionEpoch"`
	InstanceId              Token   `json:"instanceId"`
	InstanceGeneration      Counter `json:"instanceGeneration"`
	PermitId                Id      `json:"permitId"`
	RequestId               Token   `json:"requestId"`
	Binding                 Binding `json:"binding"`
	TimeoutMs               uint64  `json:"timeoutMs"`
	IssuedAt                Time    `json:"issuedAt"`
	ExpiresAt               Time    `json:"expiresAt"`
	ConsumedAt              Time    `json:"consumedAt"`
	MeasuredAt              Time    `json:"measuredAt"`
	ValidUntil              Time    `json:"validUntil"`
	ElapsedMs               uint64  `json:"elapsedMs"`
	Point                   string  `json:"point"`
	Status                  string  `json:"status"`
	Code                    string  `json:"code"`
	ApplicationHealth       string  `json:"applicationHealth"`
	Source                  string  `json:"source"`
	ApplicationPayloadBytes uint64  `json:"applicationPayloadBytes"`
}

type Response struct {
	ProtocolVersion    uint64  `json:"protocolVersion"`
	ProbeVersion       uint64  `json:"probeVersion"`
	Kind               string  `json:"kind"`
	NodeId             Id      `json:"nodeId"`
	BootId             Id      `json:"bootId"`
	SessionEpoch       Counter `json:"sessionEpoch"`
	InstanceId         Token   `json:"instanceId"`
	InstanceGeneration Counter `json:"instanceGeneration"`
	PermitId           Id      `json:"permitId"`
	RequestId          Token   `json:"requestId"`
	ResultDigest       string  `json:"resultDigest"`
	AcceptedAt         Time    `json:"acceptedAt"`
	ServerTime         Time    `json:"serverTime"`
	Duplicate          bool    `json:"duplicate"`
	Health             string  `json:"health"`
	ExecutionEnabled   bool    `json:"executionEnabled"`
}
