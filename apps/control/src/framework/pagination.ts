import { invalid } from './errors.ts';

export function pageWindow(pageText:string|undefined,limitText:string|undefined):{page:number;limit:number;offset:number} {
    const numeric=(value:string|undefined,fallback:number,maximum:number)=>{
        if(value===undefined)return fallback;
        if(!/^[1-9][0-9]*$/.test(value)||Number(value)>maximum)invalid('Invalid pagination parameter');
        return Number(value);
    };
    const page=numeric(pageText,1,10000),limit=numeric(limitText,25,100);
    return {page,limit,offset:(page-1)*limit};
}
