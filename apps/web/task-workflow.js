export function workflowSteps({ connected, overview }) {
  const count = key => Number.isSafeInteger(overview?.[key]) && overview[key] >= 0 ? overview[key] : null;
  const known = ['nodes','forwards','activeOperations'].every(key => count(key) !== null);
  const next = connected!==true || !known ? -1 : count('activeOperations') > 0 ? 3 :
    count('forwards') === 0 ? count('nodes') === 0 ? 0 : 2 : 4;
  return [
    {title:'接入机器',view:'nodes',detail:!connected?'先登录并选择工作空间。':count('nodes')===0?
      '当前可见范围没有机器记录。可以接入自己的机器，也可以先查看管理员共享的可用资源。':'已有机器记录，创建转发前确认接入凭据、Agent 报告和使用权限。'},
    {title:'选择资源',view:'available',detail:'按入口、中继、出口用途选择可用机器，确认端口和成员额度。'},
    {title:'创建转发',view:'forwards',detail:count('forwards')===0?'从一条简单转发开始：选择入口机器、监听端口和目标地址。':'可以新建转发，或在列表中编辑已有规则。'},
    {title:'确认生效',view:'operations',detail:count('activeOperations')>0?'存在尚在执行的操作，先查看部署进度；任务接收不代表已经生效。':'确认部署完成后，再核对机器报告与实际 TCP/UDP 业务结果。'},
    {title:'检查转发',view:'forwards',detail:count('failedOperations')>0?'存在历史失败记录，它不代表当前故障。先查看对应转发的最新状态和诊断。':'查看转发的应用状态，按需要进行受控探测；缺少新鲜报告时仍是未知。'},
  ].map((step,index)=>({...step,enabled:connected===true,primary:index===next,
    label:['接入自己的机器','查看共享与私有资源','新建转发','查看部署进度','查看转发状态'][index],
    action:index===0?'workflow-node-create':index===2?'workflow-forward-create':'workflow-page'}));
}

/** A finite read session. Its caller supplies visible-page GET work and response guards. */
export function createBoundedPageReads({ identity, page, visible, read, state,
  schedule = (work, ms) => setTimeout(work, ms), cancel = timer => clearTimeout(timer) }) {
  const supported = new Set(['overview','nodes','available','forwards','operations']);
  let generation=0,timer=null,controller=null,active=false,completed=0;
  function stop(reason='manual') {
    generation++;active=false;if(timer!==null)cancel(timer);timer=null;controller?.abort();controller=null;
    state({active:false,completed,reason});
  }
  async function start() {
    stop('replaced');completed=0;
    const selectedPage=page(),selectedIdentity=identity(),token=generation;
    if(!selectedIdentity||!visible()||!supported.has(selectedPage)){state({active:false,completed,reason:'unsupported'});return;}
    active=true;controller=new AbortController();const signal=controller.signal;
    const current=()=>active&&generation===token&&!signal.aborted&&identity()===selectedIdentity&&page()===selectedPage&&visible();
    async function round() {
      timer=null;
      if(!current()){if(generation===token)stop('context-changed');return;}
      try {
        await read(selectedPage,{signal,isCurrent:current});
        if(!current()){if(generation===token)stop('context-changed');return;}
        completed++;state({active:true,completed,reason:'reading'});
        if(completed>=6){stop('complete');return;}
        timer=schedule(()=>round(),10000);
      }catch(error){if(generation===token){stop(signal.aborted?'aborted':'failed');}}
    }
    state({active:true,completed,reason:'reading'});await round();
  }
  return {start,stop};
}

export function batchProgress(data) {
  if(!Array.isArray(data?.items)||data.items.length>10||!Array.isArray(data.operations)||!Array.isArray(data.attempts))
    throw Error('有界批次状态不可用。');
  const items={pending:0,accepted:0,rejected:0,cancelled:0,suspended:0};
  for(const item of data.items){if(!Object.hasOwn(items,item.state))throw Error('批次项目状态无效。');items[item.state]++;}
  const operations={accepted:0,running:0,succeeded:0,failed:0,superseded:0};
  const observed=new Set();let cleanup=0,recovery=0;
  for(const operation of data.operations){
    if(!Object.hasOwn(operations,operation.status)||observed.has(operation.operationId))throw Error('批次操作状态无效。');
    observed.add(operation.operationId);operations[operation.status]++;cleanup+=Number(operation.cleanupPending===true);recovery+=Number(operation.recoveryInvalidated===true);
  }
  const expected=new Set(data.attempts.filter(attempt=>attempt.outcome.accepted===true).map(attempt=>attempt.outcome.result.accepted.body.operationId).filter(id=>id!==null));
  const missing=[...expected].filter(id=>!observed.has(id)).length;
  const compensations=data.attempts.filter(attempt=>attempt.kind==='compensate');
  const text='项目 '+data.items.length+'：待推进 '+items.pending+'，命令接受 '+items.accepted+'，拒绝 '+items.rejected+
    '，取消 '+items.cancelled+'，挂起 '+items.suspended+'。关联 Operation：成功 '+operations.succeeded+'，失败 '+operations.failed+
    '，排队/执行中 '+(operations.accepted+operations.running)+'，被替代 '+operations.superseded+'，尚无观察 '+missing+
    '；待清理 '+cleanup+'，恢复失效 '+recovery+'。补偿尝试 '+compensations.length+'（仍须逐项核对）。这些状态不证明业务健康。';
  return {items,operations,missing,cleanup,recovery,text};
}
