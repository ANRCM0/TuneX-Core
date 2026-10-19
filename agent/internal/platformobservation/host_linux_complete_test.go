//go:build linux

package platformobservation

import (
	"bytes"
	"errors"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func TestHostLinuxCompleteBoundedSource(t *testing.T) {
	path := filepath.Join(t.TempDir(), "source")
	for _, size := range []int{0, 7, 8, 9, 4096} {
		data := bytes.Repeat([]byte{'x'}, size)
		if err := os.WriteFile(path, data, 0600); err != nil { t.Fatal(err) }
		got, err := readHostResource(path, 8)
		if size <= 8 {
			if err != nil || !bytes.Equal(got, data) { t.Fatalf("size %d: %q %v", size, got, err) }
		} else if got != nil || err == nil || err.Error() != "Host resource source unavailable" {
			t.Fatalf("oversize %d leaked partial source: %q %v", size, got, err)
		}
	}
	if _, err := readHostResource(path+"-missing", 8); !errors.Is(err, os.ErrNotExist) { t.Fatalf("native open error: %v", err) }
	if got, err := readHostResource(filepath.Dir(path), 8); got != nil || err == nil || err.Error() != "Host resource source unavailable" { t.Fatalf("read error: %q %v", got, err) }
}

func TestHostLinuxCompleteNumericParsingAndOverflow(t *testing.T) {
	for _, value := range []string{"", "-1", "+1", " 1", "1 ", "1.0", "18446744073709551616", "١"} {
		if _, ok := hostUnsigned(value); ok { t.Fatalf("accepted unsigned %q", value) }
	}
	for _, entry := range []struct { text string; want uint64 }{{"0", 0}, {"0001", 1}, {"18446744073709551615", math.MaxUint64}} {
		if got, ok := hostUnsigned(entry.text); !ok || got != entry.want { t.Fatalf("unsigned %q: %d %v", entry.text, got, ok) }
	}
	if got, ok := hostAdd(math.MaxUint64-1, 1); !ok || got != math.MaxUint64 { t.Fatal("addition edge") }
	if got, ok := hostAdd(math.MaxUint64, 1); ok || got != 0 { t.Fatal("addition overflow") }
	if got, ok := hostMultiply(math.MaxUint64, 0); !ok || got != 0 { t.Fatal("zero multiplication") }
	if got, ok := hostMultiply(math.MaxUint64/1024, 1024); !ok || got != math.MaxUint64/1024*1024 { t.Fatal("multiplication edge") }
	if got, ok := hostMultiply(math.MaxUint64/1024+1, 1024); ok || got != 0 { t.Fatal("multiplication overflow") }
	for _, entry := range []struct { text string; want uint64 }{{"0", 0}, {"1", 1000}, {"1.2", 1200}, {"1.02", 1020}, {"1.002", 1002}, {"18446744073709551.615", math.MaxUint64}} {
		if got, ok := hostLoadMilli(entry.text); !ok || got != entry.want { t.Fatalf("load %q: %d %v", entry.text, got, ok) }
	}
	for _, value := range []string{"", ".1", "1.", "1.0000", "1.2.3", "-1", "1e2", "18446744073709552", "18446744073709551.616"} {
		if _, ok := hostLoadMilli(value); ok { t.Fatalf("accepted load %q", value) }
	}
	if got := hostDecimal(math.MaxUint64); got == nil || *got != "18446744073709551615" { t.Fatal("decimal precision lost") }
	for _, name := range []string{"eth0", "veth_1.2:@-", "a"} { if !hostInterfaceName.MatchString(name) { t.Fatalf("rejected interface %q", name) } }
	for _, name := range []string{"", "-eth0", "eth 0", "eth/0", string(bytes.Repeat([]byte{'a'}, 64))} { if hostInterfaceName.MatchString(name) { t.Fatalf("accepted interface %q", name) } }
}
