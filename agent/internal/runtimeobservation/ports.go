// Package runtimeobservation defines non-authoritative Agent measurements.
package runtimeobservation

const InterfaceVersion uint64 = 2

type ProcessSample struct {
	CPUTimeNanos        *int64
	MaxRSSBytes         *int64
	OpenFileDescriptors *int
}

type MemorySample struct {
	HeapAllocBytes uint64
	RuntimeBytes   uint64
}

// Keep individual reads explicit: the caller owns sampling order and lock scope.
type Provider[HostValue any] interface {
	Memory() MemorySample
	Process() ProcessSample
	Goroutines() int
	ProcessID() int
	Platform() string
	Host() HostValue
}
