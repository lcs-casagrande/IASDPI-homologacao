import {createPasswordHandler} from './handler.mjs';
Deno.serve(createPasswordHandler({readEnv:(name:string)=>Deno.env.get(name)}));
