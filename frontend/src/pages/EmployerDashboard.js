import React, { useState, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const EmployerDashboard = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [activeTab, setActiveTab] = useState('blockchain'); // 'blockchain' or 'database'
  const [message, setMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Fetch verified records from blockchain
  const fetchBlockchainRecords = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/tx/employer/verified-records`, {
        params: {
          ...(search ? { search } : {}),
          includeUnverified: true,
          limit: 1000,
          offset: 0,
        }
      });
      setRecords(response.data.records || []);
      setMessage('');
    } catch (error) {
      console.error('Failed to fetch blockchain records:', error);
      setMessage('Failed to fetch verified records from blockchain');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (activeTab === 'blockchain') {
      fetchBlockchainRecords();
    }
  }, [activeTab, fetchBlockchainRecords]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (activeTab === 'blockchain') {
      fetchBlockchainRecords(searchTerm);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Employer Dashboard</h1>
      <p className="text-gray-600 mb-6">Search and verify student records on the blockchain</p>

      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            placeholder="Search by USN, Name, or Program..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            🔍 Search
          </button>
        </form>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Blockchain Verified Records</h3>
        <p className="text-blue-700 text-sm">All records shown here are verified on the Sepolia blockchain network. Click on IPFS links to view PDFs.</p>
      </div>

      {loading ? (
        <p className="text-center py-8">Loading verified records...</p>
      ) : records.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-500">No verified records found</p>
          {searchTerm && <p className="text-sm text-gray-400 mt-2">Try a different search term</p>}
        </div>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700">Total Verified Records: <span className="font-bold text-blue-600">{records.length}</span></p>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">USN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.usn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{record.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{record.program}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {record.cid && (
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${record.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          📄 View PDF
                        </a>
                      )}
                      {record.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs"
                        >
                          🔗 View TX
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">✅ Verification Summary</h3>
            <p className="text-green-700 text-sm">
              Total verified records on blockchain: <span className="font-bold text-lg">{records.length}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployerDashboard;






