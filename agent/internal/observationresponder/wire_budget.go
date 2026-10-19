package observationresponder

import (
	"errors"
	"io"
	"net"
	"sync"
	"sync/atomic"
)

const MaximumReadWireBytes = 32768
const MaximumWriteWireBytes = 32768

var errWireBudget = errors.New("OBSERVATION_WIRE_LIMIT: fixed TLS connection byte budget exhausted")

// This wrapper caps raw TLS wire I/O; it does not buffer or interpret application data.
type wireBudgetConn struct {
	net.Conn
	readMutex  sync.Mutex
	writeMutex sync.Mutex
	readBytes  int
	writeBytes int
	exhausted  atomic.Bool
}

func (connection *wireBudgetConn) fail() {
	connection.exhausted.Store(true)
	connection.Conn.Close()
}

func (connection *wireBudgetConn) Read(buffer []byte) (int, error) {
	connection.readMutex.Lock()
	defer connection.readMutex.Unlock()
	remaining := MaximumReadWireBytes - connection.readBytes
	if connection.exhausted.Load() || remaining <= 0 {
		connection.fail()
		return 0, errWireBudget
	}
	if len(buffer) == 0 {
		return 0, nil
	}
	if len(buffer) > remaining {
		buffer = buffer[:remaining]
	}
	n, err := connection.Conn.Read(buffer)
	connection.readBytes += n
	if connection.readBytes >= MaximumReadWireBytes {
		connection.fail()
		return n, errWireBudget
	}
	return n, err
}

func (connection *wireBudgetConn) Write(buffer []byte) (int, error) {
	connection.writeMutex.Lock()
	defer connection.writeMutex.Unlock()
	remaining := MaximumWriteWireBytes - connection.writeBytes
	if connection.exhausted.Load() || remaining <= 0 || len(buffer) > remaining {
		connection.fail()
		return 0, errWireBudget
	}
	if len(buffer) == 0 {
		return 0, nil
	}
	n, err := connection.Conn.Write(buffer)
	connection.writeBytes += n
	if connection.writeBytes >= MaximumWriteWireBytes {
		connection.fail()
		return n, errWireBudget
	}
	if n < len(buffer) && err == nil {
		connection.fail()
		return n, io.ErrShortWrite
	}
	return n, err
}
