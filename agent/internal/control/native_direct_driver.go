package control

import (
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
)

// Legacy private names retain callers while native implementation lives with its adapter.
func nativeDirectDriver() executionDriver { return adaptExecutionDriver(nativeexecution.Direct()) }
func directExecution(a adp3.Assignment) (contracts.Assignment, error) {
	return nativeexecution.DirectAssignment(a)
}
func startExecution(a adp3.Assignment, p adp3.Policy, check func() error) (execution, error) {
	return nativeexecution.StartDirect(a, p, check)
}
func replaceExecution(old execution, a adp3.Assignment, check func() error) (execution, error) {
	return nativeexecution.ReplaceDirect(old, a, check)
}
