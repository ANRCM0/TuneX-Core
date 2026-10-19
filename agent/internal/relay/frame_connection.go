package relay

import (
	"crypto/tls"
	"io"
	"sync"
)

// framedTCP keeps application FIN independent of the TLS connection's reverse direction.
type framedTCP struct {
	*tls.Conn
	maximum        int
	allow          func() error
	writeMutex     sync.Mutex
	readBuffer     []byte
	readEnded      bool
	writeEnded     bool
	payloadWritten func(int)
}

func (c *framedTCP) Read(buffer []byte) (int, error) {
	if len(buffer) == 0 {
		return 0, nil
	}
	if err := c.allow(); err != nil {
		return 0, err
	}
	if c.readEnded {
		return 0, io.EOF
	}
	if len(c.readBuffer) == 0 {
		kind, data, err := ReadFrame(c.Conn, "tcp", c.maximum)
		if err != nil {
			return 0, err
		}
		if err := c.allow(); err != nil {
			return 0, err
		}
		if kind == FrameFIN || kind == FrameClose {
			c.readEnded = true
			return 0, io.EOF
		}
		c.readBuffer = data
	}
	n := copy(buffer, c.readBuffer)
	c.readBuffer = c.readBuffer[n:]
	return n, nil
}
func (c *framedTCP) Write(buffer []byte) (int, error) {
	c.writeMutex.Lock()
	defer c.writeMutex.Unlock()
	if c.writeEnded {
		return 0, io.ErrClosedPipe
	}
	written := 0
	for len(buffer) > 0 {
		if err := c.allow(); err != nil {
			return written, err
		}
		n := min(len(buffer), c.maximum)
		if err := WriteFrame(c.Conn, FrameTCP, buffer[:n], "tcp", c.maximum); err != nil {
			return written, err
		}
		if c.payloadWritten != nil {
			c.payloadWritten(n)
		}
		written += n
		buffer = buffer[n:]
	}
	return written, nil
}
func (c *framedTCP) CloseWrite() error {
	c.writeMutex.Lock()
	defer c.writeMutex.Unlock()
	if c.writeEnded {
		return nil
	}
	if err := c.allow(); err != nil {
		return err
	}
	c.writeEnded = true
	return WriteFrame(c.Conn, FrameFIN, nil, "tcp", c.maximum)
}
