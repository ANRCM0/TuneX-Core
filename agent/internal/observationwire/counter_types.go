package observationwire

import "github.com/tunex/vnext/agent/internal/proberesult"

type ForwardCounterResource struct {
	Protocol string `json:"protocol"`
	Address  string `json:"address"`
	Port     uint64 `json:"port"`
}

type ForwardCounterIdentity struct {
	NodeID               string                 `json:"nodeId"`
	BootID               string                 `json:"bootId"`
	SessionEpoch         uint64                 `json:"sessionEpoch"`
	AssignmentID         string                 `json:"assignmentId"`
	ForwardID            string                 `json:"forwardId"`
	ForwardRevision      uint64                 `json:"forwardRevision"`
	DeploymentGeneration uint64                 `json:"deploymentGeneration"`
	BindingFence         uint64                 `json:"bindingFence"`
	Role                 string                 `json:"role"`
	Protocol             string                 `json:"protocol"`
	DriverID             string                 `json:"driverId"`
	DriverSchemaVersion  uint64                 `json:"driverSchemaVersion"`
	ConfigDigest         string                 `json:"configDigest"`
	Resource             ForwardCounterResource `json:"resource"`
}

type ForwardCounterValues struct {
	PayloadSentBytes       string `json:"payloadSentBytes"`
	PayloadReceivedBytes   string `json:"payloadReceivedBytes"`
	TCPAccepted            string `json:"tcpAccepted"`
	TCPConnected           string `json:"tcpConnected"`
	TCPClosed              string `json:"tcpClosed"`
	UDPAssociationsCreated string `json:"udpAssociationsCreated"`
	UDPAssociationsClosed  string `json:"udpAssociationsClosed"`
	UDPDatagramsSent       string `json:"udpDatagramsSent"`
	UDPDatagramsReceived   string `json:"udpDatagramsReceived"`
}

type ForwardCounterPoint struct {
	Identity     ForwardCounterIdentity `json:"identity"`
	State        string                 `json:"state"`
	Phase        string                 `json:"phase"`
	CapturedAt   string                 `json:"capturedAt"`
	EndedAt      *string                `json:"endedAt"`
	Availability string                 `json:"availability"`
	CounterEpoch *string                `json:"counterEpoch"`
	Counters     *ForwardCounterValues  `json:"counters"`
	Overflowed   *bool                  `json:"overflowed"`
}

type ForwardCounterCoverage struct {
	Limit                int    `json:"limit"`
	Available            int    `json:"available"`
	Returned             int    `json:"returned"`
	Omitted              int    `json:"omitted"`
	Truncated            bool   `json:"truncated"`
	Offset               int    `json:"offset"`
	NextOffset           int    `json:"nextOffset"`
	UnavailableSources   int    `json:"unavailableSources"`
	TailLimit            int    `json:"tailLimit"`
	TailRetentionSeconds int    `json:"tailRetentionSeconds"`
	TailsEvicted         string `json:"tailsEvicted"`
	TailsExpired         string `json:"tailsExpired"`
	HistoryComplete      bool   `json:"historyComplete"`
}

type ForwardCounterSnapshot struct {
	CounterVersion      int                    `json:"counterVersion"`
	Kind                string                 `json:"kind"`
	Source              string                 `json:"source"`
	Health              string                 `json:"health"`
	ExecutionAuthorized bool                   `json:"executionAuthorized"`
	CapturedAt          string                 `json:"capturedAt"`
	Final               bool                   `json:"final"`
	SnapshotGeneration  uint64                 `json:"snapshotGeneration"`
	Coverage            ForwardCounterCoverage `json:"coverage"`
	Items               []ForwardCounterPoint  `json:"items"`
}

type ProbeCounterIdentity struct {
	Binding            proberesult.Binding `json:"binding"`
	InstanceID         string              `json:"instanceId"`
	InstanceGeneration uint64              `json:"instanceGeneration"`
}

type ProbeCounterValues struct {
	Attempted string `json:"attempted"`
	Succeeded string `json:"succeeded"`
	Failed    string `json:"failed"`
	Unknown   string `json:"unknown"`
	InFlight  string `json:"inFlight"`
}

type ProbeCounterPoint struct {
	Identity     ProbeCounterIdentity `json:"identity"`
	State        string               `json:"state"`
	CapturedAt   string               `json:"capturedAt"`
	EndedAt      *string              `json:"endedAt"`
	Availability string               `json:"availability"`
	CounterEpoch *string              `json:"counterEpoch"`
	Counters     *ProbeCounterValues  `json:"counters"`
	Overflowed   *bool                `json:"overflowed"`
}

type ProbeCounterCoverage struct {
	Limit                int    `json:"limit"`
	SnapshotLimit        int    `json:"snapshotLimit"`
	Available            int    `json:"available"`
	Returned             int    `json:"returned"`
	Omitted              int    `json:"omitted"`
	Truncated            bool   `json:"truncated"`
	Offset               int    `json:"offset"`
	NextOffset           int    `json:"nextOffset"`
	UnavailableSources   int    `json:"unavailableSources"`
	RetiringSourceLimit  int    `json:"retiringSourceLimit"`
	RetiringSources      int    `json:"retiringSources"`
	TailLimit            int    `json:"tailLimit"`
	TailRetentionSeconds int    `json:"tailRetentionSeconds"`
	TailsEvicted         string `json:"tailsEvicted"`
	TailsExpired         string `json:"tailsExpired"`
	HistoryComplete      bool   `json:"historyComplete"`
}
