import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assess} from '../verify-trivy.mjs';
test('reject malformed Trivy output rather than treating as no vulnerabilities',()=>{
 assert.throws(()=>assess(null),/Invalid/);
 assert.throws(()=>assess({Results:[]}),/Invalid/);
 assert.throws(()=>assess({SchemaVersion:2,Results:[{Vulnerabilities:null}]}),/Malformed/);
});
test('fail-closed inventory distinguishes fixable critical and advisory high',()=>{
 const r=assess({SchemaVersion:2,Results:[{Vulnerabilities:[
  {Severity:'HIGH',VulnerabilityID:'CVE-H',FixedVersion:'1'},
  {Severity:'CRITICAL',VulnerabilityID:'CVE-C',PkgName:'perl-base',FixedVersion:'5.36.0-7+deb12u4'},
  {Severity:'CRITICAL',VulnerabilityID:'CVE-U',FixedVersion:''}
 ]}]});
 assert.equal(r.critical.length,1);
 assert.equal(r.highCount,1);
 assert.equal(r.critical[0].VulnerabilityID,'CVE-C');
});
test('valid empty scanner results do not fabricate findings',()=>assert.deepEqual(assess({SchemaVersion:2,Results:[]}),{critical:[],highCount:0}));
