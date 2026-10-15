package control

import (
 "fmt"

 "github.com/tunex/vnext/agent/internal/adp3transit"
)

// transitPhysicalGuard is the local fail-closed bridge to the deployed Runtime
// high-water and live sockets. Control has NOT yet authorized cross-role port
// reallocation, so any port ever used by Direct/Relay is denied to Transit.
func (runner *Runner) transitPhysicalGuard(a adp3transit.Assignment)error{
 runner.mutex.Lock()
 defer runner.mutex.Unlock()
 slot:=fmt.Sprintf("tcp/%d",a.Resource.Port)
 if runner.journal.Fences[slot]!=0||runner.journal.Retired[slot]!=0{
  return fmt.Errorf("FENCING_REJECTED: Physical port belongs to existing ADP/3 journal")
 }
 if _,exists:=runner.instances[slot];exists{
  return fmt.Errorf("PORT_RESERVED: Active Direct/Relay port")
 }
 for _,entry:=range runner.drains{
  if entry.instance.assignment.Resource.Protocol=="tcp"&&entry.instance.assignment.Resource.Port==a.Resource.Port{
   return fmt.Errorf("PORT_RESERVED: Retiring Direct/Relay port")
  }
 }
 return nil
}

// transitControllerForIntegration is NOT called by Run/poll. This hook requires
// both a valid live Runner ticket and an independent Transit Control permission.
// A current Direct/Relay ticket alone can never authorize a Transit deployment.
func (runner *Runner) transitControllerForIntegration(path string,negotiated []string,controlAuthorize func()error)(*TransitController,error){
 if controlAuthorize==nil||runner.guard==nil||runner.ticket==nil||!runner.options.Relay||
  runner.hello.SessionEpoch==0{
  return nil,fmt.Errorf("AUTHORIZATION_DENIED: No negotiated Transit Control grant or live Runner ticket")
 }
 if err:=runner.ticket.Allow();err!=nil{return nil,err}
 identity,_,err:=runner.relayIdentity()
 if err!=nil{return nil,err}
 authorize:=func()error{
  if err:=runner.ticket.Allow();err!=nil{return err}
  return controlAuthorize()
 }
 return NewTransitController(path,runner.key,runner.options.NodeID,
  runner.hello.SessionEpoch,negotiated,identity.Certificate,identity.Roots,
  authorize,runner.transitPhysicalGuard)
}
