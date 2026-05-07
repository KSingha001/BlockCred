# Grant APPROVER_ROLE via Etherscan (Easiest Method)

## Step-by-Step Instructions:

1. **Open Etherscan Write Contract Page:**
   - Go to: https://sepolia.etherscan.io/address/0x0eF4895C83697901Bd127a5631c47474AdE05a50#writeContract

2. **Connect Your Wallet:**
   - Click "Connect to Web3" button
   - Connect MetaMask
   - **IMPORTANT**: Make sure the connected wallet is the contract owner: `0x95c61CF6f437D9Cf9f2A99B7C41E4083c54ec8a4`

3. **Find the Function:**
   - Scroll down to find `setApproverRole` function (function #7 or #8)
   - It should show: `setApproverRole(address account)`

4. **Enter the Address:**
   - In the `account` field, enter: `0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6`

5. **Write the Transaction:**
   - Click "Write" button
   - MetaMask will pop up - confirm the transaction
   - Wait for confirmation (usually 1-2 minutes on Sepolia)

6. **Verify It Worked:**
   - Go to: https://sepolia.etherscan.io/address/0x0eF4895C83697901Bd127a5631c47474AdE05a50#readContract
   - Find `hasRole` function
   - Enter:
     - `role`: `0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf`
     - `account`: `0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6`
   - Click "Query" - should return `true`

## Troubleshooting:

- **"unauthorized" error**: Make sure you're connected with the owner wallet (`0x95c61CF6f437D9Cf9f2A99B7C41E4083c54ec8a4`)
- **"insufficient funds"**: Make sure the owner wallet has Sepolia ETH for gas
- **Transaction fails**: Check the transaction details on Etherscan for the exact error

