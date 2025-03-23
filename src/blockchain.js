const { ethers } = require('ethers');
require('dotenv').config();

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.SONIC_RPC_URL);

/**
 * Get the latest block number from the blockchain
 */
async function getLatestBlockNumber() {
  return await provider.getBlockNumber();
}

/**
 * Get a block by its number
 */
async function getBlock(blockNumber, includeTransactions = true) {
  try {
    const block = await provider.getBlock(blockNumber, includeTransactions);
    if (block && includeTransactions && block.transactions.length > 0) {
      if (typeof block.transactions[0] === 'string') {
        // If we only got hashes, fetch the full transactions
        const fullTransactions = [];
        for (const txHash of block.transactions) {
          try {
            const tx = await getTransaction(txHash);
            if (tx) {
              tx.blockNumber = blockNumber;
              fullTransactions.push(tx);
            }
          } catch (err) {
            console.error(`Error fetching transaction ${txHash}:`, err.message);
          }
        }
        block.transactions = fullTransactions;

      }
    }
    return block;
  } catch (err) {
    console.error(`Failed to get block ${blockNumber}:`, err);
    return null;
  }
}

/**
 * Get transaction details
 */
async function getTransaction(txHash) {
  return await provider.getTransaction(txHash);
}

/**
 * Get transaction receipt
 */
async function getTransactionReceipt(txHash) {
  return await provider.getTransactionReceipt(txHash);
}

/**
 * Get all transactions in a given block
 */
async function getBlockTransactions(blockNumber) {
  const block = await getBlock(blockNumber);
  if (!block) {
    return [];
  }
  
  return block.transactions || [];
}

/**
 * Check if a transaction interacts with a specific contract address
 */
async function isContractTransaction(transaction, contractAddress) {
  if (!transaction || !transaction.hash) {
    return false;
  }

  // Normalize addresses for comparison
  const normalizedContractAddr = contractAddress.toLowerCase();
  const txTo = transaction.to ? transaction.to.toLowerCase() : null;
  const txFrom = transaction.from ? transaction.from.toLowerCase() : null;
  
  // Direct contract interaction
  if (txTo === normalizedContractAddr || txFrom === normalizedContractAddr) {
    return true;
  }
  
  // Check logs for contract interaction
  try {
    const receipt = await getTransactionReceipt(transaction.hash);
    
    if (receipt && receipt.logs && receipt.logs.length > 0) {
      for (const log of receipt.logs) {
        const logAddress = log.address ? log.address.toLowerCase() : null;
        
        if (logAddress === normalizedContractAddr) {
          return true;
        }
      }
    }
    
    return false;
  } catch (err) {
    console.error(`Error checking transaction ${transaction.hash}:`, err.message);
    return false;
  }
}

/**
 * Filter transactions that interact with a specific contract
 */
async function filterContractTransactions(transactions, contractAddress) {
  if (!contractAddress) {
    return transactions;
  }
  
  const normalizedContractAddr = contractAddress.toLowerCase();
  const results = [];
  
  for (let i = 0; i < transactions.length; i++) {
    let tx = transactions[i];
    
    // If tx is a string (hash), fetch the full transaction object
    if (typeof tx === 'string') {
      tx = await getTransaction(tx);
      if (!tx) {
        continue;
      }
    }
    
    if (!tx || !tx.hash) {
      continue;
    }
    
    // Quick check for direct interaction
    const txTo = tx.to ? tx.to.toLowerCase() : null;
    const txFrom = tx.from ? tx.from.toLowerCase() : null;
    
    if (txTo === normalizedContractAddr || txFrom === normalizedContractAddr) {
      results.push(tx);
      continue;
    }
    
    // Check receipt logs for indirect interaction
    try {
      const isInvolved = await isContractTransaction(tx, contractAddress);
      if (isInvolved) {
        results.push(tx);
      }
    } catch (error) {
      console.error(`Error checking transaction ${tx.hash}:`, error.message);
    }
  }
  
  return results;
}

/**
 * Get transactions for a specific block that involve the contract
 */
async function getTransactionsForBlock(blockNumber, contractAddress) {
  try {
    const block = await getBlock(blockNumber, true);
    if (!block) {
      return [];
    }
    
    const transactions = Array.isArray(block.transactions) ? block.transactions : [];
    if (!contractAddress) {
      return transactions;
    }
    
    return await filterContractTransactions(transactions, contractAddress);
  } catch (err) {
    console.error(`Failed to get transactions for block ${blockNumber}:`, err);
    return [];
  }
}

module.exports = {
  provider,
  getLatestBlockNumber,
  getBlock,
  getTransaction,
  getTransactionReceipt,
  getBlockTransactions,
  isContractTransaction,
  filterContractTransactions,
  getTransactionsForBlock
}; 