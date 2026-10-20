import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import { createConnection, createPool } from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import ts from 'typescript';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { mysqlMigrationStatements } from '../src/infrastructure/mysql-migration-statements.ts';
import { readStoredValue } from '../src/compatibility/public.ts';

const sourceURL=new URL('../src/infrastructure/mysql.ts',import.meta.url);
const source=(await readFile(sourceURL,'utf8')).replaceAll('import.meta.url','__originalModuleURL');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
function nativeClass(poolFactory:typeof createPool,files:{readdir:()=>Promise<string[]>;readFile:(url:URL,encoding:string)=>Promise<string>}){
    const exports:{MySqlUnitOfWork?:typeof MySqlUnitOfWork}={};
    new vm.Script(javascript,{filename:'original-mysql-native-complete.cjs'}).runInContext(vm.createContext({exports,URL,Set,__originalModuleURL:sourceURL.href,
        require(name:string){
            if(name==='mysql2/promise')return {createPool:poolFactory};
            if(name==='node:fs/promises')return files;
            if(name==='./mysql-migration-statements.ts')return {mysqlMigrationStatements};
            if(name==='../compatibility/public.ts')return {readStoredValue};
            throw new Error('unexpected original MySQL dependency '+name);
        }}));
    assert.ok(exports.MySqlUnitOfWork);return exports.MySqlUnitOfWork;
}

test('155 original MySQL constructor passes exactly five native pool options and helpers retain results receivers and default args',async()=>{
    const captured:unknown[]=[],pool={} as Pool;
    const Original=nativeClass(((options:unknown)=>{captured.push(options);return pool;}) as typeof createPool,
        {async readdir(){return assert.fail('constructor filesystem I/O');},async readFile(){return assert.fail('constructor filesystem I/O');}});
    const db=new Original('mysql://example/original');assert.equal(db.pool,pool);
    assert.deepEqual(JSON.parse(JSON.stringify(captured)),[{uri:'mysql://example/original',connectionLimit:8,supportBigNumbers:true,bigNumberStrings:false,timezone:'Z'}]);
    const raw=[{raw:Symbol('driver row')}],calls:unknown[][]=[];
    const tx={async execute(sql:string,args:unknown[]){assert.equal(this,tx);calls.push([sql,args]);return [sql==='read'?raw:{affectedRows:0},[]];}} as unknown as PoolConnection;
    assert.equal(await rows(tx,'read'),raw);assert.equal(await write(tx,'write'),0);
    assert.deepEqual(calls,[['read',[]],['write',[]]]);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function database(action:(url:string,admin:Awaited<ReturnType<typeof createConnection>>)=>Promise<void>){
    const admin=await createConnection(databaseURL!),name='tunex_mysql_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;
    let created=false;
    try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await action(url.toString(),admin);}
    finally{try{if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
}
const lockSQL="SELECT GET_LOCK(CONCAT('tunex:migrate:',LEFT(SHA2(DATABASE(),256),48)),0) acquired";
const unlockSQL="SELECT RELEASE_LOCK(CONCAT('tunex:migrate:',LEFT(SHA2(DATABASE(),256),48))) released";

test('155 real MySQL migration owns the database advisory lock through file work and releases it before returning',
    {skip:!databaseURL,timeout:60000},async()=>database(async url=>{
        const competitor=await createConnection(url);let scanned=0;
        const Original=nativeClass(createPool,{async readdir(){
            scanned++;const [result]=await competitor.query<RowDataPacket[]>(lockSQL);assert.equal(result[0]!.acquired,0);return [];
        },async readFile(){return assert.fail('no migration files');}});
        const db=new Original(url);
        try{await db.migrate();assert.equal(scanned,1);
            const [acquired]=await competitor.query<RowDataPacket[]>(lockSQL);assert.equal(acquired[0]!.acquired,1);
            const [released]=await competitor.query<RowDataPacket[]>(unlockSQL);assert.equal(released[0]!.released,1);
        }finally{await db.close();await competitor.end();}
    }));

test('155 real MySQL partial DDL persists without a migration marker and retry resumes under the same migration lock',
    {skip:!databaseURL,timeout:60000},async()=>database(async url=>{
        let repaired=false,reads=0;
        const Original=nativeClass(createPool,{async readdir(){return ['9999-ignored.txt','9998-after.sql','9997-partial.sql'];},async readFile(file,encoding){
            assert.equal(encoding,'utf8');reads++;
            if(file.pathname.endsWith('9997-partial.sql'))return 'CREATE TABLE IF NOT EXISTS original_ddl(id INT PRIMARY KEY);'+
                (repaired?'INSERT INTO original_ddl(id) VALUES(1);':'THIS_IS_INVALID_MYSQL;')+'CREATE TABLE after_ddl(id INT);';
            assert.ok(file.pathname.endsWith('9998-after.sql'));return 'CREATE TABLE next_migration(id INT);';
        }});
        const db=new Original(url);
        try{
            await assert.rejects(db.migrate(),{code:'ER_PARSE_ERROR'});assert.equal(reads,1);
            const names=()=>rows<RowDataPacket>(db.pool,"SELECT table_name name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name");
            assert.deepEqual((await names()).map(row=>row.name),['original_ddl','vnext_migrations']);
            assert.deepEqual(await rows(db.pool,'SELECT name FROM vnext_migrations'),[]);
            repaired=true;await db.migrate();assert.equal(reads,3);
            assert.deepEqual((await rows<RowDataPacket>(db.pool,'SELECT name FROM vnext_migrations ORDER BY name')).map(row=>row.name),['9997-partial.sql','9998-after.sql']);
            assert.deepEqual((await names()).map(row=>row.name),['after_ddl','next_migration','original_ddl','vnext_migrations']);
            assert.equal((await rows<RowDataPacket>(db.pool,'SELECT COUNT(*) n FROM original_ddl'))[0]!.n,1);
            await db.migrate();assert.equal(reads,3);
        }finally{await db.close();}
    }));

test('155 real MySQL commit outcomes remain distinct when the driver rejects before commit or loses its successful reply',
    {skip:!databaseURL,timeout:60000},async()=>database(async url=>{
        const actual=new MySqlUnitOfWork(url);
        try{
            await actual.pool.query('CREATE TABLE original_commit(id VARCHAR(16) PRIMARY KEY)');
            for(const durable of [false,true]){
                const error=Object.assign(new Error('commit outcome unknown'),{code:'PROTOCOL_CONNECTION_LOST'}),trace:string[]=[];
                let actions=0;
                const pool=new Proxy(actual.pool,{get(target,key){
                    if(key==='getConnection')return async()=>{
                        trace.push('acquire');const native=await target.getConnection();
                        return new Proxy(native,{get(connection,member){
                            if(member==='commit')return async()=>{trace.push('commit');if(durable)await connection.commit();throw error;};
                            if(member==='rollback')return async()=>{trace.push('rollback');return connection.rollback();};
                            if(member==='release')return ()=>{trace.push('release');return connection.release();};
                            const value=Reflect.get(connection,member,connection);return typeof value==='function'?value.bind(connection):value;
                        }});
                    };
                    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
                }});
                const db=Object.create(MySqlUnitOfWork.prototype) as MySqlUnitOfWork;Object.defineProperty(db,'pool',{value:pool});
                await assert.rejects(db.transaction(async tx=>{
                    actions++;
                    await write(tx,'INSERT INTO original_commit(id) VALUES(?)',[durable?'durable':'rolled-back']);return {accepted:true};
                }),failure=>failure===error);
                assert.equal(actions,1);assert.deepEqual(trace,['acquire','commit','rollback','release']);
                assert.equal((await rows<RowDataPacket>(actual.pool,'SELECT COUNT(*) n FROM original_commit WHERE id=?',[durable?'durable':'rolled-back']))[0]!.n,durable?1:0);
            }
        }finally{await actual.close();}
    }));
