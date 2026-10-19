package authorization

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/platformclock"
)

func TestSynchronizationCompleteActualProviderSelection(t *testing.T) {
	root:=t.TempDir()
	keyPath,path:=filepath.Join(root,"key"),filepath.Join(root,"proof")
	key:=bytes.Repeat([]byte{3},32)
	if err:=os.WriteFile(keyPath,key,0600);err!=nil{t.Fatal(err)}
	host,err:=os.Hostname();if err!=nil{t.Fatal(err)}
	source:=platformclock.Source()
	if runtime.GOOS!="linux" && runtime.GOOS!="windows" {
		if source!=""{t.Fatal("unsupported platform advertised a native clock source")}
		if _,err:=ReadSystemSynchronization();err==nil || err.Error()!="OS synchronization provider unsupported"{t.Fatalf("unsupported provider: %v",err)}
		if _,err:=SystemClock();err==nil || err.Error()!="CLOCK_UNCERTAIN: suspend-aware execution clock is unsupported on this platform"{t.Fatalf("unsupported sample: %v",err)}
		return
	}
	if runtime.GOOS=="windows" {
		if source!="windows-w32time"{t.Fatal("wrong Windows source")}
		// Native provider failure is deterministic and needs no privileged service change.
		t.Setenv("SystemRoot",filepath.Join(root,"absent-windows"))
		_,err:=SynchronizedClock(time.Second,ProofOptions{})()
		if err==nil || !strings.HasPrefix(err.Error(),"CLOCK_UNCERTAIN: synchronization provider unavailable: "){t.Fatalf("OS default was not selected: %v",err)}
	} else {
		if source!="linux-adjtimex"{t.Fatal("wrong Linux source")}
		status,err:=ReadSystemSynchronization()
		if err!=nil{t.Fatalf("native Linux synchronization query failed: %v",err)}
		if status.Host!=host || status.Source!=source || status.ObservedAt==""{t.Fatalf("native OS provider fields: %#v",status)}
	}
	// Explicit proof selection must succeed independently of the OS service's state.
	status:=SyncStatus{Host:host,Source:source,Synchronized:true,ObservedAt:time.Now().UTC().Format(time.RFC3339Nano)}
	if err:=WriteProof(path,key,status);err!=nil{t.Fatal(err)}
	if _,err:=SynchronizedClock(5*time.Second,ProofOptions{Path:path,KeyPath:keyPath})();err!=nil{t.Fatalf("proof selection used OS service: %v",err)}
	for _,bad:=range []string{"host","source","timestamp"}{
		v:=status;v.ObservedAt="invalid"
		message:="fresh bounded"
		if bad=="host"{v.Host="wrong-host";message="another host"}
		if bad=="source"{v.Source="wrong-source";message="another platform"}
		if err:=WriteProof(path,key,v);err!=nil{t.Fatal(err)}
		_,err:=SynchronizedClock(5*time.Second,ProofOptions{Path:path,KeyPath:keyPath})()
		if err==nil || !strings.Contains(err.Error(),message){t.Fatalf("native proof %s precedence: %v",bad,err)}
	}
	missing:=filepath.Join(root,"missing")
	_,err=SynchronizedClock(time.Second,ProofOptions{Path:missing,KeyPath:keyPath})()
	if !errors.Is(err,os.ErrNotExist){t.Fatalf("proof error fell back to OS: %v",err)}
}

func TestSynchronizationCompleteWindowsHostileStatusFields(t *testing.T){
	now:=time.Date(2026,10,19,0,0,0,0,time.UTC)
	for _,v:=range []struct{old,replacement string}{
		{"Leap indicator: 0","Leap indicator: -1"},{"Leap indicator: 0","Leap indicator: 1.5"},
		{"Stratum: 5","Stratum: 0"},{"Stratum: 5","Stratum: 16"},{"Stratum: 5","Stratum: 1.5"},
		{"Root delay: 0.0831891s","Root delay: -1s"},{"Root delay: 0.0831891s","Root delay: 3600.1s"},
		{"Root dispersion: 4.3827594s","Root dispersion: -1s"},{"Root dispersion: 4.3827594s","Root dispersion: 3600.1s"},
		{"Phase offset: -0.0000522s","Phase offset: -3600.1s"},{"Phase offset: -0.0000522s","Phase offset: 3600.1s"},
		{"State machine: 2","State machine: 2.5"},{"Last error: 0","Last error: 1"},
		{"Time since last good sync: 12.0s","Time since last good sync: -1s"},{"Time since last good sync: 12.0s","Time since last good sync: 31536001s"},
		{"Reference ID: 0x34E772B7","Reference ID: 0x4c4f434b"},{"Source: time.windows.com,0x9","Source: "},
		{"Root delay: 0.0831891s","Root delay: NaN"},{"Root delay: 0.0831891s","Root delay: +Inf"},
	}{
		text:=strings.Replace(windowsStatus,v.old,v.replacement,1)
		if text==windowsStatus{t.Fatalf("fixture replacement missed %q",v.old)}
		got,err:=ParseWindowsTimeStatus(text,now)
		if err==nil && got.Synchronized{t.Fatalf("hostile Windows field accepted: %s",v.replacement)}
	}
	if _,err:=ParseWindowsTimeStatus(windowsStatus+"Extra: 1\n",now);err==nil{t.Fatal("unknown extra layout accepted")}
	comma:=strings.NewReplacer("0.0831891","0,0831891","4.3827594","4,3827594","-0.0000522","-0,0000522","12.0s","12,0s").Replace(windowsStatus)
	want,err:=ParseWindowsTimeStatus(windowsStatus,now);if err!=nil{t.Fatal(err)}
	got,err:=ParseWindowsTimeStatus(comma,now);if err!=nil || got!=want{t.Fatal("native comma numeric locale changed facts")}
}
