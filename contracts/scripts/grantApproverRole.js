const hre = require("hardhat");

/**
 * Script to grant APPROVER_ROLE to a specific address
 * Usage: npx hardhat run scripts/grantApproverRole.js --network sepolia
 * 
 * Set APPROVER_ADDRESS in .env file or pass as command line argument
 * Example: APPROVER_ADDRESS=0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6 npx hardhat run scripts/grantApproverRole.js --network sepolia
 */
async function main() {
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  
  if (!CONTRACT_ADDRESS) {
    console.error("❌ Error: Please set CONTRACT_ADDRESS in .env file");
    console.error("Example: CONTRACT_ADDRESS=0x...");
    process.exit(1);
  }

  // Get approver address from environment or command line
  const APPROVER_ADDRESS = process.env.APPROVER_ADDRESS || process.argv[2];
  
  if (!APPROVER_ADDRESS) {
    console.error("❌ Error: Please provide APPROVER_ADDRESS");
    console.error("Usage: APPROVER_ADDRESS=0x... npx hardhat run scripts/grantApproverRole.js --network sepolia");
    console.error("Or: npx hardhat run scripts/grantApproverRole.js --network sepolia 0xaE86A4CeF2EE94367b7Dedb7Ab94C182AD37D9f6");
    process.exit(1);
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(APPROVER_ADDRESS)) {
    console.error("❌ Error: Invalid Ethereum address format");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("📝 Using account:", signer.address);
  console.log("📝 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "ETH");
  console.log("📝 Contract address:", CONTRACT_ADDRESS);
  console.log("📝 Approver address to grant role:", APPROVER_ADDRESS);
  console.log("");

  const StudentRecords = await hre.ethers.getContractFactory("StudentRecords");
  const contract = StudentRecords.attach(CONTRACT_ADDRESS);
  
  // Check who the actual owner is
  const contractOwner = await contract.owner();
  console.log("📝 Contract owner (from contract):", contractOwner);
  console.log("📝 Your address:", signer.address);
  
  if (contractOwner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ ERROR: Your address is not the contract owner!");
    console.error("   Contract owner:", contractOwner);
    console.error("   Your address:", signer.address);
    console.error("");
    console.error("💡 Solution: Use the private key of the contract owner in your .env file");
    console.error("   The owner address is:", contractOwner);
    process.exit(1);
  }
  
  console.log("✅ Verified: You are the contract owner");
  console.log("");

  // Check if address already has the role
  const APPROVER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("APPROVER_ROLE"));
  const hasRole = await contract.hasRole(APPROVER_ROLE, APPROVER_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Address already has APPROVER_ROLE");
    process.exit(0);
  }

  // Verify we're the owner
  const owner = await contract.owner();
  console.log("📝 Contract owner:", owner);
  console.log("📝 Current signer:", signer.address);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ Error: Current account is not the contract owner!");
    console.error("Expected owner:", owner);
    console.error("Current account:", signer.address);
    process.exit(1);
  }

  console.log("⏳ Granting APPROVER_ROLE...");
  try {
    // Try to estimate gas first to catch errors early
    console.log("⏳ Estimating gas...");
    const gasEstimate = await contract.setApproverRole.estimateGas(APPROVER_ADDRESS);
    console.log("✓ Gas estimate:", gasEstimate.toString());
    
    const tx = await contract.setApproverRole(APPROVER_ADDRESS);
    console.log("📤 Transaction sent:", tx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log("✅ APPROVER_ROLE granted successfully!");
    console.log("📄 Transaction hash:", tx.hash);
    console.log("📄 Block number:", receipt.blockNumber);
    console.log("🔗 View on Etherscan:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    
    // Verify the role was granted
    const hasRoleAfter = await contract.hasRole(APPROVER_ROLE, APPROVER_ADDRESS);
    if (hasRoleAfter) {
      console.log("✅ Verification: Role confirmed on-chain!");
    } else {
      console.log("⚠️ Warning: Role check returned false after granting. Please verify on Etherscan.");
    }
  } catch (error) {
    console.error("❌ Error granting role:");
    console.error("Message:", error.message);
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    // Check for specific error types
    if (error.message?.includes("OwnableUnauthorizedAccount") || 
        error.reason?.includes("OwnableUnauthorizedAccount") ||
        error.message?.includes("not the owner")) {
      console.error("❌ You are not the contract owner!");
      console.error("Contract owner:", await contract.owner());
      console.error("Your address:", owner.address);
    }

    if (error.reason) {
      console.error("Decoded reason:", error.reason);
    }

    if (error.data) {
      console.error("Error data:", error.data);
    }

    if (error.error?.message) {
      console.error("Nested message:", error.error.message);
    }
    
    if (error.message?.includes("AccessControl") || error.reason?.includes("AccessControl")) {
      console.error("❌ Access control error - check permissions");
    }
    
    // Try to decode the error if it's a revert
    if (error.code === 'CALL_EXCEPTION' || error.code === 'ACTION_REJECTED') {
      console.error("❌ Transaction was reverted. Possible reasons:");
      console.error("  1. You are not the contract owner");
      console.error("  2. The address already has the role");
      console.error("  3. Insufficient gas");
      console.error("  4. Contract function error");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

