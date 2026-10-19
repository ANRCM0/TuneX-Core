package controlchannel

import (
	"fmt"
	"strconv"
	"strings"
)

func ValidateControlURL(base string) error {
	if !strings.HasPrefix(base, "https://") {
		return fmt.Errorf("HTTPS Control URL required")
	}
	return nil
}

func RuntimeSnapshotPath(generation uint64) string {
	return "/agent/v3/snapshot?sinceGeneration=" + strconv.FormatUint(generation, 10)
}
