//go:build !windows && !linux && !darwin && !freebsd

package tstruntime

func tightenDirectory(string) error   { return ErrCache }
func protectPrivateFile(string) error { return ErrCache }

func lockStateDirectory(string) (func(), error) { return nil, ErrCache }
