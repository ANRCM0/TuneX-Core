// Package observationwire owns native measurement formats, never execution authority.
package observationwire

import (
	"encoding/hex"
	"encoding/json"
	"io"
	"strconv"
	"time"
)

const InterfaceVersion uint64 = 1

type ProbeTelemetryLimits struct{ Page, Snapshot, Retiring int }

func Uint64Text(value uint64) string             { return strconv.FormatUint(value, 10) }
func EpochText(value []byte) string              { return hex.EncodeToString(value) }
func UTCTimeText(value time.Time) string         { return value.UTC().Format(time.RFC3339Nano) }
func TimeText(value time.Time) string            { return value.Format(time.RFC3339Nano) }
func EncodeValue(value any) ([]byte, error)      { return json.Marshal(value) }
func ReadAckBody(body io.Reader) ([]byte, error) { return io.ReadAll(io.LimitReader(body, 4097)) }

func OptionalCounter(value *int64) *string {
	if value == nil || *value < 0 {
		return nil
	}
	encoded := strconv.FormatInt(*value, 10)
	return &encoded
}
