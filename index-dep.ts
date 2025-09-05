// index.ts (bootstrap that delegates to /worker/index)
// keeps wrangler.jsonc -> "main": "./index.ts"

export { default } from './worker/index';


export default { fetch: Worker.fetch };