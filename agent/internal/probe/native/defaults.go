package native

import (
	"net"

	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

func Schedule() runtimeplatform.Scheduler      { return platformruntime.Schedule{} }
func Entropy() runtimeplatform.Entropy         { return platformruntime.Local{} }
func Dialer() runtimeplatform.Dialer[net.Conn] { return platformruntime.NewDialer() }
