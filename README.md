# Blockchain-based Student Record & Marksheet Verification System

A decentralized system for verifying student records and marksheets using Ethereum (Sepolia testnet) and IPFS (Pinata).

## Tech Stack

- **Smart Contract**: Solidity (OpenZeppelin)
- **Blockchain**: Ethereum Sepolia Testnet
- **IPFS**: Pinata
- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Ethers.js + MetaMask
- **Development**: Hardhat

## Project Structure

```
├── contracts/          # Solidity smart contracts
├── backend/            # Express API server
├── frontend/           # React application
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- MetaMask browser extension
- MongoDB (local or Atlas)
- Pinata account (for IPFS) - Sign up at https://pinata.cloud
- Sepolia ETH (for gas fees) - Get from https://sepoliafaucet.com
- Infura or Alchemy account (for Sepolia RPC)

### 1. Smart Contract Setup

```bash
cd contracts
npm install

# Create .env file with:
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
# PRIVATE_KEY=your_private_key_with_sepolia_eth

npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, save the contract address from `deployment.json` for backend and frontend configuration.

**Important**: After deploying, you need to grant roles:
- Grant UPLOADER_ROLE to college wallet addresses
- Grant VERIFIER_ROLE to admin wallet addresses
- Grant EMPLOYER_ROLE to employer wallet addresses (optional)

You can do this by calling the contract functions:
- `setUploaderRole(address)`
- `setVerifierRole(address)`
- `setEmployerRole(address)`

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file (copy from .env.example)
# Fill in:
# - MONGODB_URI (local or MongoDB Atlas connection string)
# - PINATA_API_KEY and PINATA_SECRET_KEY (from Pinata dashboard)
# - CONTRACT_ADDRESS (from contract deployment)
# - SEPOLIA_RPC_URL
# - JWT_SECRET (any random string)
# - PORT (default: 5000)

npm start
# or for development: npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Create .env file (copy from .env.example)
# Fill in:
# - REACT_APP_API_URL (backend URL, e.g., http://localhost:5000)
# - REACT_APP_CONTRACT_ADDRESS (from contract deployment)
# - REACT_APP_SEPOLIA_RPC_URL (optional, for direct contract reads)

npm start
```

The frontend will open at http://localhost:3000

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/student-verification
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret
CONTRACT_ADDRESS=0x...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
PRIVATE_KEY=your_private_key (optional, for backend transactions)
JWT_SECRET=your_jwt_secret
PORT=5000
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_CONTRACT_ADDRESS=0x...
REACT_APP_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
```

## Roles

- **College**: Upload student records and marksheets
- **Admin**: Verify/approve records
- **Student**: View own verified records
- **Employer**: View all verified records

## Features

- Upload marksheet PDFs to IPFS (Pinata)
- Store verification metadata on Ethereum (Sepolia testnet)
- Role-based access control (College, Admin, Student, Employer)
- View and download verified records
- Search functionality for employers
- Blockchain transaction verification
- IPFS-based document storage

## User Workflows

### College User
1. Register/Login with college role
2. Connect MetaMask wallet (must have UPLOADER_ROLE on contract)
3. Upload student details and marksheet PDF
4. System uploads PDF to Pinata (IPFS)
5. Sign transaction to record metadata on blockchain
6. Record appears in dashboard with transaction hash

### Admin User
1. Register/Login with admin role
2. Connect MetaMask wallet (must have VERIFIER_ROLE on contract)
3. View pending records
4. Click "Verify" to approve records on-chain
5. Record status changes to "Verified"

### Student User
1. Register/Login with student role (include USN)
2. View own verified records
3. Download marksheet PDFs from IPFS
4. Verify authenticity via blockchain transaction links

### Employer User
1. Register/Login with employer role
2. Search verified student records
3. View student details and download marksheets
4. Verify records on Sepolia block explorer

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/wallet` - Update wallet address

### Pinata/IPFS
- `POST /api/pinata/pinFile` - Upload file to Pinata (requires auth, college/admin role)
- `GET /api/pinata/file/:cid` - Get file from IPFS

### Records
- `POST /api/records/create` - Create record in MongoDB (college/admin)
- `GET /api/records/:usn` - Get record by USN
- `GET /api/records` - List records (employer/admin, shows verified only for employers)
- `PUT /api/records/:usn/tx` - Update record with transaction hash
- `PUT /api/records/:usn/verify` - Update verification status (admin)
- `GET /api/records/student/my-records` - Get student's own records

### Transactions
- `GET /api/tx/:txHash` - Get transaction status
- `POST /api/tx/prepare` - Prepare upload transaction (college/admin)
- `POST /api/tx/prepare-verify` - Prepare verify transaction (admin)
- `GET /api/tx/contract/info` - Get contract address and ABI

## License

MIT

