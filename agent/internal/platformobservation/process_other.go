//go:build !linux

package platformobservation

func processUsage() (*int64, *int64) { return nil, nil }

func openFileDescriptors() *int { return nil }
