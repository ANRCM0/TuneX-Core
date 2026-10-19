//go:build linux

package platformobservation

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"
)

var hostInterfaceName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,62}$`)

func readHostResource(path string, maximum int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maximum+1))
	if err != nil || int64(len(data)) > maximum {
		return nil, fmt.Errorf("Host resource source unavailable")
	}
	return data, nil
}

func hostUnsigned(value string) (uint64, bool) {
	if value == "" {
		return 0, false
	}
	for index := 0; index < len(value); index++ {
		if value[index] < '0' || value[index] > '9' {
			return 0, false
		}
	}
	number, err := strconv.ParseUint(value, 10, 64)
	return number, err == nil
}

func hostAdd(left, right uint64) (uint64, bool) {
	if right > ^uint64(0)-left {
		return 0, false
	}
	return left + right, true
}

func hostMultiply(left, right uint64) (uint64, bool) {
	if right != 0 && left > ^uint64(0)/right {
		return 0, false
	}
	return left * right, true
}

func hostDecimal(value uint64) *string {
	encoded := strconv.FormatUint(value, 10)
	return &encoded
}

func readHostCPU() HostCPUResources {
	unavailable := HostCPUResources{Availability: "unavailable"}
	data, err := readHostResource("/proc/stat", 1048576)
	if err != nil {
		return unavailable
	}
	cores := make(map[string]bool)
	var values [8]uint64
	found := false
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		if fields[0] == "cpu" {
			if found || len(fields) < 9 {
				return unavailable
			}
			found = true
			for index := range values {
				value, valid := hostUnsigned(fields[index+1])
				if !valid {
					return unavailable
				}
				values[index] = value
			}
		} else if strings.HasPrefix(fields[0], "cpu") {
			label := strings.TrimPrefix(fields[0], "cpu")
			if _, valid := hostUnsigned(label); !valid || len(label) > 1 && label[0] == '0' || cores[label] || len(cores) >= 65536 {
				return unavailable
			}
			cores[label] = true
		}
	}
	if !found || len(cores) == 0 {
		return unavailable
	}
	total := uint64(0)
	for _, value := range values {
		var valid bool
		total, valid = hostAdd(total, value)
		if !valid {
			return unavailable
		}
	}
	count := len(cores)
	// Linux guest/guest_nice fields are already included in user/nice and are not added again.
	return HostCPUResources{Availability: "available", LogicalProcessors: &count,
		TotalTicks: hostDecimal(total), IdleTicks: hostDecimal(values[3]), IOWaitTicks: hostDecimal(values[4])}
}

func readHostMemory() HostMemoryResources {
	unavailable := HostMemoryResources{Availability: "unavailable"}
	data, err := readHostResource("/proc/meminfo", 65536)
	if err != nil {
		return unavailable
	}
	values := make(map[string]uint64, 2)
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 || fields[0] != "MemTotal:" && fields[0] != "MemAvailable:" {
			continue
		}
		if _, duplicate := values[fields[0]]; duplicate || len(fields) != 3 || fields[2] != "kB" {
			return unavailable
		}
		kibibytes, valid := hostUnsigned(fields[1])
		if !valid {
			return unavailable
		}
		bytes, valid := hostMultiply(kibibytes, 1024)
		if !valid {
			return unavailable
		}
		values[fields[0]] = bytes
	}
	total, totalFound := values["MemTotal:"]
	available, availableFound := values["MemAvailable:"]
	if !totalFound || !availableFound || total == 0 || available > total {
		return unavailable
	}
	return HostMemoryResources{Availability: "available", TotalBytes: hostDecimal(total), AvailableBytes: hostDecimal(available)}
}

func hostLoadMilli(value string) (uint64, bool) {
	parts := strings.Split(value, ".")
	if len(parts) > 2 || len(parts) == 2 && (len(parts[1]) == 0 || len(parts[1]) > 3) {
		return 0, false
	}
	whole, valid := hostUnsigned(parts[0])
	if !valid {
		return 0, false
	}
	total, valid := hostMultiply(whole, 1000)
	if !valid {
		return 0, false
	}
	if len(parts) == 1 {
		return total, true
	}
	fraction, valid := hostUnsigned(parts[1] + strings.Repeat("0", 3-len(parts[1])))
	if !valid {
		return 0, false
	}
	return hostAdd(total, fraction)
}

func readHostLoad() HostLoadResources {
	unavailable := HostLoadResources{Availability: "unavailable"}
	data, err := readHostResource("/proc/loadavg", 4096)
	if err != nil {
		return unavailable
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return unavailable
	}
	var values [3]uint64
	for index := range values {
		value, valid := hostLoadMilli(fields[index])
		if !valid {
			return unavailable
		}
		values[index] = value
	}
	return HostLoadResources{Availability: "available", OneMilli: hostDecimal(values[0]),
		FiveMilli: hostDecimal(values[1]), FifteenMilli: hostDecimal(values[2])}
}

func readHostFilesystem() HostFilesystemResources {
	unavailable := HostFilesystemResources{Availability: "unavailable", Scope: "agent-root-filesystem"}
	var stats syscall.Statfs_t
	if err := syscall.Statfs("/", &stats); err != nil || stats.Bavail > stats.Blocks {
		return unavailable
	}
	blockBytes := int64(stats.Frsize)
	if blockBytes <= 0 {
		blockBytes = int64(stats.Bsize)
	}
	if blockBytes <= 0 {
		return unavailable
	}
	total, totalValid := hostMultiply(stats.Blocks, uint64(blockBytes))
	available, availableValid := hostMultiply(stats.Bavail, uint64(blockBytes))
	if !totalValid || !availableValid {
		return unavailable
	}
	return HostFilesystemResources{Availability: "available", Scope: "agent-root-filesystem",
		TotalBytes: hostDecimal(total), AvailableBytes: hostDecimal(available)}
}

func readHostNetwork() HostNetworkResources {
	unavailable := HostNetworkResources{Availability: "unavailable", Scope: "agent-network-namespace", Limit: 16,
		Interfaces: []HostNetworkInterface{}}
	data, err := readHostResource("/proc/net/dev", 131072)
	if err != nil {
		return unavailable
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) < 2 || !strings.Contains(lines[0], "|") || !strings.Contains(lines[1], "|") {
		return unavailable
	}
	interfaces := make([]HostNetworkInterface, 0, 16)
	seen := make(map[string]bool)
	scanned := 0
	for _, line := range lines[2:] {
		if strings.TrimSpace(line) == "" {
			continue
		}
		scanned++
		if scanned > 128 {
			return unavailable
		}
		separator := strings.LastIndexByte(line, ':')
		if separator < 1 {
			return unavailable
		}
		name := strings.TrimSpace(line[:separator])
		fields := strings.Fields(line[separator+1:])
		if len(name) > 63 || !hostInterfaceName.MatchString(name) || seen[name] || len(fields) != 16 {
			return unavailable
		}
		seen[name] = true
		var values [16]uint64
		for index := range values {
			value, valid := hostUnsigned(fields[index])
			if !valid {
				return unavailable
			}
			values[index] = value
		}
		if name != "lo" {
			interfaces = append(interfaces, HostNetworkInterface{Name: name,
				RXBytes: strconv.FormatUint(values[0], 10), TXBytes: strconv.FormatUint(values[8], 10)})
		}
	}
	sort.Slice(interfaces, func(left, right int) bool { return interfaces[left].Name < interfaces[right].Name })
	available := len(interfaces)
	returned := min(available, 16)
	return HostNetworkResources{Availability: "available", Scope: "agent-network-namespace", Limit: 16,
		Available: available, Returned: returned, Omitted: available - returned, Truncated: available > returned,
		Interfaces: interfaces[:returned]}
}

func CaptureHost() HostResources {
	return HostResources{Scope: "agent-visible-os", CPU: readHostCPU(), Memory: readHostMemory(),
		Load: readHostLoad(), Filesystem: readHostFilesystem(), Network: readHostNetwork()}
}
