const { ethers } = require('ethers');
require('dotenv').config();

async function runDiagnostics() {
  console.log('Running Sonic blockchain connection diagnostics...');
  
  try {
    // Create provider
    const rpcUrl = process.env.SONIC_RPC_URL;
    console.log(`Connecting to RPC endpoint: ${rpcUrl}`);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Check connection by getting network info
    const network = await provider.getNetwork();
    console.log('Network info:', {
      chainId: network.chainId.toString(),
      name: network.name
    });
    
    // Get latest block
    const latestBlockNumber = await provider.getBlockNumber();
    console.log(`Latest block number: ${latestBlockNumber}`);
    
    // Get a sample block with transactions
    console.log('Fetching latest block with transaction hashes...');
    const block = await provider.getBlock(latestBlockNumber);
    console.log(`Block ${latestBlockNumber} info:`, {
      hash: block.hash,
      timestamp: new Date(block.timestamp * 1000).toISOString(),
      transactionCount: block.transactions.length
    });
    
    // Get detailed transaction data
    if (block.transactions.length > 0) {
      console.log(`\nFetching detailed transaction data for block ${latestBlockNumber}...`);
      const sampleSize = Math.min(2, block.transactions.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const txHash = block.transactions[i];
        console.log(`\nTransaction ${i+1} hash: ${txHash}`);
        
        try {
          // Get transaction details
          const tx = await provider.getTransaction(txHash);
          console.log('Transaction details:', {
            from: tx.from,
            to: tx.to || 'Contract Creation',
            value: tx.value ? ethers.formatEther(tx.value) : '0',
            gasPrice: tx.gasPrice ? tx.gasPrice.toString() : 'N/A',
            gasLimit: tx.gasLimit ? tx.gasLimit.toString() : 'N/A',
          });
          
          // Get transaction receipt
          const receipt = await provider.getTransactionReceipt(txHash);
          console.log('Transaction receipt:', {
            status: receipt.status === 1 ? 'Success' : 'Failed',
            gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : 'N/A',
            blockNumber: receipt.blockNumber,
            logs: receipt.logs.length
          });
        } catch (err) {
          console.log(`Error fetching transaction details: ${err.message}`);
        }
      }
    } else {
      console.log(`Block ${latestBlockNumber} has no transactions`);
    }
    
    // Check specific contract if provided
    const contractAddress = process.env.SONICX_CONTRACT_ADDRESS;
    if (contractAddress) {
      console.log(`\nChecking contract at ${contractAddress}...`);
      const code = await provider.getCode(contractAddress);
      if (code !== '0x') {
        console.log('Contract exists and has code deployed');
        
        // Try to get contract transactions
        console.log(`Checking recent transactions involving this contract...`);
        
        // Check if this address has sent any transactions
        const blockRange = 5000;
        console.log(`Examining recent ${blockRange} blocks for transactions...`);
        
        // Sample a few blocks to check transactions
        let txFound = false;
        for (let i = 0; i < 20; i++) {
          const randomOffset = Math.floor(Math.random() * blockRange);
          const blockNum = latestBlockNumber - randomOffset;
          const randomBlock = await provider.getBlock(blockNum);
          
          if (randomBlock.transactions.length > 0) {
            for (let j = 0; j < Math.min(randomBlock.transactions.length, 5); j++) {
              const txHash = randomBlock.transactions[j];
              const tx = await provider.getTransaction(txHash);
              
              if (tx && (tx.to?.toLowerCase() === contractAddress.toLowerCase() || 
                          tx.from?.toLowerCase() === contractAddress.toLowerCase())) {
                console.log(`Found transaction involving the contract in block ${blockNum}: ${txHash}`);
                txFound = true;
                break;
              }
            }
          }
          if (txFound) break;
        }
        
        if (!txFound) {
          console.log(`No transactions involving this contract found in the sampled blocks`);
        }
        
      } else {
        console.log('Warning: No code found at this address. It might be an EOA or not exist.');
      }
    }
    
    // Get a few more blocks to check
    console.log('\nChecking transaction activity in recent blocks:');
    let blockWithTx = null;
    for (let i = 0; i < 10; i++) {
      const blockNum = latestBlockNumber - i;
      const checkBlock = await provider.getBlock(blockNum);
      console.log(`Block ${blockNum}: ${checkBlock.transactions.length} transactions`);
      
      if (checkBlock.transactions.length > 0 && !blockWithTx) {
        blockWithTx = blockNum;
      }
    }
    
    if (blockWithTx) {
      console.log(`\nExamining block ${blockWithTx} in detail...`);
      const detailedBlock = await provider.getBlock(blockWithTx);
      
      if (detailedBlock.transactions.length > 0) {
        const txHash = detailedBlock.transactions[0];
        const tx = await provider.getTransaction(txHash);
        console.log("Sample transaction:", {
          hash: txHash,
          from: tx.from,
          to: tx.to || 'Contract Creation',
          data: tx.data.substring(0, 66) + (tx.data.length > 66 ? '...' : '')
        });
      }
    }
    
    console.log('\n✅ Diagnostics completed successfully. Connection to Sonic blockchain is working.');
    
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
    console.error('Connection to Sonic blockchain may not be working properly.');
  }
}

runDiagnostics().catch(console.error); 