const express = require('express');
const { ethers } = require('ethers');
const Record = require('../models/Record');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get transaction status
router.get('/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    
    if (!process.env.SEPOLIA_RPC_URL) {
      return res.status(500).json({ error: 'RPC URL not configured' });
    }

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    
    res.json({
      txHash,
      status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
      blockNumber: receipt?.blockNumber || null,
      gasUsed: receipt?.gasUsed?.toString() || null,
      from: tx.from,
      to: tx.to
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction status' });
  }
});

// Prepare transaction data (for client-side signing)
router.post('/prepare', auth, requireRole('college', 'admin'), async (req, res) => {
  try {
    const { usn, name, program, cid } = req.body;

    if (!usn || !name || !program || !cid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({ error: 'Contract address not configured' });
    }

    // Contract ABI (minimal for uploadRecord)
    const contractABI = [
      "function uploadRecord(string calldata usn, string calldata name, string calldata program, string calldata cid) external"
    ];

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);

    // Encode function call
    const iface = new ethers.Interface(contractABI);
    const data = iface.encodeFunctionData('uploadRecord', [usn, name, program, cid]);

    // Get gas estimate
    const gasEstimate = await contract.uploadRecord.estimateGas(usn, name, program, cid);

    res.json({
      to: process.env.CONTRACT_ADDRESS,
      data,
      gasLimit: gasEstimate.toString(),
      functionName: 'uploadRecord',
      params: { usn, name, program, cid }
    });
  } catch (error) {
    console.error('Prepare transaction error:', error);
    res.status(500).json({ 
      error: 'Failed to prepare transaction',
      details: error.message
    });
  }
});

// Prepare verify transaction
router.post('/prepare-verify', auth, requireRole('admin'), async (req, res) => {
  try {
    const { usn } = req.body;

    if (!usn) {
      return res.status(400).json({ error: 'USN required' });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({ error: 'Contract address not configured' });
    }

    const contractABI = [
      "function verifyRecord(string calldata usn) external"
    ];

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);

    const iface = new ethers.Interface(contractABI);
    const data = iface.encodeFunctionData('verifyRecord', [usn]);

    const gasEstimate = await contract.verifyRecord.estimateGas(usn);

    res.json({
      to: process.env.CONTRACT_ADDRESS,
      data,
      gasLimit: gasEstimate.toString(),
      functionName: 'verifyRecord',
      params: { usn }
    });
  } catch (error) {
    console.error('Prepare verify transaction error:', error);
    res.status(500).json({ 
      error: 'Failed to prepare verify transaction',
      details: error.message
    });
  }
});

// Get contract address and ABI
router.get('/contract/info', async (req, res) => {
  try {
    if (!process.env.CONTRACT_ADDRESS) {
      console.error('CONTRACT_ADDRESS is not configured');
      return res.status(500).json({ 
        error: 'Contract address not configured',
        message: 'Please configure CONTRACT_ADDRESS in your environment variables'
      });
    }

    // Return minimal ABI needed for frontend
    const minimalABI = [
      "function uploadRecord(string calldata usn, string calldata name, string calldata program, string calldata cid) external",
      "function verifyRecord(string calldata usn) external",
      "function getRecord(string calldata usn) external view returns (tuple(string usn, string name, string program, string cid, uint256 timestamp, address uploader, bool verified))",
      "function getRecordCount() external view returns (uint256)",
      "function getRecordHashAtIndex(uint256 index) external view returns (bytes32)",
      "function getRecordByHash(bytes32 usnHash) external view returns (tuple(string usn, string name, string program, string cid, uint256 timestamp, address uploader, bool verified))",
      "function hasRole(bytes32 role, address account) external view returns (bool)",
      "function UPLOADER_ROLE() external view returns (bytes32)",
      "event RecordUploaded(string indexed usn, string cid, address indexed uploader, uint256 timestamp)",
      "event RecordVerified(string indexed usn, address indexed verifier, uint256 timestamp)"
    ];

    res.json({
      address: process.env.CONTRACT_ADDRESS,
      abi: minimalABI,
      network: 'sepolia'
    });
  } catch (error) {
    console.error('Contract info error:', error);
    const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch contract info';
    res.status(500).json({ error: 'Failed to fetch contract info', details: errorMessage });
  }
});

// Get on-chain records from blockchain (for syncing/viewing)
router.get('/onchain/records', async (req, res) => {
  try {
    const Record = require('../models/Record');

    if (!process.env.CONTRACT_ADDRESS || !process.env.SEPOLIA_RPC_URL) {
      return res.status(500).json({ error: 'Contract or RPC URL not configured' });
    }

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const abi = [
      "function getRecordCount() external view returns (uint256)",
      "function getRecordHashAtIndex(uint256 index) external view returns (bytes32)",
      "function getRecordByHash(bytes32 usnHash) external view returns (tuple(string usn, string name, string program, string cid, uint256 timestamp, address uploader, bool verified))"
    ];

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);

    // Get total count of records on-chain
    const count = await contract.getRecordCount();
    const countNum = Number(count); // Convert BigInt to number
    const onchainRecords = [];

    // Fetch each record from blockchain
    for (let i = 0; i < Math.min(countNum, 100); i++) { // Limit to 100 to avoid overload
      try {
        const hash = await contract.getRecordHashAtIndex(i);
        const record = await contract.getRecordByHash(hash);
        
        // Check if this record exists in DB
        let dbRecord = await Record.findOne({ usn: record.usn });
        
        onchainRecords.push({
          usn: record.usn,
          name: record.name,
          program: record.program,
          cid: record.cid,
          timestamp: record.timestamp.toString(),
          uploader: record.uploader,
          verified: record.verified,
          onchain: true,
          inDb: !!dbRecord,
          dbStatus: dbRecord?.status || null
        });
      } catch (error) {
        console.error(`Failed to fetch record ${i}:`, error);
      }
    }

    res.json({
      totalOnchain: count.toString(),
      records: onchainRecords
    });
  } catch (error) {
    console.error('Onchain records error:', error);
    res.status(500).json({ error: 'Failed to fetch on-chain records', details: error.message });
  }
});

// Employer: View on-chain records (supports verified-only or all)
router.get('/employer/verified-records', auth, requireRole('employer'), async (req, res) => {
  try {
    const { search, includeUnverified, limit, offset } = req.query;

    if (!process.env.CONTRACT_ADDRESS || !process.env.SEPOLIA_RPC_URL) {
      return res.status(500).json({ error: 'Contract or RPC URL not configured' });
    }

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const abi = [
      "function getRecordCount() external view returns (uint256)",
      "function getRecordHashAtIndex(uint256 index) external view returns (bytes32)",
      "function getRecordByHash(bytes32 usnHash) external view returns (tuple(string usn, string name, string program, string cid, uint256 timestamp, address uploader, bool verified))"
    ];

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, provider);

    // Get total count of records on-chain
    const count = await contract.getRecordCount();
    const countNum = Number(count);

    // Pagination controls (default: fetch all)
    const pageOffset = Math.max(0, parseInt(offset ?? '0', 10));
    const pageLimit = limit ? Math.max(1, Math.min(parseInt(limit, 10), 5000)) : countNum;

    const startIndex = pageOffset;
    const endIndex = Math.min(countNum, startIndex + pageLimit);

    let verifiedRecords = [];

    // Fetch records from blockchain within requested range
    for (let i = startIndex; i < endIndex; i++) {
      try {
        const hash = await contract.getRecordHashAtIndex(i);
        const record = await contract.getRecordByHash(hash);
        
        // If includeUnverified=true, include all; else include only verified
        if (record.verified || String(includeUnverified).toLowerCase() === 'true') {
          // Filter by search if provided
          if (search) {
            const searchLower = search.toLowerCase();
            const matches = 
              record.usn.toLowerCase().includes(searchLower) ||
              record.name.toLowerCase().includes(searchLower) ||
              record.program.toLowerCase().includes(searchLower);
            if (!matches) continue;
          }

          // Get txHash from database - check any record with this USN
          const dbRecord = await Record.findOne({ usn: record.usn });
          console.log(`[DEBUG] USN: ${record.usn}, DB Record Found: ${!!dbRecord}, txHash: ${dbRecord?.txHash}`);

          verifiedRecords.push({
            usn: record.usn,
            name: record.name,
            program: record.program,
            cid: record.cid,
            ipfsUrl: `https://gateway.pinata.cloud/ipfs/${record.cid}`,
            txHash: dbRecord?.txHash || null,
            timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
            uploader: record.uploader,
            verified: record.verified
          });
        }
      } catch (error) {
        console.error(`Failed to fetch record ${i}:`, error);
      }
    }

    res.json({
      totalOnChain: countNum,
      page: {
        offset: pageOffset,
        limit: pageLimit,
        endIndex
      },
      records: verifiedRecords
    });
  } catch (error) {
    console.error('Employer verified records error:', error);
    res.status(500).json({ error: 'Failed to fetch verified records', details: error.message });
  }
});

module.exports = router;



