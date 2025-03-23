const { ethers } = require('ethers');
const blockchain = require('./blockchain');
const db = require('./db');
require('dotenv').config();

// ERC20 contract creation bytecode pattern
// This is a simplified pattern - in production you might want more robust detection
const ERC20_BYTECODE_PATTERNS = [
  '0x60806040', // Common ERC20 contract creation pattern
  '0x6060604052', // Older ERC20 contracts
];

/**
 * Check if transaction input data might be a token creation
 * @param {Object} tx - Transaction object
 * @returns {boolean} True if transaction appears to be token creation
 */
function isTokenCreationTransaction(tx) {
  // Token creation transactions typically:
  // 1. Have no 'to' address (contract creation)
  // 2. Have input data that matches common ERC20 patterns
  if (!tx.to && tx.data) {
    return ERC20_BYTECODE_PATTERNS.some(pattern => 
      tx.data.toLowerCase().startsWith(pattern.toLowerCase())
    );
  }
  return false;
}

/**
 * Process a newly created token
 * @param {Object} tx - Transaction that created the token
 * @returns {Promise<void>}
 */
async function processTokenCreation(tx) {
  try {
    // Get the transaction receipt to find the contract address
    const receipt = await blockchain.getTransactionReceipt(tx.hash);
    
    if (receipt && receipt.contractAddress) {
      // Check if the created contract is actually an ERC20 token
      const isTokenContract = await isERC20Token(receipt.contractAddress);
      
      if (isTokenContract) {
        console.log(`Token creation detected at address: ${receipt.contractAddress}`);
        
        // Get token information
        const tokenInfo = await blockchain.getTokenInfo(receipt.contractAddress);
        
        // Check if this token belongs to sonicx.fun
        const isSonicXToken = await checkIfSonicXToken(receipt.contractAddress, tokenInfo, tx);
        
        if (isSonicXToken) {
          console.log(`SonicX.fun token detected: ${tokenInfo.name} (${tokenInfo.symbol})`);
          
          // Save token info
          await db.saveToken({
            ...tokenInfo,
            creationTx: tx.hash,
            creator: tx.from,
            isSonicXToken: true,
            createdAt: new Date()
          });
          
          // Save the transaction
          await db.saveTransaction({
            ...formatTransaction(tx),
            type: 'token_creation',
            contractAddress: receipt.contractAddress,
            isSonicXToken: true
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error processing potential token creation: ${tx.hash}`, error);
  }
}

/**
 * Check if a contract is an ERC20 token
 * @param {string} address - Contract address
 * @returns {Promise<boolean>} True if contract is an ERC20 token
 */
async function isERC20Token(address) {
  try {
    // Check if address has code (is a contract)
    const isContractAddress = await blockchain.isContract(address);
    if (!isContractAddress) return false;
    
    // Try to get basic ERC20 functions to verify it's a token
    const contract = new ethers.Contract(address, [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function balanceOf(address) view returns (uint256)"
    ], blockchain.provider);
    
    // Check if all required ERC20 functions exist
    // If any of these fail, it's not an ERC20 token
    await Promise.all([
      contract.name().catch(() => { throw new Error('Not an ERC20 token'); }),
      contract.symbol().catch(() => { throw new Error('Not an ERC20 token'); }),
      contract.decimals().catch(() => { throw new Error('Not an ERC20 token'); })
    ]);
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a token is related to sonicx.fun
 * @param {string} tokenAddress - Token contract address
 * @param {Object} tokenInfo - Token information
 * @param {Object} creationTx - Transaction that created the token
 * @returns {Promise<boolean>} True if token is related to sonicx.fun
 */
async function checkIfSonicXToken(tokenAddress, tokenInfo, creationTx) {
  // This function would implement specific logic to identify sonicx.fun tokens
  // Examples:
  // 1. Check if token name or symbol contains "sonicx" or "sonic"
  // 2. Check if token creator is a known sonicx.fun address
  // 3. Check contract code for specific patterns

  // For now, using a simple check based on name/symbol
  const name = tokenInfo.name.toLowerCase();
  const symbol = tokenInfo.symbol.toLowerCase();
  
  if (
    name.includes('sonicx') || 
    symbol.includes('sonicx') ||
    name.includes('sonic') || 
    symbol.includes('sonic') ||
    name.includes('sonix') || 
    symbol.includes('sonix')
  ) {
    return true;
  }
  
  // Check if creation transaction is from a known address
  const sonicxAddress = process.env.SONICX_CONTRACT_ADDRESS;
  if (sonicxAddress && creationTx.from.toLowerCase() === sonicxAddress.toLowerCase()) {
    return true;
  }
  
  return false;
}

/**
 * Format a transaction for storage
 * @param {Object} tx - Transaction object
 * @returns {Object} Formatted transaction
 */
function formatTransaction(tx) {
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    from: tx.from,
    to: tx.to || null,
    value: tx.value.toString(),
    gasUsed: tx.gasLimit?.toString(),
    gasPrice: tx.gasPrice?.toString(),
    timestamp: tx.timestamp || Date.now(),
    input: tx.data || '0x'
  };
}

/**
 * Scan a block for potential token creation transactions
 * @param {number} blockNumber - Block number to scan
 * @returns {Promise<void>}
 */
async function scanBlockForTokenCreations(blockNumber) {
  try {
    const block = await blockchain.getBlock(blockNumber);
    if (!block) return;
    
    const transactions = block.transactions || [];
    
    for (const tx of transactions) {
      // Check if it's a potential token creation transaction
      if (isTokenCreationTransaction(tx)) {
        await processTokenCreation(tx);
      }
    }
  } catch (error) {
    console.error(`Error scanning block ${blockNumber} for token creations:`, error);
  }
}

module.exports = {
  isTokenCreationTransaction,
  scanBlockForTokenCreations
}; 