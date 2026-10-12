package forward

import (
	"io"
	"sync"
)

type executionAuthorization struct {
	mutex sync.RWMutex
	check func() error
}

func (gate *executionAuthorization) Set(check func() error) {
	gate.mutex.Lock()
	gate.check = check
	gate.mutex.Unlock()
}
func (gate *executionAuthorization) Allow() error {
	gate.mutex.RLock()
	check := gate.check
	gate.mutex.RUnlock()
	if check != nil {
		return check()
	}
	return nil
}

type authorizedReader struct {
	source io.Reader
	gate   *executionAuthorization
}

func (reader authorizedReader) Read(data []byte) (int, error) {
	if err := reader.gate.Allow(); err != nil {
		return 0, err
	}
	n, err := reader.source.Read(data)
	if denied := reader.gate.Allow(); denied != nil {
		return 0, denied
	}
	return n, err
}

type authorizedWriter struct {
	target io.Writer
	gate   *executionAuthorization
}

func (writer authorizedWriter) Write(data []byte) (int, error) {
	if err := writer.gate.Allow(); err != nil {
		return 0, err
	}
	return writer.target.Write(data)
}
