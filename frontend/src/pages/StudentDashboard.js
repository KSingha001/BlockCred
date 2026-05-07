import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const StudentDashboard = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/records/student/my-records`);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Student Dashboard</h1>
      <p className="text-gray-600 mb-6">View your verified records and marksheets</p>

      {loading ? (
        <p>Loading...</p>
      ) : records.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6">
          <p className="text-gray-500">No records found. Contact your college to upload your records.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record._id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{record.name}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">USN</p>
                      <p className="font-medium">{record.usn}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Year</p>
                      <p className="font-medium">{record.year}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-medium">{record.dept}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Marks</p>
                      <p className="font-medium">{record.marks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Program</p>
                      <p className="font-medium">{record.program}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        APPROVED_ON_CHAIN
                      </span>
                    </div>
                  </div>
                  
                  {record.txHash && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">Transaction Hash</p>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {record.txHash}
                      </a>
                    </div>
                  )}

                  {record.ipfsUrl && (
                    <div>
                      <a
                        href={record.ipfsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Download Marksheet PDF
                      </a>
                    </div>
                  )}
                  {record.cid && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">IPFS CID: <span className="font-mono text-xs">{record.cid}</span></p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;






