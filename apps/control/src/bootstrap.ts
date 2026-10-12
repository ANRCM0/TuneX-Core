import { MySqlUnitOfWork } from './infrastructure/mysql.ts';
import { Identity } from './modules/identity.ts';
const [scope,actor]=process.argv.slice(2);const url=process.env.DATABASE_URL,token=process.env.TUNEX_OWNER_TOKEN;
if(!scope||!actor||!url||!token)throw new Error('DATABASE_URL, TUNEX_OWNER_TOKEN and scope/actor arguments required');
const db=new MySqlUnitOfWork(url);
try{await db.migrate();await new Identity(db).bootstrap(scope,actor,token);console.log(`Created owner ${actor} in scope ${scope}`);}finally{await db.close();}
