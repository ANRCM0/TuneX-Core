// Code generated from docs/protocol/schemas/probe-negotiation-v1.schema.json. DO NOT EDIT.
package probenegotiation

type Id = string

type InstanceId = string

type Counter = uint64

type Time = string

type Request struct {
	ProtocolVersion         uint64     `json:"protocolVersion"`
	ProbeVersion            uint64     `json:"probeVersion"`
	Kind                    string     `json:"kind"`
	NodeId                  Id         `json:"nodeId"`
	BootId                  Id         `json:"bootId"`
	SessionEpoch            Counter    `json:"sessionEpoch"`
	InstanceId              InstanceId `json:"instanceId"`
	Capability              string     `json:"capability"`
	Point                   string     `json:"point"`
	MaxTimeoutMs            uint64     `json:"maxTimeoutMs"`
	MaxAttempts             uint64     `json:"maxAttempts"`
	ApplicationPayloadBytes uint64     `json:"applicationPayloadBytes"`
}

type Response struct {
	ProtocolVersion         uint64     `json:"protocolVersion"`
	ProbeVersion            uint64     `json:"probeVersion"`
	Kind                    string     `json:"kind"`
	NodeId                  Id         `json:"nodeId"`
	BootId                  Id         `json:"bootId"`
	SessionEpoch            Counter    `json:"sessionEpoch"`
	InstanceId              InstanceId `json:"instanceId"`
	Capability              string     `json:"capability"`
	Point                   string     `json:"point"`
	MaxTimeoutMs            uint64     `json:"maxTimeoutMs"`
	MaxAttempts             uint64     `json:"maxAttempts"`
	ApplicationPayloadBytes uint64     `json:"applicationPayloadBytes"`
	ServerTime              Time       `json:"serverTime"`
	State                   string     `json:"state"`
	ExecutionEnabled        bool       `json:"executionEnabled"`
}
