require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config({ path: '../.env' });

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [process.env.BOT_PRIVATE_KEY]
    }
  }
};
