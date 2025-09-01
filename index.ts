// index.ts (bootstrap that delegates to /worker/index)
// keeps wrangler.jsonc -> "main": "./index.ts"
export { default as default } from "./worker/index";
