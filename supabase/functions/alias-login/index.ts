import {createAliasLoginHandler} from './handler.mjs';
Deno.serve(createAliasLoginHandler({readEnv:(name:string)=>Deno.env.get(name)}));
