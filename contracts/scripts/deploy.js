const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const StudentRecords = await hre.ethers.getContractFactory("StudentRecords");
  const studentRecords = await StudentRecords.deploy(deployer.address);

  await studentRecords.waitForDeployment();

  const contractAddress = await studentRecords.getAddress();
  console.log("StudentRecords deployed to:", contractAddress);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    address: contractAddress,
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    "./deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });






