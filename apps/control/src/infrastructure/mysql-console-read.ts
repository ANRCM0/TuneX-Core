import { ConsoleReadModels } from '../application/management-read-models.ts';
import { validateConsoleFilters } from '../application/console-query.ts';
import { nativeReadProjectionValues } from '../compatibility/public.ts';
import { MySqlManagementReadStore } from './mysql-management-read.ts';
import type { Transaction } from './mysql.ts';
import type { ConsoleReadPort, ConsolePaging, ConsoleFilters } from '../modules/console-query-owner/public.ts';

export { consolePageSql } from './mysql-read-pagination.ts';

const reader=new ConsoleReadModels(new MySqlManagementReadStore({now:nativeReadProjectionValues.now,validateFilters:validateConsoleFilters}),nativeReadProjectionValues);

/** Stateless compatibility methods keep the old class structurally substitutable. */
export class MySqlConsoleReadModels implements ConsoleReadPort<Transaction> {
    async nodes(tx:Transaction,scope:string,paging:ConsolePaging,filters:ConsoleFilters) {return reader.nodes(tx,scope,paging,filters);}
    async forwards(tx:Transaction,scope:string,paging:ConsolePaging,filters:ConsoleFilters) {return reader.forwards(tx,scope,paging,filters);}
    async operations(tx:Transaction,scope:string,paging:ConsolePaging,filters:ConsoleFilters) {return reader.operations(tx,scope,paging,filters);}
    async candidates(tx:Transaction,actor:string,scope:string,paging:ConsolePaging,filters:ConsoleFilters) {return reader.candidates(tx,actor,scope,paging,filters);}
    async overview(tx:Transaction,scope:string) {return reader.overview(tx,scope);}
    async diagnostics(tx:Transaction,scope:string,nodeId:string) {return reader.diagnostics(tx,scope,nodeId);}
}
