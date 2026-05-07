import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Blockchain-based Student Verification System
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Secure, tamper-proof student records and marksheet verification using Ethereum and IPFS
        </p>

        {!isAuthenticated ? (
          <div className="space-x-4">
            <Link
              to="/register"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
            >
              Login
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-lg text-gray-700 mb-4">
              Welcome, {user?.name}! Access your dashboard to get started.
            </p>
            <Link
              to={`/${user?.role}`}
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">For Colleges</h3>
            <p className="text-gray-600">
              Upload student records and marksheets securely to IPFS and record verification on blockchain
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">For Students</h3>
            <p className="text-gray-600">
              View and download your verified records and marksheets anytime, anywhere
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">For Employers</h3>
            <p className="text-gray-600">
              Verify student credentials instantly with blockchain-verified records
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;






