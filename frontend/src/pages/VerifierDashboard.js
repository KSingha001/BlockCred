import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const VerifierDashboard = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [verifiedMine, setVerifiedMine] = useState([]);
  const [approvedOnChain, setApprovedOnChain] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editNotes, setEditNotes] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/records/verifier/pending`;
      const params = {
        page: 1,
        limit: 1000,
        ...(filterStatus ? { status: filterStatus } : {})
      };
      const response = await axios.get(url, { params });
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      setMessage('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [API_URL, filterStatus]);

  const fetchVerifiedMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const response = await axios.get(`${API_URL}/api/records/verifier/verified-by-me`, {
        params: { limit: 1000 }
      });
      setVerifiedMine(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch verified records:', error);
    } finally {
      setLoadingMine(false);
    }
  }, [API_URL]);

  const fetchApprovedOnChain = useCallback(async () => {
    setLoadingApproved(true);
    try {
      const response = await axios.get(`${API_URL}/api/records/verifier/all`, {
        params: { status: 'APPROVED_ON_CHAIN', limit: 1000, page: 1 }
      });
      setApprovedOnChain(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch approved on-chain records:', error);
    } finally {
      setLoadingApproved(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (user?.role !== 'verifier') return;
    fetchRecords();
    fetchVerifiedMine();
    fetchApprovedOnChain();
  }, [user, fetchRecords, fetchVerifiedMine, fetchApprovedOnChain]);

  const handleVerify = async (usn) => {
    try {
      await axios.put(`${API_URL}/api/records/${usn}/verify`);
      setMessage('Record verified successfully');
      fetchRecords();
    } catch (error) {
      console.error('Verify error:', error);
      setMessage(error.response?.data?.error || 'Failed to verify record');
    }
  };

  const handleNeedsEdit = async (usn) => {
    if (!editNotes.trim()) {
      setMessage('Please provide edit notes');
      return;
    }

    try {
      await axios.put(`${API_URL}/api/records/${usn}/needs-edit`, { editNotes });
      setMessage('Record marked as needs edit');
      setSelectedRecord(null);
      setEditNotes('');
      fetchRecords();
    } catch (error) {
      console.error('Needs edit error:', error);
      setMessage(error.response?.data?.error || 'Failed to mark record as needs edit');
    }
  };

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Verifier Dashboard</h1>

      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('success') || message.includes('marked') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Status:
        </label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
        >
          <option value="ALL">All (SUBMITTED, VERIFIED, NEEDS_EDIT)</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="NEEDS_EDIT">NEEDS_EDIT</option>
        </select>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Records for Review</h2>
        
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dept</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marks</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.dept}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.marks}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.program}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          {record.status === 'SUBMITTED' && (
                            <>
                              <button
                                onClick={() => handleVerify(record.usn)}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Verify
                              </button>
                              <button
                                onClick={() => setSelectedRecord(record)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Needs Edit
                              </button>
                            </>
                          )}
                          {record.status === 'VERIFIED' && (
                            <span className="text-green-600">Verified</span>
                          )}
                          {record.status === 'NEEDS_EDIT' && record.editNotes && (
                            <div className="text-xs text-red-600 max-w-xs">
                              {record.editNotes}
                            </div>
                          )}
                        </div>
                        {record.pdfFileName && (
                          <button
                            onClick={() => handleViewPDF(record.usn)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                          >
                            View PDF
                          </button>
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

      <div className="bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Records You Verified</h2>
        {loadingMine ? (
          <p>Loading...</p>
        ) : verifiedMine.length === 0 ? (
          <p className="text-gray-500">No verified records yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">USN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {verifiedMine.map((record) => (
                  <tr key={`mine-${record._id}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.usn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.program}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {record.pdfFileName && (
                        <button
                          onClick={() => handleViewPDF(record.usn)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          View PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Approved On-Chain</h2>
        {loadingApproved ? (
          <p>Loading...</p>
        ) : approvedOnChain.length === 0 ? (
          <p className="text-gray-500">No on-chain approved records yet</p>
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
                {approvedOnChain.map((record) => (
                  <tr key={`approved-${record._id}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.usn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.program}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {record.cid && (
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${record.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          View PDF
                        </a>
                      )}
                      {record.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs"
                        >
                          View TX
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Needs Edit Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Mark Record as Needs Edit</h3>
            <p className="text-sm text-gray-600 mb-2">
              <strong>USN:</strong> {selectedRecord.usn}<br />
              <strong>Name:</strong> {selectedRecord.name}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Edit Notes:
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              rows="4"
              placeholder="Please specify what needs to be fixed..."
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleNeedsEdit(selectedRecord.usn)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Mark as Needs Edit
              </button>
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  setEditNotes('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifierDashboard;

