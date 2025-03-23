const { getLatestBlockNumber } = require('./blockchain');
const { scanBlock } = require('./transaction-scanner');
const { connectToMongoDB, disconnectFromMongoDB, isBlockProcessed } = require('./db');
require('dotenv').config();

// Default range of blocks to scan if not specified
const DEFAULT_BLOCKS_TO_SCAN = 20;

/**
 * Scan a range of blocks for transactions involving the sonicx.fun contract
 */
async function scanBlocks(startBlock, endBlock) {
  console.log(`Starting scan from block ${startBlock} to ${endBlock}`);

  try {
    // Connect to MongoDB before scanning
    await connectToMongoDB();
    
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
      // Check if block was already processed to avoid duplicate work
      const processed = await isBlockProcessed(blockNumber);
      if (processed) {
        console.log(`Block ${blockNumber} already processed, skipping`);
        continue;
      }
      
      // Scan the block for transactions
      await scanBlock(blockNumber);
    }
    
    console.log(`Scan completed from block ${startBlock} to ${endBlock}`);
  } catch (error) {
    console.error('Error during block scanning:', error);
  } finally {
    // Always disconnect from MongoDB when done
    await disconnectFromMongoDB();
  }
}

/**
 * Main function to start the scanner
 */
async function main() {
  try {
    // Get command line arguments for start and end blocks
    const args = process.argv.slice(2);
    let startBlock, endBlock;
    
    if (args.length >= 2) {
      startBlock = parseInt(args[0]);
      endBlock = parseInt(args[1]);
    } else {
      // If no args provided, scan the latest blocks
      const latestBlock = await getLatestBlockNumber();
      endBlock = latestBlock;
      startBlock = Math.max(1, endBlock - DEFAULT_BLOCKS_TO_SCAN);
    }
    
    if (isNaN(startBlock) || isNaN(endBlock) || startBlock < 0 || endBlock < startBlock) {
      console.error('Invalid block range. Usage: npm run scan [startBlock] [endBlock]');
      process.exit(1);
    }
    
    await scanBlocks(startBlock, endBlock);
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Handle termination signals
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await disconnectFromMongoDB();
  process.exit(0);
});

// Start scanning
main().catch(console.error); 