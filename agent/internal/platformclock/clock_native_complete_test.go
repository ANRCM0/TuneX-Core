package platformclock

import (
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestClockCompleteActualNativeSampleBracketAndUnsupported(t *testing.T){
	if runtime.GOOS!="linux" && runtime.GOOS!="windows"{
		if _,err:=uptime();err==nil || err.Error()!="suspend-aware execution clock is unsupported on this platform"{t.Fatalf("unsupported uptime error: %v",err)}
		if _,err:=SystemClock();err==nil || !strings.HasPrefix(err.Error(),"CLOCK_UNCERTAIN: suspend-aware execution clock is unsupported"){t.Fatalf("unsupported wrapped clock: %v",err)}
		return
	}
	wallBefore:=time.Now()
	uptimeBefore,err:=uptime();if err!=nil{t.Fatal(err)}
	sample,err:=SystemClock();if err!=nil{t.Fatal(err)}
	uptimeAfter,err:=uptime();if err!=nil{t.Fatal(err)}
	wallAfter:=time.Now()
	if sample.Uptime<uptimeBefore || sample.Uptime>uptimeAfter || sample.Wall.Before(wallBefore) || sample.Wall.After(wallAfter) || sample.Wall.Location()!=time.UTC{t.Fatalf("native clock sample escaped counter/wall brackets: %#v",sample)}
}
