package authorization

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var statusNumber = regexp.MustCompile(`^[-+]?[0-9]+(?:[.,][0-9]+)?`)

func numericStatus(value string) (float64, error) {
	match := statusNumber.FindString(strings.TrimSpace(value))
	if match == "" {
		return 0, fmt.Errorf("invalid time status number")
	}
	number, err := strconv.ParseFloat(strings.ReplaceAll(match, ",", "."), 64)
	if err != nil || math.IsNaN(number) || math.IsInf(number, 0) {
		return 0, fmt.Errorf("invalid time status number")
	}
	return number, nil
}

// w32tm's documented verbose field order is independent of translated labels.
// Unknown/truncated layouts fail rather than treating a running service as proof.
func ParseWindowsTimeStatus(output string, observed time.Time) (SyncStatus, error) {
	values := []string{}
	for _, line := range strings.Split(output, "\n") {
		index := strings.Index(line, ":")
		if index >= 0 {
			values = append(values, strings.TrimSpace(line[index+1:]))
		}
	}
	if len(values) != 16 {
		return SyncStatus{}, fmt.Errorf("unsupported Windows time status layout")
	}
	leap, err := numericStatus(values[0])
	if err != nil {
		return SyncStatus{}, err
	}
	stratum, err := numericStatus(values[1])
	if err != nil {
		return SyncStatus{}, err
	}
	delay, err := numericStatus(values[3])
	if err != nil {
		return SyncStatus{}, err
	}
	dispersion, err := numericStatus(values[4])
	if err != nil {
		return SyncStatus{}, err
	}
	offset, err := numericStatus(values[9])
	if err != nil {
		return SyncStatus{}, err
	}
	state, err := numericStatus(values[11])
	if err != nil {
		return SyncStatus{}, err
	}
	lastError, err := numericStatus(values[14])
	if err != nil {
		return SyncStatus{}, err
	}
	holdover, err := numericStatus(values[15])
	if err != nil {
		return SyncStatus{}, err
	}
	if delay < 0 || dispersion < 0 || delay > 3600 || dispersion > 3600 || math.Abs(offset) > 3600 || holdover < 0 || holdover > 86400*365 {
		return SyncStatus{}, fmt.Errorf("invalid Windows time error bound")
	}
	errorNanos := int64(math.Ceil((delay/2 + dispersion + math.Abs(offset) + holdover*0.0005) * 1e9))
	reference := strings.ToUpper(values[5])
	local := strings.Contains(reference, "0X4C4F434C") || strings.Contains(reference, "0X4C4F434B")
	return SyncStatus{Source: "windows-w32time", Synchronized: leap >= 0 && leap < 3 && math.Trunc(leap) == leap && stratum >= 1 && stratum <= 15 && math.Trunc(stratum) == stratum && state == 2 && lastError == 0 && !local && values[7] != "", MaxErrorNanos: errorNanos, ObservedAt: observed.UTC().Format(time.RFC3339Nano)}, nil
}
