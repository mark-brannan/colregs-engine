import { FACT_SPEC } from "./src/generated/fact-record.js";
const S = FACT_SPEC as unknown as Record<string, readonly string[]>;
const keys = Object.keys(S);
console.log("axes:", keys.length);
let n = 1;
for (const k of keys) n *= S[k].length;
console.log("product:", n);
console.log("length_m:", JSON.stringify(S["fact:length_m"]));
console.log("position:", JSON.stringify(S["fact:position"]));
