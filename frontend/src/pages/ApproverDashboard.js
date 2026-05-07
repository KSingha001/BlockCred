import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import axios from 'axios';

const ApproverDashboard = () => {
  const { user } = useAuth();
  const { account, contract, connectWallet, isConnected } = useWeb3();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingRecord, setUploadingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'approved'

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [verifiedRes, approvedRes] = await Promise.all([
        axios.get(`${API_URL}/api/records/approver/verified`),
        axios.get(`${API_URL}/api/records`, {
          params: { status: 'APPROVED_ON_CHAIN', limit: 200 }
        })
      ]);

      const verified = verifiedRes.data.records || [];
      const approved = (approvedRes.data.records || []).map(record => ({
        ...record,
        status: record.status || 'APPROVED_ON_CHAIN'
      }));

      // Merge by USN so the approved copy (with tx hash) wins over any duplicate
      const mergedByUsn = new Map();
      [...verified, ...approved].forEach(record => {
        mergedByUsn.set(record.usn, record);
      });

      setRecords(Array.from(mergedByUsn.values()));
    } catch (error) {
      console.error('Failed to fetch records:', error);
      setMessage('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Fetch on-chain records from blockchain
  const syncOnchainRecords = useCallback(async () => {
    try {
      console.log('Syncing on-chain records...');
      const response = await axios.get(`${API_URL}/api/tx/onchain/records`);
      if (response.data.records && response.data.records.length > 0) {
        // Merge on-chain records with local records
        const onchainRecords = response.data.records;
        setRecords(prevRecords => {
          // Add on-chain records that don't exist in DB
          const usnSet = new Set(prevRecords.map(r => r.usn));
          const newOnchainRecords = onchainRecords
            .filter(r => !usnSet.has(r.usn))
            .map(r => ({
              ...r,
              _id: `onchain-${r.usn}`,
              status: 'APPROVED_ON_CHAIN',
              txHash: null,
              onchainOnly: true
            }));
          return [...prevRecords, ...newOnchainRecords];
        });
        console.log(`Synced ${onchainRecords.length} on-chain records`);
      }
    } catch (error) {
      console.error('Failed to sync on-chain records:', error);
    }
  }, [API_URL]);

  useEffect(() => {
    if (user?.role !== 'approver') return;
    fetchRecords();
    // Don't auto-sync on mount - only on user click
  }, [user, fetchRecords]);

  // Auto-refresh when switching to Approved tab
  useEffect(() => {
    if (user?.role !== 'approver') return;
    if (activeTab === 'approved') {
      fetchRecords();
      syncOnchainRecords();
    }
  }, [activeTab, user, fetchRecords, syncOnchainRecords]);

  const handleViewPDF = async (usn) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/records/${usn}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob' // Important: receive as blob
      });

      // Create a blob URL and open it
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up the URL after a delay (optional)
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Failed to fetch PDF:', error);
      setMessage(error.response?.data?.error || 'Failed to load PDF');
    }
  };

  const handleApprove = async (record) => {
    if (!isConnected) {
      setMessage('Please connect your wallet first');
      return;
    }

    if (!record.pdfFile && !record.pdfFileName) {
      setMessage('PDF file not found in record. Please ensure the uploader has uploaded the PDF.');
      return;
    }

    setMessage('');
    setLoading(true);
    setUploadingRecord(record);

    try {
      let cid, ipfsUrl;

      // Step 1: Automatically upload PDF from MongoDB to Pinata
      const token = localStorage.getItem('token');
      const ipfsResponse = await axios.post(
        `${API_URL}/api/records/${record.usn}/upload-pdf-to-ipfs`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      cid = ipfsResponse.data.cid;
      ipfsUrl = ipfsResponse.data.ipfsUrl;

      if (!cid || !ipfsUrl) {
        throw new Error('Failed to get IPFS CID');
      }

      // Step 2: Upload to blockchain
      if (contract) {
        try {
          // Check if wallet has APPROVER_ROLE
          const { keccak256, toUtf8Bytes } = await import('ethers');
          const APPROVER_ROLE = keccak256(toUtf8Bytes("APPROVER_ROLE"));
          
          console.log('Checking APPROVER_ROLE for address:', account);
          console.log('APPROVER_ROLE hash:', APPROVER_ROLE);
          console.log('Contract address:', contract.target);
          
          const hasRole = await contract.hasRole(APPROVER_ROLE, account);
          
          console.log('Has APPROVER_ROLE:', hasRole);
          
          if (!hasRole) {
            const contractAddress = contract.target;
            const etherscanLink = `https://sepolia.etherscan.io/address/${contractAddress}#readContract`;
            setMessage(`❌ Error: Your wallet address (${account}) does not have the APPROVER_ROLE on the contract. Please contact the contract owner/admin to grant you the approver role. Contract: ${contractAddress}. You can verify roles on Etherscan: ${etherscanLink}`);
            setLoading(false);
            return;
          }

          // Estimate gas first
          try {
            await contract.uploadRecord.estimateGas(
              record.usn,
              record.name,
              record.program,
              cid
            );
          } catch (estimateError) {
            console.error('Gas estimation failed:', estimateError);
            let errorMessage = 'Unknown error';
            if (estimateError.data?.startsWith('0xe2517d3f')) {
              errorMessage = 'Your wallet does not have the APPROVER_ROLE. Please contact the admin to grant you the approver role.';
            } else if (estimateError.reason?.includes('Record already exists') ||
                       estimateError.message?.includes('Record already exists')) {
              errorMessage = 'A record with this USN already exists on the blockchain.';
            } else {
              errorMessage = estimateError.reason || estimateError.message || 'Transaction would fail';
            }
            setMessage(`❌ Error: ${errorMessage}`);
            setLoading(false);
            return;
          }

          // Send transaction
          const tx = await contract.uploadRecord(
            record.usn,
            record.name,
            record.program,
            cid
          );

          setMessage('Transaction sent, waiting for confirmation...');
          await tx.wait();

          // Step 3: Update record in backend
          await axios.put(`${API_URL}/api/records/${record.usn}/approve`, {
            cid,
            ipfsUrl,
            txHash: tx.hash
          });

          setMessage(`✅ Record approved and added to blockchain successfully! TX: ${tx.hash}`);
          setUploadingRecord(null);
          fetchRecords();
        } catch (txError) {
          console.error('Transaction error:', txError);
          
          if (txError.code === 'ACTION_REJECTED' || 
              txError.code === 4001 ||
              txError.message?.includes('user rejected') || 
              txError.message?.includes('User denied') ||
              txError.message?.includes('rejected')) {
            setMessage('Blockchain transaction was cancelled. The PDF was uploaded to IPFS but the record was not added to blockchain.');
          } else {
            let errorMessage = 'Unknown error';
            if (txError.data?.startsWith('0xe2517d3f')) {
              errorMessage = 'Your wallet does not have the APPROVER_ROLE. Please contact the admin to grant you the approver role.';
            } else if (txError.reason?.includes('Record already exists') ||
                       txError.message?.includes('Record already exists')) {
              errorMessage = 'A record with this USN already exists on the blockchain.';
            } else {
              errorMessage = txError.reason || txError.message || 'Transaction failed';
            }
            setMessage(`❌ Blockchain transaction failed: ${errorMessage}. The PDF was uploaded to IPFS.`);
          }
        }
      } else {
        setMessage('Contract not initialized');
      }
    } catch (error) {
      console.error('Approve error:', error);
      setMessage(error.response?.data?.error || 'Failed to approve record');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800';
      case 'VERIFIED': return 'bg-green-100 text-green-800';
      case 'APPROVED_ON_CHAIN': return 'bg-purple-100 text-purple-800';
      case 'NEEDS_EDIT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter records based on active tab
  const pendingRecords = records.filter(r => r.status === 'VERIFIED');
  const approvedRecords = records.filter(r => r.status === 'APPROVED_ON_CHAIN');

  const renderRecordsTable = (tableRecords) => {
    if (tableRecords.length === 0) {
      return <p className="text-gray-500">No records found</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">USN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dept</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marks</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tableRecords.map((record) => (
              <tr key={record._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.usn}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.year}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.dept}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.marks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.program}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                    {record.status === 'APPROVED_ON_CHAIN' && record.txHash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Etherscan TX
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {record.status === 'VERIFIED' ? (
                    <div className="space-y-2">
                      {record.pdfFileName && (
                        <button
                          onClick={() => handleViewPDF(record.usn)}
                          className="block w-full px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs text-center mb-2"
                        >
                          View PDF
                        </button>
                      )}
                      <button
                        onClick={() => handleApprove(record)}
                        disabled={!isConnected || loading || (loading && uploadingRecord?._id === record._id)}
                        className="w-full px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        {loading && uploadingRecord?._id === record._id ? 'Uploading PDF & Processing...' : 'Approve & Upload to Blockchain'}
                      </button>
                    </div>
                  ) : record.status === 'APPROVED_ON_CHAIN' ? (
                    <div className="space-y-1">
                      <span className="text-green-600 text-xs font-semibold">✅ Approved</span>
                      {record.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:underline text-xs"
                        >
                          View TX
                        </a>
                      )}
                      {record.cid && (
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${record.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:underline text-xs"
                        >
                          View PDF
                        </a>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Approver Dashboard</h1>

      {!isConnected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>Please connect your wallet to approve records</p>
          <button
            onClick={connectWallet}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Sync On-Chain Records Button */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={syncOnchainRecords}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          🔄 Sync On-Chain Records
        </button>
        <button
          onClick={fetchRecords}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
        >
          🔃 Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approval ({pendingRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'approved'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Approved Records ({approvedRecords.length})
          </button>
        </div>
      </div>

      {/* Pending Approval Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            Verified Records (Ready for Approval)
          </h2>
          
          {loading ? (
            <p>Loading...</p>
          ) : (
            renderRecordsTable(pendingRecords)
          )}
        </div>
      )}

      {/* Approved Tab */}
      {activeTab === 'approved' && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Approved Records (Blockchain Verified)
          </h2>
          
          {loading ? (
            <p>Loading...</p>
          ) : (
            renderRecordsTable(approvedRecords)
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Pending Approval</h3>
          <p className="text-3xl font-bold text-yellow-600">{pendingRecords.length}</p>
          <p className="text-sm text-yellow-700">Records awaiting your approval</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Approved & On-Chain</h3>
          <p className="text-3xl font-bold text-green-600">{approvedRecords.length}</p>
          <p className="text-sm text-green-700">Records successfully recorded on blockchain</p>
        </div>
      </div>
    </div>
  );
};

export default ApproverDashboard;

