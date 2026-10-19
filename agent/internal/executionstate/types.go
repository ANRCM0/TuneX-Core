// Package executionstate coordinates the single authenticated Runtime Journal.
// Durable file/MAC/wire validation remains the responsibility of injected adapters.
package executionstate

const InterfaceVersion uint64 = 3

// These facts have no persisted encoding; native adapters retain their own record types.
type Journal struct {
	Snapshot   []byte
	Generation uint64
	Digest     string
	Fences     map[string]uint64
	Retired    map[string]uint64
}

type RuntimeJournal struct {
	FormatVersion         uint64
	NodeID                string
	Journal               Journal
	ExecutionExtension    *uint64
	ImportedHistoryDigest string
}

type RuntimeStore interface {
	AcquireLock() (func(), error)
	Load(node string) (RuntimeJournal, error)
	Save(value RuntimeJournal) error
}

type PhysicalResource struct {
	Address  string
	Port     uint64
	Protocol string
}
type DriverIdentity struct {
	Id           string
	ConfigDigest string
}
type ExecutionIdentity struct {
	AssignmentId         string
	ForwardId            string
	DeploymentGeneration uint64
	BindingFence         uint64
	Role                 string
	Protocol             string
	Phase                string
	Driver               DriverIdentity
	Resource             PhysicalResource
}
type PhysicalRetirement struct {
	PhysicalProtocol string
	Port             uint64
	BindingFence     uint64
}

// Only the identity/history fields required by this owner, not a copied wire schema.
type SnapshotHistory struct {
	NodeId             string
	SessionEpoch       uint64
	SnapshotGeneration uint64
	SnapshotDigest     string
	ExecutionExtension *uint64
	Assignments        []ExecutionIdentity
	Tombstones         []PhysicalRetirement
}

type SnapshotInput interface {
	// Apply the closed native validator, returning its exact history projection and original bytes.
	EncodeValidated() (SnapshotHistory, []byte, error)
}
type SnapshotCodec interface {
	DecodePrevious(raw []byte) (SnapshotHistory, error)
	// Representation predicates/keys must be pure and agree with the authenticated store.
	SupportsProtocol(version uint64) bool
	PhysicalSlotKey(protocol string, port uint64) string
}

type RuntimeHost struct {
	Store RuntimeStore
	Codec SnapshotCodec
}
