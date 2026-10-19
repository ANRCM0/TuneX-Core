export const CONTROL_CLIENT_COMMAND_INTERFACE_VERSION=1 as const;

export interface ControlClientEffects<Url,Bytes> {
    arguments():string[];
    env(name:string):string|undefined;
    readText(path:string):Promise<string>;
    readBytes(path:string):Promise<Bytes>;
    parseJson(text:string):unknown;
    stringify(value:unknown,replacer?:null,space?:number):string|undefined;
    encodeComponent(value:string):string;
    url(path:string,base:string):Url;
    request(url:Url,method:string,ca:Bytes,token:string,requestKey:string|undefined,body:string|undefined):Promise<string>;
    log(message:string|undefined):void;
}
