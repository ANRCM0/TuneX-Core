// adp-validate inspects messages; it cannot bind sockets, issue leases or execute a Forward.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/tunex/vnext/agent/internal/adp3"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "Usage: adp-validate <HelloRequest|HelloResponse|Snapshot|ReportRequest|ReportAck|ErrorResponse>")
		os.Exit(2)
	}
	raw, err := io.ReadAll(io.LimitReader(os.Stdin, 4194305))
	if err == nil {
		_, err = adp3.Parse(os.Args[1], raw)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"valid": true, "message": os.Args[1], "protocolVersion": 3})
}
