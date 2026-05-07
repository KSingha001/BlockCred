const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Pin file to Pinata
router.post('/pinFile', auth, requireRole('approver'), upload.single('file'), async (req, res) => {
  try {
    console.log('Pinata upload request received');
    console.log('File received:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const PINATA_API_KEY = process.env.PINATA_API_KEY;
    const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

    console.log('Pinata API Key present:', !!PINATA_API_KEY);
    console.log('Pinata Secret Key present:', !!PINATA_SECRET_KEY);

    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.error('Pinata credentials missing from environment variables');
      return res.status(500).json({ 
        error: 'Pinata credentials not configured',
        details: 'Please set PINATA_API_KEY and PINATA_SECRET_KEY in your .env file'
      });
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Pinata metadata
    const pinataMetadata = JSON.stringify({
      name: req.file.originalname,
      keyvalues: {
        uploadedBy: req.user.email,
        uploadedAt: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', pinataMetadata);

    // Pinata options
    const pinataOptions = JSON.stringify({
      cidVersion: 1
    });
    formData.append('pinataOptions', pinataOptions);

    // Upload to Pinata
    console.log('Uploading to Pinata...');
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    console.log('Pinata upload successful:', response.data);

    const { IpfsHash, PinSize, Timestamp } = response.data;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${IpfsHash}`;

    res.json({
      success: true,
      cid: IpfsHash,
      ipfsUrl,
      size: PinSize,
      timestamp: Timestamp
    });
  } catch (error) {
    console.error('Pinata upload error:', error.response?.data || error.message);
    console.error('Full error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload to Pinata';
    let errorDetails = error.message;
    
    if (error.response?.data) {
      errorDetails = typeof error.response.data === 'object' 
        ? JSON.stringify(error.response.data)
        : error.response.data;
    }
    
    // Check for specific Pinata errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = 'Pinata authentication failed. Please check your API keys.';
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid file format or Pinata API error';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails
    });
  }
});

// Get file from IPFS
router.get('/file/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
    
    // Redirect to IPFS gateway
    res.redirect(ipfsUrl);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = router;






