const hre = require("hardhat");

/**
 * Script to check if an address has a specific role
 * Usage: npx hardhat run scripts/checkRole.js --network sepolia
 */
async function main() {
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const ADDRESS_TO_CHECK = process.env.APPROVER_ADDRESS || process.argv[2];
  const ROLE_TO_CHECK = process.argv[3] || "APPROVER_ROLE";
  
  if (!CONTRACT_ADDRESS) {
    console.error("❌ Error: Please set CONTRACT_ADDRESS in .env file");
    process.exit(1);
  }

  if (!ADDRESS_TO_CHECK) {
    console.error("❌ Error: Please provide address to check");
    console.error("Usage: APPROVER_ADDRESS=0x... npx hardhat run scripts/checkRole.js --network sepolia");
    console.error("Or: npx hardhat run scripts/checkRole.js --network sepolia 0x... APPROVER_ROLE");
    process.exit(1);
  }

  console.log("📝 Contract address:", CONTRACT_ADDRESS);
  console.log("📝 Address to check:", ADDRESS_TO_CHECK);
  console.log("📝 Role to check:", ROLE_TO_CHECK);
  console.log("");

  const StudentRecords = await hre.ethers.getContractFactory("StudentRecords");
  const contract = StudentRecords.attach(CONTRACT_ADDRESS);

  // Calculate role hash
  const roleHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(ROLE_TO_CHECK));
  console.log("📝 Role hash:", roleHash);
  console.log("");

  // Check if address has the role
  const hasRole = await contract.hasRole(roleHash, ADDRESS_TO_CHECK);
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (hasRole) {
    console.log("✅ YES - Address HAS the", ROLE_TO_CHECK);
  } else {
    console.log("❌ NO - Address does NOT have the", ROLE_TO_CHECK);
    console.log("");
    console.log("To grant this role, run:");
    console.log(`APPROVER_ADDRESS=${ADDRESS_TO_CHECK} npx hardhat run scripts/grantApproverRole.js --network sepolia`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Also check who the owner is
  const owner = await contract.owner();
  console.log("📝 Contract owner:", owner);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

