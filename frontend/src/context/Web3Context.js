import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchContractInfo = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tx/contract/info`);
      setContractInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch contract info:', error);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchContractInfo();
  }, [fetchContractInfo]);

  // Sepolia Testnet configuration
  const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
  const SEPOLIA_NETWORK = {
    chainId: SEPOLIA_CHAIN_ID,
    chainName: 'Sepolia',
    nativeCurrency: {
      name: 'SepoliaETH',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: process.env.REACT_APP_SEPOLIA_RPC_URL 
      ? [process.env.REACT_APP_SEPOLIA_RPC_URL]
      : ['https://rpc.sepolia.org'], // Public Sepolia RPC endpoint
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  };

  const switchToSepolia = async () => {
    try {
      // Try to switch to Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }]
      });
    } catch (switchError) {
      // If Sepolia is not added, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SEPOLIA_NETWORK]
          });
        } catch (addError) {
          throw new Error('Failed to add Sepolia network. Please add it manually in MetaMask.');
        }
      } else {
        throw switchError;
      }
    }
  };

  const connectWallet = async () => {
    try {
      // Guard for missing provider (prevents inpage.js errors when extension is absent/disabled)
      try {
        if (!window.ethereum || !window.ethereum.isMetaMask) {
          throw new Error('MetaMask extension not found. Please install or enable MetaMask and refresh.');
        }
      } catch (providerError) {
        // Catch any inpage.js errors before attempting connection
        throw new Error('MetaMask extension not found. Please install or enable MetaMask and refresh.');
      }

      setLoading(true);

      // Check current network
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      // Sepolia chain ID is 11155111
      if (network.chainId !== 11155111n) {
        console.log('Switching to Sepolia testnet...');
        await switchToSepolia();
      }

      // Request account access
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Verify we're on Sepolia after switching
      const finalNetwork = await provider.getNetwork();
      if (finalNetwork.chainId !== 11155111n) {
        throw new Error('Please switch to Sepolia testnet in MetaMask');
      }

      setProvider(provider);
      setSigner(signer);
      setAccount(address);

      // Initialize contract if info is available
      if (contractInfo) {
        const contractInstance = new ethers.Contract(
          contractInfo.address,
          contractInfo.abi,
          signer
        );
        setContract(contractInstance);
      }

      return { success: true, address };
    } catch (error) {
      console.error('Wallet connection error:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect wallet'
      };
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setContract(null);
  };

  const initializeContract = useCallback(() => {
    if (signer && contractInfo) {
      const contractInstance = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        signer
      );
      setContract(contractInstance);
    }
  }, [signer, contractInfo]);

  useEffect(() => {
    if (signer && contractInfo && !contract) {
      initializeContract();
    }
  }, [signer, contractInfo, contract, initializeContract]);

  const value = {
    provider,
    signer,
    account,
    contract,
    contractInfo,
    loading,
    connectWallet,
    disconnectWallet,
    isConnected: !!account
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};






