const express = require('express');
const multer = require('multer');
const Record = require('../models/Record');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large', details: 'Maximum file size is 10MB' });
    }
    return res.status(400).json({ error: 'File upload error', details: err.message });
  }
  if (err) {
    return res.status(400).json({ error: 'Upload error', details: err.message });
  }
  next();
};

// Uploader: Create record (store in MongoDB only, status: DRAFT) with PDF
router.post('/create', auth, requireRole('uploader'), upload.single('pdfFile'), handleMulterError, async (req, res) => {
  try {
    console.log('Create record request received');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Body:', req.body);
    console.log('Body values:', {
      usn: req.body?.usn,
      name: req.body?.name,
      year: req.body?.year,
      dept: req.body?.dept,
      marks: req.body?.marks,
      program: req.body?.program
    });
    console.log('File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    
    // Get fields from req.body (multer parses multipart/form-data)
    const usn = req.body?.usn;
    const name = req.body?.name;
    const year = req.body?.year;
    const dept = req.body?.dept;
    const marks = req.body?.marks;
    const program = req.body?.program;

    // Check each field individually for better error messages
    const missingFields = [];
    if (!usn || usn.trim() === '') missingFields.push('usn');
    if (!name || name.trim() === '') missingFields.push('name');
    if (!year || year.trim() === '') missingFields.push('year');
    if (!dept || dept.trim() === '') missingFields.push('dept');
    if (!marks || marks.trim() === '') missingFields.push('marks');
    if (!program || program.trim() === '') missingFields.push('program');

    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      console.log('Received values:', { usn, name, year, dept, marks, program });
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: `Missing: ${missingFields.join(', ')}`,
        received: { usn: !!usn, name: !!name, year: !!year, dept: !!dept, marks: !!marks, program: !!program }
      });
    }

    if (!req.file) {
      console.log('No PDF file received');
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Check if record already exists
    const existingRecord = await Record.findOne({ usn });
    if (existingRecord && existingRecord.status !== 'NEEDS_EDIT') {
      return res.status(400).json({ error: 'Record with this USN already exists' });
    }

    // If record exists with NEEDS_EDIT status, update it
    if (existingRecord && existingRecord.status === 'NEEDS_EDIT') {
      existingRecord.name = name;
      existingRecord.year = year;
      existingRecord.dept = dept;
      existingRecord.marks = marks;
      existingRecord.program = program;
      existingRecord.pdfFile = req.file.buffer;
      existingRecord.pdfFileName = req.file.originalname;
      existingRecord.status = 'DRAFT';
      existingRecord.editNotes = null;
      await existingRecord.save();

      return res.status(200).json({
        message: 'Record updated successfully',
        record: {
          _id: existingRecord._id,
          usn: existingRecord.usn,
          name: existingRecord.name,
          year: existingRecord.year,
          dept: existingRecord.dept,
          marks: existingRecord.marks,
          program: existingRecord.program,
          pdfFileName: existingRecord.pdfFileName,
          status: existingRecord.status
        }
      });
    }

    const record = new Record({
      usn,
      name,
      year,
      dept,
      marks,
      program,
      pdfFile: req.file.buffer,
      pdfFileName: req.file.originalname,
      uploader: req.user._id,
      status: 'DRAFT'
    });

    await record.save();

    res.status(201).json({
      message: 'Record created successfully',
      record: {
        _id: record._id,
        usn: record.usn,
        name: record.name,
        year: record.year,
        dept: record.dept,
        marks: record.marks,
        program: record.program,
        pdfFileName: record.pdfFileName,
        status: record.status
      }
    });
  } catch (error) {
    console.error('Record creation error:', error);
    res.status(500).json({ error: 'Failed to create record', details: error.message });
  }
});

// Uploader: Update record (only if status is DRAFT, SUBMITTED, or NEEDS_EDIT) with optional PDF
router.put('/:usn', auth, requireRole('uploader'), upload.single('pdfFile'), handleMulterError, async (req, res) => {
  try {
    const { usn } = req.params;
    const { name, year, dept, marks, program } = req.body;

    const record = await Record.findOne({ usn, uploader: req.user._id });
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found or access denied' });
    }

    // Cannot edit after APPROVED_ON_CHAIN
    if (record.status === 'APPROVED_ON_CHAIN') {
      return res.status(403).json({ error: 'Cannot edit record after it has been approved and added to blockchain' });
    }

    // Can only edit if status is DRAFT, SUBMITTED, or NEEDS_EDIT
    if (!['DRAFT', 'SUBMITTED', 'NEEDS_EDIT'].includes(record.status)) {
      return res.status(403).json({ error: 'Cannot edit record in current status' });
    }

    // Update fields
    if (name) record.name = name;
    if (year) record.year = year;
    if (dept) record.dept = dept;
    if (marks) record.marks = marks;
    if (program) record.program = program;
    
    // Update PDF if provided
    if (req.file) {
      record.pdfFile = req.file.buffer;
      record.pdfFileName = req.file.originalname;
    }
    
    // If status was NEEDS_EDIT, change back to DRAFT
    if (record.status === 'NEEDS_EDIT') {
      record.status = 'DRAFT';
      record.editNotes = null;
    }

    await record.save();

    res.json({ 
      message: 'Record updated successfully', 
      record: {
        _id: record._id,
        usn: record.usn,
        name: record.name,
        year: record.year,
        dept: record.dept,
        marks: record.marks,
        program: record.program,
        pdfFileName: record.pdfFileName,
        status: record.status
      }
    });
  } catch (error) {
    console.error('Record update error:', error);
    res.status(500).json({ error: 'Failed to update record', details: error.message });
  }
});

// Uploader: Submit record (DRAFT → SUBMITTED)
router.put('/:usn/submit', auth, requireRole('uploader'), async (req, res) => {
  try {
    const { usn } = req.params;

    const record = await Record.findOne({ usn, uploader: req.user._id });
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found or access denied' });
    }

    if (record.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Record must be in DRAFT status to submit' });
    }

    record.status = 'SUBMITTED';
    await record.save();

    res.json({ message: 'Record submitted successfully', record });
  } catch (error) {
    console.error('Record submit error:', error);
    res.status(500).json({ error: 'Failed to submit record', details: error.message });
  }
});

// Uploader: Get own records
router.get('/uploader/my-records', auth, requireRole('uploader'), async (req, res) => {
  try {
    const records = await Record.find({ uploader: req.user._id })
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('verifier', 'name email')
      .populate('approver', 'name email')
      .sort({ createdAt: -1 });

    res.json({ records });
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Verifier: Get records pending action (default SUBMITTED, NEEDS_EDIT; VERIFIED only when explicitly requested)
router.get('/verifier/pending', auth, requireRole('verifier'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Status filter: if status=ALL include SUBMITTED, VERIFIED, NEEDS_EDIT; default excludes VERIFIED
    let query;
    if (status === 'ALL') {
      query = { status: { $in: ['SUBMITTED', 'VERIFIED', 'NEEDS_EDIT'] } };
    } else if (status) {
      query = { status };
    } else {
      query = { status: { $in: ['SUBMITTED', 'NEEDS_EDIT'] } };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const records = await Record.find(query)
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('uploader', 'name email organization')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Record.countDocuments(query);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Verifier: Mark record as verified (SUBMITTED → VERIFIED)
router.put('/:usn/verify', auth, requireRole('verifier'), async (req, res) => {
  try {
    const { usn } = req.params;

    const record = await Record.findOne({ usn });
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (record.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Record must be in SUBMITTED status to verify' });
    }

    record.status = 'VERIFIED';
    record.verifier = req.user._id;
    record.verifiedAt = new Date();
    await record.save();

    res.json({ message: 'Record verified successfully', record });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to verify record', details: error.message });
  }
});

// Verifier: Mark record as needs edit (SUBMITTED/VERIFIED → NEEDS_EDIT)
router.put('/:usn/needs-edit', auth, requireRole('verifier'), async (req, res) => {
  try {
    const { usn } = req.params;
    const { editNotes } = req.body;

    const record = await Record.findOne({ usn });
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (!['SUBMITTED', 'VERIFIED'].includes(record.status)) {
      return res.status(400).json({ error: 'Record must be in SUBMITTED or VERIFIED status' });
    }

    record.status = 'NEEDS_EDIT';
    record.verifier = req.user._id;
    record.editNotes = editNotes || 'Please review and fix the data';
    await record.save();

    res.json({ message: 'Record marked as needs edit', record });
  } catch (error) {
    console.error('Needs edit error:', error);
    res.status(500).json({ error: 'Failed to mark record as needs edit', details: error.message });
  }
});

// Verifier: Get all records (for viewing all students' statuses)
router.get('/verifier/all', auth, requireRole('verifier'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    
    const query = {};

    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { program: { $regex: search, $options: 'i' } },
        { dept: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const records = await Record.find(query)
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('uploader', 'name email organization')
      .populate('verifier', 'name email')
      .populate('approver', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Record.countDocuments(query);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Verifier: Get records this verifier has verified
router.get('/verifier/verified-by-me', auth, requireRole('verifier'), async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query = {
      status: 'VERIFIED',
      verifier: req.user._id
    };

    if (search) {
      query.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { program: { $regex: search, $options: 'i' } },
        { dept: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const records = await Record.find(query)
      .select('-pdfFile')
      .populate('uploader', 'name email organization')
      .populate('verifier', 'name email')
      .sort({ verifiedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Record.countDocuments(query);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Fetch verified-by-me error:', error);
    res.status(500).json({ error: 'Failed to fetch your verified records' });
  }
});

// Approver: Get only verified records (VERIFIED status only)
router.get('/approver/verified', auth, requireRole('approver'), async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    
    const query = {
      status: 'VERIFIED'
    };

    // Search functionality
    if (search) {
      query.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { program: { $regex: search, $options: 'i' } },
        { dept: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const records = await Record.find(query)
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('uploader', 'name email organization')
      .populate('verifier', 'name email')
      .sort({ verifiedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Record.countDocuments(query);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Approver: Update record with IPFS CID and transaction hash (VERIFIED → APPROVED_ON_CHAIN)
router.put('/:usn/approve', auth, requireRole('approver'), async (req, res) => {
  try {
    const { usn } = req.params;
    const { cid, ipfsUrl, txHash } = req.body;

    console.log('Approve endpoint called for USN:', usn);
    console.log('Request body:', { cid, ipfsUrl, txHash });

    if (!cid || !ipfsUrl || !txHash) {
      console.error('Missing fields - cid:', cid, 'ipfsUrl:', ipfsUrl, 'txHash:', txHash);
      return res.status(400).json({ error: 'Missing required fields: cid, ipfsUrl, txHash' });
    }

    const record = await Record.findOne({ usn });
    console.log('Record found:', record ? `status=${record.status}` : 'NOT FOUND');
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (record.status !== 'VERIFIED') {
      console.error('Record status is not VERIFIED, current status:', record.status);
      return res.status(400).json({ error: `Record must be in VERIFIED status to approve, current status: ${record.status}` });
    }

    record.status = 'APPROVED_ON_CHAIN';
    record.cid = cid;
    record.ipfsUrl = ipfsUrl;
    record.txHash = txHash;
    record.approver = req.user._id;
    record.approverWallet = req.user.walletAddress || null;
    record.approvedAt = new Date();
    await record.save();

    res.json({ 
      message: 'Record approved and added to blockchain successfully', 
      record: {
        _id: record._id,
        usn: record.usn,
        name: record.name,
        year: record.year,
        dept: record.dept,
        marks: record.marks,
        program: record.program,
        cid: record.cid,
        ipfsUrl: record.ipfsUrl,
        txHash: record.txHash,
        status: record.status
      }
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve record', details: error.message });
  }
});

// Get PDF file from MongoDB (for uploader, verifier, approver)
// IMPORTANT: This route must come before /:usn route to avoid conflicts
router.get('/:usn/pdf', auth, requireRole('uploader', 'verifier', 'approver'), async (req, res) => {
  try {
    const { usn } = req.params;
    let record;
    
    // Uploaders can only access their own records
    if (req.user.role === 'uploader') {
      record = await Record.findOne({ usn, uploader: req.user._id });
      if (!record) {
        return res.status(404).json({ error: 'Record not found or access denied' });
      }
    } else {
      // Verifiers and Approvers can access any record
      record = await Record.findOne({ usn });
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }
    }
    
    if (!record.pdfFile) {
      return res.status(404).json({ error: 'PDF file not found in record' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${record.pdfFileName || usn + '_marksheet.pdf'}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(record.pdfFile);
  } catch (error) {
    console.error('PDF fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch PDF', details: error.message });
  }
});

// Get record by USN (for students and employers - only APPROVED_ON_CHAIN)
router.get('/:usn', auth, async (req, res) => {
  try {
    const { usn } = req.params;
    
    // Students can only view their own records
    if (req.user.role === 'student' && req.user.usn !== usn) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Students and employers can only see APPROVED_ON_CHAIN records
    if (['student', 'employer'].includes(req.user.role)) {
      const record = await Record.findOne({ usn, status: 'APPROVED_ON_CHAIN' })
        .select('-pdfFile') // Exclude PDF buffer from response
        .populate('uploader', 'name email organization')
        .populate('verifier', 'name email')
        .populate('approver', 'name email');
      
      if (!record) {
        return res.status(404).json({ error: 'Record not found or not yet approved' });
      }

      return res.json({ record });
    }

    // Other roles can see records based on their permissions
    const record = await Record.findOne({ usn })
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('uploader', 'name email organization')
      .populate('verifier', 'name email')
      .populate('approver', 'name email');
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ record });
  } catch (error) {
    console.error('Fetch record error:', error);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// Get all records (for employers - only APPROVED_ON_CHAIN)
router.get('/', auth, requireRole('employer', 'uploader', 'verifier', 'approver'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    
    const query = {};
    
    // Employers can only see APPROVED_ON_CHAIN records
    if (req.user.role === 'employer') {
      query.status = 'APPROVED_ON_CHAIN';
    } else if (req.user.role === 'uploader') {
      // Uploaders see their own records
      query.uploader = req.user._id;
      if (status) {
        query.status = status;
      }
    } else if (req.user.role === 'verifier') {
      // Verifiers can filter by status
      if (status) {
        query.status = status;
      }
    } else if (req.user.role === 'approver') {
      // Approvers can filter by status
      if (status) {
        query.status = status;
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { program: { $regex: search, $options: 'i' } },
        { dept: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const records = await Record.find(query)
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('uploader', 'name email organization')
      .populate('verifier', 'name email')
      .populate('approver', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Record.countDocuments(query);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Get student's own records (only APPROVED_ON_CHAIN)
router.get('/student/my-records', auth, requireRole('student'), async (req, res) => {
  try {
    if (!req.user.usn) {
      return res.status(400).json({ error: 'USN not found in user profile' });
    }

    const records = await Record.find({ 
      usn: req.user.usn, 
      status: 'APPROVED_ON_CHAIN' 
    })
      .select('-pdfFile') // Exclude PDF buffer from response
      .populate('uploader', 'name email organization')
      .populate('verifier', 'name email')
      .populate('approver', 'name email')
      .sort({ approvedAt: -1 });

    res.json({ records });
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Approver: Upload PDF from MongoDB to IPFS and get CID
router.post('/:usn/upload-pdf-to-ipfs', auth, requireRole('approver'), async (req, res) => {
  try {
    const { usn } = req.params;
    const FormData = require('form-data');
    const axios = require('axios');

    const record = await Record.findOne({ usn });
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (!record.pdfFile) {
      return res.status(400).json({ error: 'PDF file not found in record' });
    }

    if (record.status !== 'VERIFIED') {
      return res.status(400).json({ error: 'Record must be in VERIFIED status' });
    }

    const PINATA_API_KEY = process.env.PINATA_API_KEY;
    const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      return res.status(500).json({ 
        error: 'Pinata credentials not configured',
        details: 'Please set PINATA_API_KEY and PINATA_SECRET_KEY in your .env file'
      });
    }

    // Create form data with PDF from MongoDB
    const formData = new FormData();
    formData.append('file', record.pdfFile, {
      filename: record.pdfFileName || `${usn}_marksheet.pdf`,
      contentType: 'application/pdf'
    });

    // Pinata metadata
    const pinataMetadata = JSON.stringify({
      name: record.pdfFileName || `${usn}_marksheet.pdf`,
      keyvalues: {
        usn: record.usn,
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
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

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
    console.error('IPFS upload error:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to upload to Pinata';
    let errorDetails = error.message;
    
    if (error.response?.data) {
      errorDetails = typeof error.response.data === 'object' 
        ? JSON.stringify(error.response.data)
        : error.response.data;
    }
    
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

module.exports = router;
