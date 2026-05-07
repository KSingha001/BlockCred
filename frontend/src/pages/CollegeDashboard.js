import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import axios from 'axios';

const CollegeDashboard = () => {
  const { user } = useAuth();
  const { account, contract, connectWallet, isConnected } = useWeb3();
  const [formData, setFormData] = useState({
    usn: '',
    name: '',
    program: '',
    file: null
  });
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/records`, {
        params: { verified: false }
      });
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (user?.role !== 'college') return;
    fetchRecords();
  }, [user, fetchRecords]);

  const handleFileChange = (e) => {
    setFormData({ ...formData, file: e.target.files[0] });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    
    if (!isConnected) {
      setMessage('Please connect your wallet first');
      return;
    }

    if (!formData.file) {
      setMessage('Please select a marksheet file');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Upload file to Pinata
      const formDataToSend = new FormData();
      formDataToSend.append('file', formData.file);

      // Get token from localStorage for Authorization header
      const token = localStorage.getItem('token');

      const pinataResponse = await axios.post(
        `${API_URL}/api/pinata/pinFile`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - let axios set it with boundary
          }
        }
      );

      const { cid, ipfsUrl } = pinataResponse.data;

      // Step 2: Create record in MongoDB
      await axios.post(
        `${API_URL}/api/records/create`,
        {
          usn: formData.usn,
          name: formData.name,
          program: formData.program,
          cid,
          ipfsUrl
        }
      );

      // Step 3: Upload to blockchain
      if (contract) {
        try {
          console.log('Attempting to upload record to blockchain...');
          console.log('USN:', formData.usn);
          console.log('Account:', account);
          
          // Check if wallet has UPLOADER_ROLE before attempting transaction
          // Note: This check is optional - gas estimation will catch role issues anyway
          try {
            // UPLOADER_ROLE is keccak256("UPLOADER_ROLE")
            // Compute it manually since it's not in the minimal ABI
            const { keccak256, toUtf8Bytes } = await import('ethers');
            const UPLOADER_ROLE = keccak256(toUtf8Bytes("UPLOADER_ROLE"));
            const hasRole = await contract.hasRole(UPLOADER_ROLE, account);
            console.log('Has UPLOADER_ROLE:', hasRole);
            
            if (!hasRole) {
              setMessage('❌ Error: Your wallet address does not have the UPLOADER_ROLE on the contract. Please contact the contract owner/admin to grant you the uploader role. Your wallet: ' + account);
              fetchRecords();
              return;
            }
          } catch (roleCheckError) {
            console.error('Role check failed:', roleCheckError);
            // Continue anyway, gas estimation will catch it
            console.log('Continuing with gas estimation...');
          }
          
          // Estimate gas first to catch errors early
          try {
            const gasEstimate = await contract.uploadRecord.estimateGas(
              formData.usn,
              formData.name,
              formData.program,
              cid
            );
            console.log('Gas estimate:', gasEstimate.toString());
          } catch (estimateError) {
            console.error('Gas estimation failed:', estimateError);
            
            // Decode the error data if available
            let errorMessage = 'Unknown error';
            if (estimateError.data) {
              // Check for AccessControlUnauthorizedAccount error (0xe2517d3f)
              if (estimateError.data.startsWith('0xe2517d3f')) {
                errorMessage = 'Your wallet does not have the UPLOADER_ROLE. Please contact the admin to grant you the uploader role.';
              } else if (estimateError.reason?.includes('Record already exists') ||
                         estimateError.message?.includes('Record already exists')) {
                errorMessage = 'A record with this USN already exists on the blockchain.';
              } else {
                errorMessage = estimateError.reason || estimateError.message || 'Transaction would fail';
              }
            } else if (estimateError.reason?.includes('AccessControlUnauthorizedAccount') || 
                       estimateError.message?.includes('AccessControlUnauthorizedAccount') ||
                       estimateError.message?.includes('missing role')) {
              errorMessage = 'Your wallet does not have the UPLOADER_ROLE. Please contact the admin to grant you the uploader role.';
            } else if (estimateError.reason?.includes('Record already exists') ||
                       estimateError.message?.includes('Record already exists')) {
              errorMessage = 'A record with this USN already exists on the blockchain.';
            } else {
              errorMessage = estimateError.reason || estimateError.message || 'Transaction would fail';
            }
            
            setMessage(`❌ Error: ${errorMessage}`);
            fetchRecords();
            return;
          }
          
          // If gas estimation succeeds, proceed with transaction
          console.log('Sending transaction to MetaMask...');
          const tx = await contract.uploadRecord(
            formData.usn,
            formData.name,
            formData.program,
            cid
          );
          
          console.log('Transaction sent, waiting for confirmation...');
          console.log('Transaction hash:', tx.hash);
          
          await tx.wait();
          console.log('Transaction confirmed!');

          // Update record with transaction hash
          await axios.put(`${API_URL}/api/records/${formData.usn}/tx`, {
            txHash: tx.hash
          });

          setMessage(`Record uploaded successfully! TX: ${tx.hash}`);
          setFormData({ usn: '', name: '', program: '', file: null });
          fetchRecords();
        } catch (txError) {
          console.error('Transaction error:', txError);
          console.error('Error code:', txError.code);
          console.error('Error message:', txError.message);
          console.error('Error reason:', txError.reason);
          
          // Check if user rejected the transaction
          if (txError.code === 'ACTION_REJECTED' || 
              txError.code === 4001 ||
              txError.message?.includes('user rejected') || 
              txError.message?.includes('User denied') ||
              txError.message?.includes('rejected')) {
            setMessage(`File uploaded to IPFS and record created, but blockchain transaction was cancelled. The record exists but is not on the blockchain. You can try uploading again or the admin can verify it manually.`);
            // Don't clear the form so user can retry
            fetchRecords();
          } else {
            // Decode the error data if available
            let errorMessage = 'Unknown error';
            if (txError.data) {
              // Check for AccessControlUnauthorizedAccount error (0xe2517d3f)
              if (txError.data.startsWith('0xe2517d3f')) {
                errorMessage = 'Your wallet does not have the UPLOADER_ROLE. Please contact the admin to grant you the uploader role.';
              } else if (txError.reason?.includes('Record already exists') ||
                         txError.message?.includes('Record already exists')) {
                errorMessage = 'A record with this USN already exists on the blockchain.';
              } else {
                errorMessage = txError.reason || txError.message || 'Transaction failed';
              }
            } else if (txError.reason?.includes('AccessControlUnauthorizedAccount') || 
                       txError.message?.includes('AccessControlUnauthorizedAccount') ||
                       txError.message?.includes('missing role')) {
              errorMessage = 'Your wallet does not have the UPLOADER_ROLE. Please contact the admin to grant you the uploader role.';
            } else if (txError.reason?.includes('Record already exists') ||
                       txError.message?.includes('Record already exists')) {
              errorMessage = 'A record with this USN already exists on the blockchain.';
            } else {
              errorMessage = txError.reason || txError.message || 'Unknown blockchain error';
            }
            
            setMessage(`❌ Blockchain transaction failed: ${errorMessage}. The file was uploaded to IPFS and record created in database.`);
            fetchRecords();
          }
        }
      } else {
        setMessage('Contract not initialized');
      }
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Extract error message with more details
      let errorMessage = 'Upload failed';
      if (error.response?.data) {
        if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
        if (error.response.data.details) {
          errorMessage += `: ${error.response.data.details}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">College Dashboard</h1>

      {!isConnected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>Please connect your wallet to upload records</p>
          <button
            onClick={connectWallet}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Student Record</h2>
          
          {message && (
            <div className={`mb-4 p-3 rounded ${
              message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                USN
              </label>
              <input
                type="text"
                name="usn"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                value={formData.usn}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student Name
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program
              </label>
              <input
                type="text"
                name="program"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                value={formData.program}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marksheet PDF
              </label>
              <input
                type="file"
                accept=".pdf"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                onChange={handleFileChange}
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !isConnected}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Record'}
            </button>
          </form>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Uploaded Records</h2>
          
          {loading ? (
            <p>Loading...</p>
          ) : records.length === 0 ? (
            <p className="text-gray-500">No records uploaded yet</p>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record._id} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{record.name}</p>
                      <p className="text-sm text-gray-600">USN: {record.usn}</p>
                      <p className="text-sm text-gray-600">Program: {record.program}</p>
                      <p className="text-sm text-gray-600">
                        Status: {record.verified ? 'Verified' : 'Pending'}
                      </p>
                    </div>
                    {record.txHash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm hover:underline"
                      >
                        View TX
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollegeDashboard;






