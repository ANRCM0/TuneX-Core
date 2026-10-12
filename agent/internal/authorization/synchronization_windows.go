//go:build windows

package authorization

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func ReadSystemSynchronization() (SyncStatus, error) {
	context, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	command := filepath.Join(os.Getenv("SystemRoot"), "System32", "w32tm.exe")
	observed := time.Now().UTC()
	output, err := exec.CommandContext(context, command, "/query", "/status", "/verbose").Output()
	if err != nil {
		return SyncStatus{}, err
	}
	status, err := ParseWindowsTimeStatus(string(output), observed)
	if err != nil {
		return SyncStatus{}, err
	}
	status.Host, err = os.Hostname()
	return status, err
}
