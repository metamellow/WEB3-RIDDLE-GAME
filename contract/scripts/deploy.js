const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Deploying OnchainRiddle...");
  
  const OnchainRiddle = await hre.ethers.getContractFactory("OnchainRiddle");
  const riddle = await OnchainRiddle.deploy();
  await riddle.waitForDeployment();
  
  const address = await riddle.getAddress();
  console.log("Contract deployed to:", address);
  
  // Create config directory if it doesn't exist
  const configDir = path.join(__dirname, '../../src/config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Get ABI from artifacts
  const artifactPath = path.join(__dirname, '../artifacts/contracts/OnchainRiddle.sol/OnchainRiddle.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  // Save to frontend config
  const configPath = path.join(configDir, 'contract.js');
  const configContent = `export const CONTRACT_ADDRESS = "${address}";\n\n` +
    `export const CONTRACT_ABI = ${JSON.stringify(artifact.abi, null, 2)};`;
  
  fs.writeFileSync(configPath, configContent);
  console.log("Config updated!");
  
  // Set first riddle
  const riddlesPath = path.join(__dirname, '../../riddles.json');
  if (fs.existsSync(riddlesPath)) {
    const riddles = JSON.parse(fs.readFileSync(riddlesPath, 'utf8'));
    const tx = await riddle.setRiddle(riddles[0].question, riddles[0].answerHash);
    await tx.wait();
    console.log("First riddle set!");
  } else {
    console.log("riddles.json not found, skipping first riddle set.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
