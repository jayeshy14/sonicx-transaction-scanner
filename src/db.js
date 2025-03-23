const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection
let client = null;
let db = null;

// Collection names
const TRANSACTIONS_COLLECTION = 'transactions';
const PROCESSED_BLOCKS_COLLECTION = 'processed_blocks';

/**
 * Connect to MongoDB
 */
async function connectToMongoDB() {
  if (client) {
    console.log("MongoDB client already connected");
    return db;
  }

  try {
    console.log("Connecting to MongoDB...");
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    await client.connect();
    
    const dbName = process.env.MONGODB_DB_NAME || 'sonicx_scanner';
    db = client.db(dbName);
    
    console.log("Connected to MongoDB successfully");
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectFromMongoDB() {
  if (client) {
    console.log("Closing MongoDB connection...");
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * Save a transaction to the database
 * Returns true if saved as new, false if already exists
 */
async function saveTransaction(transaction) {
  if (!db) await connectToMongoDB();
  
  // Check if the transaction already exists
  const collection = db.collection(TRANSACTIONS_COLLECTION);
  const existing = await collection.findOne({ hash: transaction.hash });
  
  if (existing) {
    return false;
  }
  
  // Save the transaction
  await collection.insertOne({
    ...transaction,
    createdAt: new Date()
  });
  
  return true;
}

/**
 * Mark a block as processed
 */
async function saveProcessedBlock(blockNumber) {
  if (!db) await connectToMongoDB();
  
  const collection = db.collection(PROCESSED_BLOCKS_COLLECTION);
  
  // Use upsert to handle both new inserts and updates
  const result = await collection.updateOne(
    { blockNumber },
    { $set: { blockNumber, processedAt: new Date() } },
    { upsert: true }
  );
  
  return {
    success: true,
    modified: result.modifiedCount,
    upserted: result.upsertedCount > 0
  };
}

/**
 * Check if a block has been processed
 */
async function isBlockProcessed(blockNumber) {
  if (!db) await connectToMongoDB();
  
  const collection = db.collection(PROCESSED_BLOCKS_COLLECTION);
  const result = await collection.findOne({ blockNumber });
  
  return !!result;
}

/**
 * Get the last processed block number
 */
async function getLastProcessedBlock() {
  if (!db) await connectToMongoDB();
  
  const collection = db.collection(PROCESSED_BLOCKS_COLLECTION);
  const lastBlock = await collection.find()
    .sort({ blockNumber: -1 })
    .limit(1)
    .toArray();
  
  return lastBlock.length > 0 ? lastBlock[0].blockNumber : 0;
}

module.exports = {
  connectToMongoDB,
  disconnectFromMongoDB,
  saveTransaction,
  saveProcessedBlock,
  isBlockProcessed,
  getLastProcessedBlock
}; 