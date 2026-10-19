package platformstate

import (
	"os"
	"path/filepath"
)

const InterfaceVersion uint64 = 1

func AtomicWrite(path string, raw []byte) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".state-")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if err = file.Chmod(0600); err == nil {
		_, err = file.Write(raw)
	}
	if err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	// Windows does not support directory fsync. POSIX persistence includes the renamed directory entry.
	if directory, openErr := os.Open(filepath.Dir(path)); openErr == nil {
		syncErr := directory.Sync()
		directory.Close()
		if syncErr != nil && os.PathSeparator != '\\' {
			return syncErr
		}
	} else if os.PathSeparator != '\\' {
		return openErr
	}
	return nil
}
