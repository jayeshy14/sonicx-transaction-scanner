# SonicX Transaction Scanner

A simple and efficient transaction scanner for tracking interactions with the SonicX.fun contract on the Sonic blockchain.

## Features

- Monitors the Sonic blockchain for transactions involving a specific contract
- Retrieves full transaction details and receipts
- Saves transaction data to MongoDB
- Tracks processed blocks to avoid duplicates
- Efficient handling of transaction batches

## Prerequisites

- Node.js (v20+)
- MongoDB (local or cloud)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/sonicx-transaction-scanner.git
   cd sonicx-transaction-scanner
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   
   Create a `.env` file with the following content:
   ```
   # Sonic blockchain RPC URL
   SONIC_RPC_URL=https://rpc.soniclabs.com
   
   # SonicX contract address to track
   SONICX_CONTRACT_ADDRESS=0x688e45f955019678d2d4a0180b4038869f1776c9
   
   # MongoDB connection
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=sonicx_scanner
   ```

## Usage

### Scan a specific block range:

```
npm run scan <startBlock> <endBlock>
```

Example:
```
npm run scan 15414000 15414100
```

### Scan the latest blocks:

```
npm run scan
```
This will scan the latest 20 blocks by default.