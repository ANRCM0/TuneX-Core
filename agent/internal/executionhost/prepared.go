package executionhost

const PreparedInstanceVersion uint64 = 1

// Preparation and authorization remain with the existing caller and native adapter.
type PreparedInstance interface {
	Activate() error
	Close()
}
