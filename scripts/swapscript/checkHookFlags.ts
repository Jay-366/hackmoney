
const HOOK = "0x616f70e21C74C18d525325F75b2678F8E5e700C0";

const BEFORE_INITIALIZE_FLAG = 1 << 13;
const AFTER_INITIALIZE_FLAG = 1 << 12;
const BEFORE_ADD_LIQUIDITY_FLAG = 1 << 11;
const AFTER_ADD_LIQUIDITY_FLAG = 1 << 10;
const BEFORE_REMOVE_LIQUIDITY_FLAG = 1 << 9;
const AFTER_REMOVE_LIQUIDITY_FLAG = 1 << 8;
const BEFORE_SWAP_FLAG = 1 << 7;
const AFTER_SWAP_FLAG = 1 << 6;
const BEFORE_DONATE_FLAG = 1 << 5;
const AFTER_DONATE_FLAG = 1 << 4;
const BEFORE_SWAP_RETURN_DELTA_FLAG = 1 << 3;
const AFTER_SWAP_RETURN_DELTA_FLAG = 1 << 2;
const AFTER_ADD_LIQUIDITY_RETURN_DELTA_FLAG = 1 << 1;
const AFTER_REMOVE_LIQUIDITY_RETURN_DELTA_FLAG = 1 << 0;

function checkFlags(address: string) {
    const value = parseInt(address.slice(0, 6), 16); // Take first few chars
    // Be careful with endianness/parsing.
    // Address is 160 bits. The flags are in the first 14 bits (most significant).
    // Eth address 0x1234...
    // The integer value of the address, verify bitwise AND.
    // But since JS handles bitwise on 32-bit ints, we can just parse the top 2 bytes.
    // 0x94C0 = 1001 0100 1100 0000

    // Actually, in Solidity: uint160(address) & FLAG != 0
    // 0x94 = 1001 0100
    // 0xC0 = 1100 0000

    // Let's print the binary of the first 2 bytes.
    const top2Bytes = parseInt(address.slice(2, 6), 16);
    console.log(`Address Top 2 Bytes: 0x${top2Bytes.toString(16)}`);
    console.log(`Binary: ${top2Bytes.toString(2).padStart(16, '0')}`);

    console.log("Flags:");
    if (top2Bytes & BEFORE_INITIALIZE_FLAG) console.log("- BeforeInitialize");
    if (top2Bytes & AFTER_INITIALIZE_FLAG) console.log("- AfterInitialize");
    if (top2Bytes & BEFORE_ADD_LIQUIDITY_FLAG) console.log("- BeforeAddLiquidity");
    if (top2Bytes & AFTER_ADD_LIQUIDITY_FLAG) console.log("- AfterAddLiquidity");
    if (top2Bytes & BEFORE_REMOVE_LIQUIDITY_FLAG) console.log("- BeforeRemoveLiquidity");
    if (top2Bytes & AFTER_REMOVE_LIQUIDITY_FLAG) console.log("- AfterRemoveLiquidity");
    if (top2Bytes & BEFORE_SWAP_FLAG) console.log("- BeforeSwap");
    if (top2Bytes & AFTER_SWAP_FLAG) console.log("- AfterSwap");
}

checkFlags(HOOK);
