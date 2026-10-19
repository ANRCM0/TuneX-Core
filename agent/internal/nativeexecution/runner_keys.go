package nativeexecution

import "fmt"

func RunnerDrainKey(id string, generation, fence uint64) string {
	return fmt.Sprintf("%s/%d/%d", id, generation, fence)
}
