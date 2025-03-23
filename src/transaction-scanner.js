const { 
  getLatestBlockNumber, 
  getTransactionsForBlock,
  getTransactionReceipt
} = require('./blockchain');

const { 
  saveTransaction, 
  saveProcessedBlock 
} = require('./db');

require('dotenv').config();

/**
 * Format a transaction for storage
 */
function formatTransaction(tx) {
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    from: tx.from || 'Unknown',
    to: tx.to || null,
    value: tx.value?.toString() || '0',
    gasUsed: tx.gasLimit?.toString() || '0',
    gasPrice: tx.gasPrice?.toString() || '0',
    timestamp: tx.timestamp || Date.now(),
    input: tx.data || '0x'
  };
}

/**
 * Scan a specific block for transactions involving the target contract
 */
async function scanBlock(blockNumber) {
  console.log(`Scanning block ${blockNumber} for transactions`);

  try {
    const contractAddress = process.env.SONICX_CONTRACT_ADDRESS;
    
    // Get transactions for the block that involve our contract
    const transactions = await getTransactionsForBlock(blockNumber, contractAddress);

    let savedCount = 0;
    
    // Save all matching transactions
    for (const tx of transactions) {
      if (!tx || !tx.hash) {
        continue;
      }
      
      // Get receipt for additional data
      let receipt;
      try {
        receipt = await getTransactionReceipt(tx.hash);
      } catch (error) {
        console.error(`Failed to get receipt for ${tx.hash}:`, error.message);
      }
      
      // Prepare transaction data with fallbacks for missing fields
      const transactionData = {
        hash: tx.hash,
        blockNumber: tx.blockNumber || blockNumber,
        timestamp: tx.timestamp || new Date().toISOString(),
        from: tx.from || 'Unknown',
        to: tx.to || 'Contract Creation',
        value: tx.value ? tx.value.toString() : "0",
        gasUsed: receipt?.gasUsed?.toString() || tx.gasLimit?.toString() || "0",
        gasPrice: tx.gasPrice ? tx.gasPrice.toString() : "0",
        data: tx.data || tx.input || '0x',
        status: receipt ? (receipt.status ? 'success' : 'failed') : 'unknown',
        transactionType: "contract_interaction"
      };
      
      try {
        const saved = await saveTransaction(transactionData);
        if (saved) {
          savedCount++;
        }
      } catch (error) {
        console.error(`Failed to save transaction ${tx.hash}:`, error);
      }
    }

    // Mark block as processed
    await saveProcessedBlock(blockNumber);
    
    console.log(`Block ${blockNumber} processed. Found ${transactions.length} transactions, saved ${savedCount} new transactions.`);
    return transactions.length;
  } catch (error) {
    console.error(`Error scanning block ${blockNumber}:`, error);
    return 0;
  }
}

module.exports = {
  scanBlock
}; 