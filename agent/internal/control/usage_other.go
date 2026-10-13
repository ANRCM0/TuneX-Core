//go:build !linux

package control

func processUsage() (*int64, *int64) { return nil, nil }
