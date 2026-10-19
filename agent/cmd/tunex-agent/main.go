package main

import (
	"fmt"
	"os"

	"github.com/tunex/vnext/agent/internal/agentcli"
	"github.com/tunex/vnext/agent/internal/agentcommand"
	"github.com/tunex/vnext/agent/internal/control"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	options := agentcli.ParseOptions()
	host := agentcommand.Host{Platform: agentcli.Native{}, NewRunner: func(options control.Options) (agentcommand.Runner, error) {
		return control.New(options)
	}}
	return host.Run(options)
}

func enrollment(url, node, ca, root, keyPath, certificatePath, privatePath, journalPath string) error {
	return (agentcli.Native{}).Enroll(executionenrollment.Options{URL: url, NodeID: node, CA: ca, Root: root, KeyPath: keyPath,
		CertificatePath: certificatePath, PrivatePath: privatePath, JournalPath: journalPath})
}
