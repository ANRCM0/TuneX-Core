export interface MySqlMigrationQuoteMode {
    readonly noBackslashEscapes?:boolean;
    readonly ansiQuotes?:boolean;
}

/** Split server statements without rewriting their SQL or executable comments.
 * Client DELIMITER scripts are outside the migration grammar. The caller supplies
 * its session quote mode; migrations do not change that mode between statements.
 */
export function mysqlMigrationStatements(sql:string,mode:MySqlMigrationQuoteMode={}):string[] {
    const statements:string[]=[];
    let start=0,hasStatement=false,lineComment=false,blockComment=false;
    let quote:"'"|'"'|'`'|undefined;
    const append=(end:number)=>{if(hasStatement)statements.push(sql.slice(start,end).trim());};
    for(let index=0;index<sql.length;index++) {
        const character=sql[index]!,next=sql[index+1];
        if(lineComment) {
            if(character==='\r'||character==='\n')lineComment=false;
            continue;
        }
        if(blockComment) {
            if(character==='*'&&next==='/'){blockComment=false;index++;}
            continue;
        }
        if(quote!==undefined) {
            const identifier=quote==='`'||quote==='"'&&mode.ansiQuotes===true;
            if(character==='\\'&&!identifier&&mode.noBackslashEscapes!==true){index++;continue;}
            if(character===quote) {
                if(next===quote)index++;
                else quote=undefined;
            }
            continue;
        }
        if(character==='#'){lineComment=true;continue;}
        if(character==='-'&&next==='-'&&/[\u0000-\u0020\u007f]/.test(sql[index+2]??'')) {
            lineComment=true;index++;continue;
        }
        if(character==='/'&&next==='*') {
            blockComment=true;
            if(sql[index+2]==='!')hasStatement=true;
            index++;continue;
        }
        if(character==="'"||character==='"'||character==='`'){quote=character;hasStatement=true;continue;}
        if(character===';'){append(index);start=index+1;hasStatement=false;continue;}
        if(!/\s/.test(character)) {
            if(!hasStatement&&/^DELIMITER(?:\s|$)/i.test(sql.slice(index,index+10)))throw new Error('UNSUPPORTED_MIGRATION_DELIMITER');
            hasStatement=true;
        }
    }
    if(quote!==undefined||blockComment)throw new Error('UNTERMINATED_MIGRATION_SQL');
    append(sql.length);
    return statements;
}
