package control

import (
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
)

func nativeRelayDriver() executionDriver    { return adaptExecutionDriver(nativeexecution.Relay()) }
func nativeMultihopDriver() executionDriver { return adaptExecutionDriver(nativeexecution.Multihop()) }
func relayMaximum(host executionHost, assignment adp3.Assignment) int {
	return nativeexecution.Maximum(publicExecutionHost(host), assignment)
}
func startRelayExecution(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
	return nativeexecution.StartRelay(publicExecutionHost(host), a, check)
}
func startMultihopExecution(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
	return nativeexecution.StartMultihop(publicExecutionHost(host), a, check)
}
func finishRelayStart(instance executiondriver.Instance, phase string) (execution, error) {
	return nativeexecution.FinishRelayStartInstance(instance, phase)
}
func relayExecutionPhase(instance execution, phase string) error {
	return nativeexecution.RelayPhase(instance, phase)
}
func relayExecutionError(err error) (string, bool) { return nativeexecution.ClassifyRelay(err) }
