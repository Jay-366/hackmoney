
import { V4_BASE_ACTIONS_ABI_DEFINITION, Actions } from '@uniswap/v4-sdk';

console.log("SETTLE params:", JSON.stringify(V4_BASE_ACTIONS_ABI_DEFINITION[Actions.SETTLE], null, 2));
console.log("TAKE params:", JSON.stringify(V4_BASE_ACTIONS_ABI_DEFINITION[Actions.TAKE], null, 2));
console.log("TAKE_ALL params:", JSON.stringify(V4_BASE_ACTIONS_ABI_DEFINITION[Actions.TAKE_ALL], null, 2));
