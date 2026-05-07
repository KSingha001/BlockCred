import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { account, connectWallet, disconnectWallet, isConnected } = useWeb3();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'uploader':
        return '/uploader';
      case 'verifier':
        return '/verifier';
      case 'approver':
        return '/approver';
      case 'student':
        return '/student';
      case 'employer':
        return '/employer';
      default:
        return '/';
    }
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex items-center px-2 py-2 text-xl font-bold text-blue-600">
              Student Verification System
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  Dashboard
                </Link>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <>
                      <span className="text-sm text-gray-600">
                        {account?.slice(0, 6)}...{account?.slice(-4)}
                      </span>
                      <button
                        onClick={disconnectWallet}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={async () => {
                        const result = await connectWallet();
                        if (!result.success && result.error) {
                          alert(result.error);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Connect Wallet
                    </button>
                  )}
                </div>
                <span className="text-sm text-gray-600">{user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-gray-700 hover:text-blue-600"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;






