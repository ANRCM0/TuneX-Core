package nativeexecution

import "time"

// Decode the native text only; callers own clock samples and lifetime decisions.
func ParseWireTime(text string) (time.Time, error) { return time.Parse(time.RFC3339Nano, text) }
