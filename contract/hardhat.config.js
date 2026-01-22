require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config({ path: '../.env' });
const rpcList = require('../rpc-list.json');

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: rpcList[0],
      accounts: [process.env.BOT_PRIVATE_KEY]
    }
  }
};