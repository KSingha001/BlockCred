import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import axios from 'axios';

const AdminDashboard = () => {
  const { account, contract, connectWallet, isConnected } = useWeb3();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/records`);
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const syncRecordFromBlockchain = async (usn) => {
    if (!contract) {
      setMessage('Contract not initialized');
      return;
    }

    try {
      setMessage('Syncing record from blockchain...');
      console.log('Syncing record from blockchain for USN:', usn);
      
      // Get record from blockchain
      const blockchainRecord = await contract.getRecord(usn);
      console.log('Blockchain record:', blockchainRecord);
      
      // Handle both object and array formats from ethers.js
      // The struct might be returned as an object with named properties or as an array
      let isVerifiedOnChain = false;
      let uploaderAddress = null;
      
      if (typeof blockchainRecord === 'object') {
        // Check if it's an array (indexed access)
        if (Array.isArray(blockchainRecord) || blockchainRecord.length !== undefined) {
          // Struct returned as array: [usn, name, program, cid, timestamp, uploader, verified]
          isVerifiedOnChain = blockchainRecord[6] || blockchainRecord.verified || false;
          uploaderAddress = blockchainRecord[5] || blockchainRecord.uploader || null;
        } else {
          // Struct returned as object with named properties
          isVerifiedOnChain = blockchainRecord.verified || false;
          uploaderAddress = blockchainRecord.uploader || null;
        }
      }
      
      console.log('Is verified on chain:', isVerifiedOnChain);
      console.log('Uploader address:', uploaderAddress);
      
      // Find the record in our local state to check current status
      const localRecord = records.find(r => r.usn === usn);
      
      // If blockchain shows verified but backend doesn't, update backend
      if (isVerifiedOnChain && (!localRecord || !localRecord.verified)) {
        console.log('Record is verified on blockchain but not in backend. Updating backend...');
        await axios.put(`${API_URL}/api/records/${usn}/verify`, {
          verified: true,
          verifierWallet: account || uploaderAddress || null
        });
        setMessage(`✅ Record synced successfully! Record is verified on blockchain.`);
        fetchRecords();
      } else if (!isVerifiedOnChain && localRecord && localRecord.verified) {
        // If backend shows verified but blockchain doesn't, update backend
        console.log('Record is not verified on blockchain but backend shows verified. Updating backend...');
        await axios.put(`${API_URL}/api/records/${usn}/verify`, {
          verified: false,
          verifierWallet: null
        });
        setMessage(`⚠️ Record synced. Blockchain shows unverified, backend updated.`);
        fetchRecords();
      } else if (isVerifiedOnChain && localRecord && localRecord.verified) {
        setMessage(`✅ Record is already in sync (verified on both blockchain and backend).`);
      } else {
        setMessage(`ℹ️ Record is not verified on blockchain.`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      if (error.reason?.includes('Record does not exist') ||
          error.message?.includes('Record does not exist')) {
        setMessage('❌ Record does not exist on the blockchain.');
      } else {
        setMessage(`❌ Failed to sync record: ${error.reason || error.message || 'Unknown error'}`);
      }
    }
  };

  const handleVerify = async (usn) => {
    if (!isConnected) {
      setMessage('Please connect your wallet first');
      return;
    }

    try {
      if (contract) {
        console.log('Attempting to verify record on blockchain...');
        console.log('USN:', usn);
        console.log('Account:', account);
        
        // Check if wallet has VERIFIER_ROLE before attempting transaction
        try {
          const { keccak256, toUtf8Bytes } = await import('ethers');
          const VERIFIER_ROLE = keccak256(toUtf8Bytes("VERIFIER_ROLE"));
          const hasRole = await contract.hasRole(VERIFIER_ROLE, account);
          console.log('Has VERIFIER_ROLE:', hasRole);
          
          if (!hasRole) {
            setMessage('❌ Error: Your wallet address does not have the VERIFIER_ROLE on the contract. Please contact the contract owner/admin to grant you the verifier role. Your wallet: ' + account);
            return;
          }
        } catch (roleCheckError) {
          console.error('Role check failed:', roleCheckError);
          // Continue anyway, gas estimation will catch it
          console.log('Continuing with gas estimation...');
        }
        
        // Estimate gas first to catch errors early
        try {
          const gasEstimate = await contract.verifyRecord.estimateGas(usn);
          console.log('Gas estimate:', gasEstimate.toString());
        } catch (estimateError) {
          console.error('Gas estimation failed:', estimateError);
          
          // If "already verified" error, sync from blockchain instead
          if (estimateError.reason?.includes('already verified') ||
              estimateError.message?.includes('already verified') ||
              estimateError.reason?.includes('Record already verified') ||
              estimateError.message?.includes('Record already verified')) {
            console.log('Record already verified on blockchain. Syncing with backend...');
            await syncRecordFromBlockchain(usn);
            return;
          }
          
          // Decode the error data if available
          let errorMessage = 'Unknown error';
          if (estimateError.data) {
            // Check for AccessControlUnauthorizedAccount error (0xe2517d3f)
            if (estimateError.data.startsWith('0xe2517d3f')) {
              errorMessage = 'Your wallet does not have the VERIFIER_ROLE. Please contact the admin to grant you the verifier role.';
            } else if (estimateError.reason?.includes('Record does not exist') ||
                       estimateError.message?.includes('Record does not exist')) {
              errorMessage = 'This record does not exist on the blockchain.';
            } else {
              errorMessage = estimateError.reason || estimateError.message || 'Transaction would fail';
            }
          } else if (estimateError.reason?.includes('AccessControlUnauthorizedAccount') || 
                     estimateError.message?.includes('AccessControlUnauthorizedAccount') ||
                     estimateError.message?.includes('missing role')) {
            errorMessage = 'Your wallet does not have the VERIFIER_ROLE. Please contact the admin to grant you the verifier role.';
          } else if (estimateError.reason?.includes('Record does not exist') ||
                     estimateError.message?.includes('Record does not exist')) {
            errorMessage = 'This record does not exist on the blockchain.';
          } else {
            errorMessage = estimateError.reason || estimateError.message || 'Transaction would fail';
          }
          
          setMessage(`❌ Error: ${errorMessage}`);
          return;
        }
        
        // If gas estimation succeeds, proceed with transaction
        console.log('Sending verification transaction to MetaMask...');
        const tx = await contract.verifyRecord(usn);
        
        console.log('Transaction sent, waiting for confirmation...');
        console.log('Transaction hash:', tx.hash);
        
        await tx.wait();
        console.log('Transaction confirmed!');

        // Update record in backend
        await axios.put(`${API_URL}/api/records/${usn}/verify`, {
          verified: true,
          verifierWallet: account
        });

        setMessage(`✅ Record verified successfully! TX: ${tx.hash}`);
        fetchRecords();
      } else {
        setMessage('Contract not initialized');
      }
    } catch (error) {
      console.error('Verification error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error reason:', error.reason);
      
      // Check if user rejected the transaction
      if (error.code === 'ACTION_REJECTED' || 
          error.code === 4001 ||
          error.message?.includes('user rejected') || 
          error.message?.includes('User denied') ||
          error.message?.includes('rejected')) {
        setMessage('Verification transaction was cancelled. Please try again.');
      } else if (error.reason?.includes('already verified') ||
                 error.message?.includes('already verified') ||
                 error.reason?.includes('Record already verified') ||
                 error.message?.includes('Record already verified')) {
        // If "already verified" error, sync from blockchain instead
        console.log('Record already verified on blockchain. Syncing with backend...');
        await syncRecordFromBlockchain(usn);
      } else {
        // Decode the error data if available
        let errorMessage = 'Unknown error';
        if (error.data) {
          // Check for AccessControlUnauthorizedAccount error (0xe2517d3f)
          if (error.data.startsWith('0xe2517d3f')) {
            errorMessage = 'Your wallet does not have the VERIFIER_ROLE. Please contact the admin to grant you the verifier role.';
          } else if (error.reason?.includes('Record does not exist') ||
                     error.message?.includes('Record does not exist')) {
            errorMessage = 'This record does not exist on the blockchain.';
          } else {
            errorMessage = error.reason || error.message || 'Verification failed';
          }
        } else {
          errorMessage = error.reason || error.message || 'Verification failed';
        }
        
        setMessage(`❌ Verification failed: ${errorMessage}`);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {!isConnected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>Please connect your wallet to verify records</p>
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

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Pending Verifications</h2>
        
        {loading ? (
          <p>Loading...</p>
        ) : records.length === 0 ? (
          <p className="text-gray-500">No records found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">USN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.usn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.program}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2 items-center">
                        {!record.verified && (
                          <button
                            onClick={() => handleVerify(record.usn)}
                            disabled={!isConnected}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Verify
                          </button>
                        )}
                        <button
                          onClick={() => syncRecordFromBlockchain(record.usn)}
                          disabled={!isConnected || !contract}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          title="Sync verification status from blockchain"
                        >
                          Sync
                        </button>
                        {record.txHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View TX
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;






