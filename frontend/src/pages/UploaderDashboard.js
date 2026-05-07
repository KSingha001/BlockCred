import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const UploaderDashboard = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    usn: '',
    name: '',
    year: '',
    dept: '',
    marks: '',
    program: ''
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/records/uploader/my-records`);
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      setMessage('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (user?.role !== 'uploader') return;
    fetchRecords();
  }, [user, fetchRecords]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      // Validate form data before sending
      if (!editingRecord && !pdfFile) {
        setMessage('Please select a PDF file');
        setSubmitting(false);
        return;
      }

      const formDataToSend = new FormData();
      
      // Append all form fields
      formDataToSend.append('usn', formData.usn);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('year', formData.year);
      formDataToSend.append('dept', formData.dept);
      formDataToSend.append('marks', formData.marks);
      formDataToSend.append('program', formData.program);
      
      // Append PDF file if provided
      if (pdfFile) {
        formDataToSend.append('pdfFile', pdfFile);
      }

      console.log('Sending form data:', {
        usn: formData.usn,
        name: formData.name,
        year: formData.year,
        dept: formData.dept,
        marks: formData.marks,
        program: formData.program,
        hasPdf: !!pdfFile,
        pdfName: pdfFile?.name
      });

      const token = localStorage.getItem('token');
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let axios set it automatically for FormData
        }
      };

      if (editingRecord) {
        // Update existing record
        await axios.put(`${API_URL}/api/records/${editingRecord.usn}`, formDataToSend, config);
        setMessage('Record updated successfully');
        setEditingRecord(null);
      } else {
        // Create new record
        await axios.post(`${API_URL}/api/records/create`, formDataToSend, config);
        setMessage('Record created successfully');
      }

      setFormData({ usn: '', name: '', year: '', dept: '', marks: '', program: '' });
      setPdfFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      fetchRecords();
    } catch (error) {
      console.error('Submit error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to save record';
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    if (record.status === 'APPROVED_ON_CHAIN') {
      setMessage('Cannot edit record after it has been approved and added to blockchain');
      return;
    }

    if (!['DRAFT', 'SUBMITTED', 'NEEDS_EDIT'].includes(record.status)) {
      setMessage('Cannot edit record in current status');
      return;
    }

    setEditingRecord(record);
    setFormData({
      usn: record.usn,
      name: record.name,
      year: record.year,
      dept: record.dept,
      marks: record.marks,
      program: record.program
    });
    setPdfFile(null);
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setFormData({ usn: '', name: '', year: '', dept: '', marks: '', program: '' });
    setPdfFile(null);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
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

  const handleSubmitRecord = async (usn) => {
    try {
      await axios.put(`${API_URL}/api/records/${usn}/submit`);
      setMessage('Record submitted successfully');
      fetchRecords();
    } catch (error) {
      console.error('Submit record error:', error);
      setMessage(error.response?.data?.error || 'Failed to submit record');
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
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Uploader Dashboard</h1>

      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingRecord ? 'Edit Student Record' : 'Create Student Record'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                USN *
              </label>
              <input
                type="text"
                name="usn"
                required
                disabled={!!editingRecord}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
                value={formData.usn}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student Name *
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
                Year *
              </label>
              <input
                type="text"
                name="year"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                value={formData.year}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department *
              </label>
              <input
                type="text"
                name="dept"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                value={formData.dept}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marks *
              </label>
              <input
                type="text"
                name="marks"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                value={formData.marks}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program *
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
                Marksheet PDF {editingRecord ? '(Optional - leave empty to keep existing)' : '*'}
              </label>
              <input
                type="file"
                accept=".pdf"
                required={!editingRecord}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                onChange={handleFileChange}
              />
              {editingRecord && editingRecord.pdfFileName && (
                <p className="mt-1 text-sm text-gray-500">Current file: {editingRecord.pdfFileName}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingRecord ? 'Update Record' : 'Create Record'}
              </button>
              {editingRecord && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">My Records</h2>
          
          {loading ? (
            <p>Loading...</p>
          ) : records.length === 0 ? (
            <p className="text-gray-500">No records created yet</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {records.map((record) => (
                <div key={record._id} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium">{record.name}</p>
                      <p className="text-sm text-gray-600">USN: {record.usn}</p>
                      <p className="text-sm text-gray-600">Year: {record.year} | Dept: {record.dept}</p>
                      <p className="text-sm text-gray-600">Marks: {record.marks} | Program: {record.program}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                  
                  {record.editNotes && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">
                        <strong>Edit Notes:</strong> {record.editNotes}
                      </p>
                    </div>
                  )}

                  <div className="mt-2 flex gap-2">
                    {['DRAFT', 'SUBMITTED', 'NEEDS_EDIT'].includes(record.status) && (
                      <button
                        onClick={() => handleEdit(record)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Edit
                      </button>
                    )}
                    {record.status === 'DRAFT' && (
                      <button
                        onClick={() => handleSubmitRecord(record.usn)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Submit
                      </button>
                    )}
                    {record.pdfFileName && (
                      <button
                        onClick={() => handleViewPDF(record.usn)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        View PDF
                      </button>
                    )}
                    {record.status === 'APPROVED_ON_CHAIN' && record.txHash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
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

export default UploaderDashboard;

