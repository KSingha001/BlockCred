const hre = require("hardhat");

/**
 * Script to grant roles to addresses
 * Usage: npx hardhat run scripts/grantRoles.js --network sepolia
 */
async function main() {
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  
  if (!CONTRACT_ADDRESS) {
    console.error("Please set CONTRACT_ADDRESS in .env");
    process.exit(1);
  }

  const [owner] = await hre.ethers.getSigners();
  console.log("Using account:", owner.address);

  const StudentRecords = await hre.ethers.getContractFactory("StudentRecords");
  const contract = StudentRecords.attach(CONTRACT_ADDRESS);

  // Example: Grant roles to addresses
  // Replace these with actual addresses
  const APPROVER_ADDRESS = process.env.APPROVER_ADDRESS || "";
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "";
  const EMPLOYER_ADDRESS = process.env.EMPLOYER_ADDRESS || "";

  if (APPROVER_ADDRESS) {
    console.log("Granting APPROVER_ROLE to:", APPROVER_ADDRESS);
    const tx1 = await contract.setApproverRole(APPROVER_ADDRESS);
    await tx1.wait();
    console.log("✓ APPROVER_ROLE granted");
  }

  if (VERIFIER_ADDRESS) {
    console.log("Granting VERIFIER_ROLE to:", VERIFIER_ADDRESS);
    const tx2 = await contract.setVerifierRole(VERIFIER_ADDRESS);
    await tx2.wait();
    console.log("✓ VERIFIER_ROLE granted");
  }

  if (EMPLOYER_ADDRESS) {
    console.log("Granting EMPLOYER_ROLE to:", EMPLOYER_ADDRESS);
    const tx3 = await contract.setEmployerRole(EMPLOYER_ADDRESS);
    await tx3.wait();
    console.log("✓ EMPLOYER_ROLE granted");
  }

  console.log("Role granting complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });






