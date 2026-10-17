// Code generated from docs/protocol/schemas/probe-instance-v1.schema.json. DO NOT EDIT.
package probeinstance

type Id = string

type InstanceId = string

type Counter = uint64

type Epoch = uint64

type Time = string

type Request struct {
	ProtocolVersion    uint64     `json:"protocolVersion"`
	ProbeVersion       uint64     `json:"probeVersion"`
	Kind               string     `json:"kind"`
	Action             string     `json:"action"`
	NodeId             Id         `json:"nodeId"`
	BootId             Id         `json:"bootId"`
	SessionEpoch       Epoch      `json:"sessionEpoch"`
	InstanceId         InstanceId `json:"instanceId"`
	ExpectedGeneration Counter    `json:"expectedGeneration"`
}

type Response struct {
	ProtocolVersion    uint64      `json:"protocolVersion"`
	ProbeVersion       uint64      `json:"probeVersion"`
	Kind               string      `json:"kind"`
	Action             string      `json:"action"`
	NodeId             Id          `json:"nodeId"`
	BootId             Id          `json:"bootId"`
	SessionEpoch       Epoch       `json:"sessionEpoch"`
	InstanceId         InstanceId  `json:"instanceId"`
	ExpectedGeneration Counter     `json:"expectedGeneration"`
	Generation         Counter     `json:"generation"`
	State              string      `json:"state"`
	CurrentInstanceId  *InstanceId `json:"currentInstanceId"`
	RegisteredAt       *Time       `json:"registeredAt"`
	ExpiresAt          *Time       `json:"expiresAt"`
	ServerTime         Time        `json:"serverTime"`
	ExecutionEnabled   bool        `json:"executionEnabled"`
}
