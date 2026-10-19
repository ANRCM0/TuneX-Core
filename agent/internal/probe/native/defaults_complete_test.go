package native

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/platformruntime"
)

func TestProbeNativeCompleteFreshZeroDialerAndNativeEffects(t *testing.T){
	first,second:=Dialer(),Dialer()
	left,ok:=first.(*platformruntime.Dialer);if !ok{t.Fatal("native dialer owner changed")};right,ok:=second.(*platformruntime.Dialer)
	if !ok||left==right||!reflect.DeepEqual(left,&platformruntime.Dialer{})||!reflect.DeepEqual(right,&platformruntime.Dialer{}){t.Fatal("Probe defaults reused or configured a native dialer")}
	if !reflect.DeepEqual(Schedule(),platformruntime.Schedule{})||!reflect.DeepEqual(Entropy(),platformruntime.Local{}){t.Fatal("Probe native Effects family changed")}
	ctx,cancel:=context.WithCancel(context.Background());cancel()
	// A cancelled call needs no socket or resolver and exposes the original
	// native error and network/address forwarding rather than a new wrapper.
	if connection,err:=first.DialContext(ctx,"tcp","127.0.0.1:1");connection!=nil||!errors.Is(err,context.Canceled){t.Fatal("native DialContext cancellation changed",err)}
}
