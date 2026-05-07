# How to Grant APPROVER_ROLE

## Your Details:
- **Contract Address**: `0x0eF4895C83697901Bd127a5631c47474AdE05a50`
- **Wallet to Grant Role**: `0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6`

## Step 1: Update your `.env` file

Open `contracts/.env` and make sure it has:

```env
CONTRACT_ADDRESS=0x0eF4895C83697901Bd127a5631c47474AdE05a50
APPROVER_ADDRESS=0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_contract_owner_private_key_here
```

**Important**: The `PRIVATE_KEY` must be the private key of the contract owner (the address that deployed the contract).

## Step 2: Run the grant script

```powershell
cd D:\Sample_Doc_Pro1\contracts
npx hardhat run scripts/grantApproverRole.js --network sepolia
```

Or if you prefer using the general grantRoles script:

```powershell
npx hardhat run scripts/grantRoles.js --network sepolia
```

## Step 3: Verify the role was granted

After running the script, verify it worked:

```powershell
npx hardhat run scripts/checkRole.js --network sepolia
```

You should see: `✅ YES - Address HAS the APPROVER_ROLE`

## Alternative: Grant via Etherscan

1. Go to: https://sepolia.etherscan.io/address/0x0eF4895C83697901Bd127a5631c47474AdE05a50#writeContract
2. Connect your wallet (must be the contract owner)
3. Find the `setApproverRole` function
4. Enter: `0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6`
5. Click "Write" and confirm the transaction

## Troubleshooting

- **"insufficient funds"**: Make sure the contract owner wallet has Sepolia ETH
- **"unauthorized"**: Make sure you're using the contract owner's private key
- **"contract not found"**: Check that CONTRACT_ADDRESS is correct

