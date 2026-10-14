// Fail closed on fixable CRITICAL findings in two independently produced
// Trivy image-scan JSON reports. Does not claim HIGH/unknown-risk clearance.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function assess(report) {
 if(!report || !Number.isInteger(report.SchemaVersion) || !Array.isArray(report.Results))
  throw Error('Invalid or missing Trivy JSON scan result');
 const findings=report.Results.flatMap(result=>{
  if(result.Vulnerabilities===undefined)return [];
  if(!Array.isArray(result.Vulnerabilities))throw Error('Malformed vulnerability list');
  return result.Vulnerabilities;
 });
 const critical=findings.filter(v=>v?.Severity==='CRITICAL' && typeof v.FixedVersion==='string' && v.FixedVersion.length>0);
 const high=findings.filter(v=>v?.Severity==='HIGH');
 return {critical,highCount:high.length};
}

export function checkReports(paths) {
 if(paths.length!==2)throw Error('Both Control and Agent scanner reports required');
 let blocking=0;
 for(const filename of paths){
  const data=JSON.parse(readFileSync(resolve(filename),'utf8'));
  const r=assess(data);
  console.log(filename+': fixable CRITICAL='+r.critical.length+', HIGH observations='+r.highCount);
  for(const finding of r.critical.slice(0,20))console.error('Blocking finding: '+(finding.VulnerabilityID??'unknown')+' '+(finding.PkgName??'package')+' -> '+finding.FixedVersion);
  blocking+=r.critical.length;
 }
 if(blocking)throw Error('Fixable CRITICAL vulnerabilities block candidate packaging');
}

if(process.argv[1] && import.meta.url===new URL('file://'+resolve(process.argv[1])).href) {
 try{checkReports(process.argv.slice(2))}catch(err){console.error(err.message);process.exitCode=1}
}
