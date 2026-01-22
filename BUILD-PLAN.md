# 🎮 ON-CHAIN RIDDLE GAME - Ultimate Build Guide

> **Style:** Yellow-on-black CRT terminal with mechanical flip-clock animation  
> **Stack:** React + Vite + Wagmi + Hardhat + Netlify  
> **Network:** Ethereum Sepolia Testnet

---

## 🗺️ Project Overview

### User Flow
1. **User arrives** → Sees current riddle
2. **Types answer** → Simple text input (no flip animation yet)
3. **Hits SUBMIT** → Transaction sent
4. **Flip animation starts** → Letters flip mechanically while tx confirms
5. **Result appears** → Green cascade (correct) or red shake (wrong)
6. **Bot triggers** → If correct, bot posts new riddle
7. **Repeat** → New riddle appears automatically

### 📁 File Structure
```text
WEB3-RIDDLE-GAME/
├── contract/               # Hardhat Project
│   ├── contracts/          # Smart Contracts
│   └── scripts/            # Deployment Scripts
├── netlify/
│   └── functions/          # Bot (Serverless Function)
├── public/
│   └── sounds/             # checking.mp3, success.mp3, error.mp3
├── src/                    # React Frontend
│   ├── components/         # UI Components
│   ├── config/             # Wagmi & Contract Config
│   └── hooks/              # Custom Hooks
├── rpc-list.json           # Centralized RPC Failover List
├── riddles.json            # Generated Riddle List
├── index.html              # Entry Point
└── vite.config.js          # Vite Configuration
```

---

## 🛠️ PART 1: Project Setup

### 1. Initialize Root Project
Run these commands in your project root:

```bash
# Initialize project and install frontend deps
npm init -y
npm pkg set type="module"
npm install vite @vitejs/plugin-react react react-dom wagmi viem @tanstack/react-query

# Install Netlify CLI for the bot
npm install -g netlify-cli
```

### 2. Centralized RPC List
Create `rpc-list.json` in the root. This ensures that if one provider fails, the game stays alive.

```json
[
  "https://0xrpc.io/sep",
  "https://sepolia.gateway.tenderly.co",
  "https://ethereum-sepolia-public.nodies.app",
  "https://1rpc.io/sepolia",
  "https://eth-sepolia.api.onfinality.io/public"
]
```

### 3. Core HTML (`index.html`)
Create `index.html` in the root.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Riddle Game</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 4. Vite Config (`vite.config.js`)
Create `vite.config.js` in the root.

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

---

## ⛓️ PART 2: Smart Contract (Hardhat)

### 1. Setup Hardhat
We use Hardhat v2 (CommonJS) in a subfolder for maximum stability.

```bash
mkdir contract && cd contract
npm init -y
npm install --save-dev hardhat@2.22.17 @nomicfoundation/hardhat-toolbox@5.0.0 dotenv --legacy-peer-deps
npx hardhat init # Choose "Create a JavaScript project"
cd ..
```

### 2. OnchainRiddle.sol
Create `contract/contracts/OnchainRiddle.sol`.

From: https://github.com/poppyseedDev/solidity-riddle/blob/main/contracts/OnchainRiddle.
sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OnchainRiddle {
    address public bot;
    string public riddle;
    bytes32 private answerHash;
    address public winner;
    bool public isActive;

    event RiddleSet(string riddle);
    event AnswerAttempt(address indexed user, bool correct);
    event Winner(address indexed user);

    modifier onlyBot() {
        require(msg.sender == bot, "Only bot");
        _;
    }

    constructor() {
        bot = msg.sender;
    }

    function setRiddle(string memory _riddle, bytes32 _answerHash) external onlyBot {
        require(!isActive, "Already active");
        riddle = _riddle;
        answerHash = _answerHash;
        isActive = true;
        winner = address(0);
        emit RiddleSet(_riddle);
    }

    function submitAnswer(string memory _answer) external {
        require(isActive, "No active riddle");
        require(winner == address(0), "Already solved");
        
        bool correct = keccak256(abi.encodePacked(_answer)) == answerHash;
        
        if (correct) {
            winner = msg.sender;
            isActive = false;
            emit Winner(msg.sender);
        }
        
        emit AnswerAttempt(msg.sender, correct);
    }
}
```

### 3. Hardhat Config
Update `contract/hardhat.config.js`.

```javascript
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
```

### 4. Deploy Script
Create `contract/scripts/deploy.js`. This script auto-updates your frontend config after deployment.

```javascript
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
  
  const configDir = path.join(__dirname, '../../src/config');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/OnchainRiddle.sol/OnchainRiddle.json'), 'utf8'));

  const configPath = path.join(configDir, 'contract.js');
  const configContent = `export const CONTRACT_ADDRESS = "${address}";\n\n` +
    `export const CONTRACT_ABI = ${JSON.stringify(artifact.abi, null, 2)};`;
  
  fs.writeFileSync(configPath, configContent);
  console.log("Config updated!");
  
  const riddlesPath = path.join(__dirname, '../../riddles.json');
  if (fs.existsSync(riddlesPath)) {
    const riddles = JSON.parse(fs.readFileSync(riddlesPath, 'utf8'));
    const tx = await riddle.setRiddle(riddles[0].question, riddles[0].answerHash);
    await tx.wait();
    console.log("First riddle set!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 🤖 PART 3: Riddle & Bot Setup

### 1. Generate Riddles
Create `scripts/generate-riddles.js`. This creates the `riddles.json` file used by the deploy script and the bot.

```javascript
import { keccak256, toBytes } from 'viem'
import fs from 'fs'

const riddlesWithAnswers = [
  { q: "I have cities, but no houses. I have mountains, but no trees. I have water, but 
  no fish. What am I?", a: "MAP" },
  { q: "The more you take, the more you leave behind. What am I?", a: "FOOTSTEPS" },
  { q: "I speak without a mouth and hear without ears. I have no body, but I come alive 
  with the wind. What am I?", a: "ECHO" },
  { q: "I'm tall when I'm young and short when I'm old. What am I?", a: "CANDLE" },
  { q: "What has hands but cannot clap?", a: "CLOCK" },
  { q: "What has a head and a tail but no body?", a: "COIN" },
  { q: "What can you catch but never throw?", a: "COLD" },
  { q: "What gets wetter the more it dries?", a: "TOWEL" },
  { q: "I have teeth but cannot bite. What am I?", a: "COMB" },
  { q: "What can fill a room but takes up no space?", a: "LIGHT" },
  { q: "What has one eye but cannot see?", a: "NEEDLE" },
  { q: "What can travel around the world while staying in a corner?", a: "STAMP" },
  { q: "What has a neck but no head?", a: "BOTTLE" },
  { q: "What has words but never speaks?", a: "BOOK" },
  { q: "What runs but never walks?", a: "WATER" },
  { q: "I fly without wings. I cry without eyes. What am I?", a: "CLOUD" },
  { q: "What has keys but no locks?", a: "KEYBOARD" },
  { q: "What can you break without touching it?", a: "PROMISE" },
  { q: "What has a thumb and four fingers but is not alive?", a: "GLOVE" },
  { q: "What goes up but never comes down?", a: "AGE" },
  { q: "What can be cracked, made, told, and played?", a: "JOKE" },
  { q: "I am always hungry and will die if not fed. What am I?", a: "FIRE" },
  { q: "The more you remove from me, the bigger I get. What am I?", a: "HOLE" },
  { q: "What has legs but cannot walk?", a: "TABLE" },
  { q: "What comes once in a minute, twice in a moment, but never in a thousand years?", 
  a: "M" },
  { q: "What is black when it's clean and white when it's dirty?", a: "CHALKBOARD" },
  { q: "What can you hold without touching it?", a: "BREATH" },
  { q: "What has a face and two hands but no arms or legs?", a: "CLOCK" },
  { q: "What building has the most stories?", a: "LIBRARY" },
  { q: "What has ears but cannot hear?", a: "CORN" },
  { q: "I shave every day but my beard stays the same. What am I?", a: "BARBER" },
  { q: "What invention lets you look right through a wall?", a: "WINDOW" },
  { q: "What has branches but no fruit, trunk, or leaves?", a: "BANK" },
  { q: "What five-letter word becomes shorter when you add two letters?", a: "SHORT" },
  { q: "What is always in front of you but cannot be seen?", a: "FUTURE" },
  { q: "What belongs to you but others use it more than you do?", a: "NAME" },
  { q: "What word is spelled incorrectly in every dictionary?", a: "WRONG" },
  { q: "I follow you all the time but you can never touch me. What am I?", a: "SHADOW" },
  { q: "What goes through cities and fields but never moves?", a: "ROAD" },
  { q: "What can you keep after giving it to someone?", a: "WORD" },
  { q: "What is full of holes but still holds water?", a: "SPONGE" },
  { q: "I am not alive but I grow. I don't have lungs but I need air. What am I?", a: 
  "FIRE" },
  { q: "What can run but never walks, has a mouth but never talks?", a: "RIVER" },
  { q: "What begins with T, ends with T, and has T in it?", a: "TEAPOT" },
  { q: "What goes up and down but doesn't move?", a: "STAIRS" },
  { q: "What word contains 26 letters but only three syllables?", a: "ALPHABET" },
  { q: "What tastes better than it smells?", a: "TONGUE" },
  { q: "What is easy to get into but hard to get out of?", a: "TROUBLE" },
  { q: "I turn once, what is out will not get in. I turn again, what is in will not get 
  out. What am I?", a: "KEY" },
  { q: "What kind of coat can only be put on when wet?", a: "PAINT" },
  { q: "What do you bury when it's alive and dig up when it's dead?", a: "PLANT" },
  { q: "People make me, save me, change me, and raise me. What am I?", a: "MONEY" },
  { q: "I have a head, a tail, but no legs. What am I?", a: "COIN" },
  { q: "What kind of room has no doors or windows?", a: "MUSHROOM" },
  { q: "If you drop me, I'm sure to crack. Give me a smile and I'll smile back. What am 
  I?", a: "MIRROR" },
  { q: "What is so fragile that saying its name breaks it?", a: "SILENCE" },
  { q: "What has a ring but no finger?", a: "PHONE" },
  { q: "I am taken from a mine and shut in a wooden case. What am I?", a: "PENCIL" },
  { q: "What gets sharper the more you use it?", a: "BRAIN" },
  { q: "What has many keys but can't open a single lock?", a: "PIANO" },
  { q: "What word looks the same upside down and backwards?", a: "SWIMS" },
  { q: "What comes down but never goes up?", a: "RAIN" },
  { q: "What has an eye but cannot see?", a: "STORM" },
  { q: "What is harder to catch the faster you run?", a: "BREATH" },
  { q: "What has a bed but never sleeps?", a: "RIVER" },
  { q: "What has four fingers and a thumb but isn't alive?", a: "GLOVE" },
  { q: "What is lighter than air but impossible to lift?", a: "BUBBLE" },
  { q: "What is at the end of a rainbow?", a: "W" },
  { q: "What starts with E, ends with E, but only has one letter?", a: "ENVELOPE" },
  { q: "What runs around a yard without moving?", a: "FENCE" },
  { q: "What is cut on a table but never eaten?", a: "CARDS" },
  { q: "What has roots that nobody sees and grows taller than trees?", a: "MOUNTAIN" },
  { q: "What disappears the moment you say its name?", a: "SILENCE" },
  { q: "What thrives when you feed it but dies when you water it?", a: "FIRE" },
  { q: "What has 88 keys but cannot open a single door?", a: "PIANO" },
  { q: "What has a spine but no bones?", a: "BOOK" },
  { q: "What can be swallowed, but can also swallow you?", a: "PRIDE" },
  { q: "What becomes smaller when you turn it upside down?", a: "NINE" },
  { q: "Forward I am heavy, backward I am not. What am I?", a: "TON" },
  { q: "What kind of tree can you carry in your hand?", a: "PALM" },
  { q: "I can be long or short. I can be grown or bought. What am I?", a: "HAIR" },
  { q: "What has a bark but no bite?", a: "TREE" },
  { q: "What gets broken without being held?", a: "PROMISE" },
  { q: "I am a seed with three letters in my name. Take away two and I sound the same. 
  What am I?", a: "PEA" },
  { q: "What goes from Z to A?", a: "ZEBRA" },
  { q: "What wears a cap but has no head?", a: "BOTTLE" },
  { q: "What do you answer even though it never asks you a question?", a: "PHONE" },
  { q: "What word of five letters has one left when two letters are removed?", a: 
  "STONE" },
  { q: "What is deaf, dumb, and blind but always tells the truth?", a: "MIRROR" },
  { q: "I am an odd number. Take away a letter and I become even. What am I?", a: 
  "SEVEN" },
  { q: "What has a bottom at the top?", a: "LEGS" },
  { q: "What can be seen but never touched?", a: "SHADOW" },
  { q: "What has wheels and flies but is not an aircraft?", a: "GARBAGE" },
  { q: "What loses its head in the morning and gets it back at night?", a: "PILLOW" },
  { q: "What is bought by the yard and worn by the foot?", a: "CARPET" },
  { q: "What has a head, a tail, is brown, and has no legs?", a: "PENNY" },
  { q: "What can honk without a horn?", a: "GOOSE" },
  { q: "What has cities, but no houses; forests, but no trees; and water, but no fish?", 
  a: "MAP" },
  { q: "What falls but never breaks, and breaks but never falls?", a: "DAY" },
  { q: "What can go up a chimney down but can't go down a chimney up?", a: "UMBRELLA" },
]

const riddles = riddlesWithAnswers.map(r => ({
  question: r.q,
  answerHash: keccak256(toBytes(r.a))
}))

fs.writeFileSync('riddles.json', JSON.stringify(riddles, null, 2))
console.log(`✓ Generated ${riddles.length} riddles`)
```

### 2. Bot Function (`netlify/functions/new-riddle.js`)
This bot handles the automatic riddle refresh securely using your private key and RPC rotation.

```javascript
import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import fs from 'fs'
import path from 'path'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY
const rpcListPath = path.resolve(process.cwd(), 'rpc-list.json')
const RPC_LIST = JSON.parse(fs.readFileSync(rpcListPath, 'utf8'))

const ABI = [
  { inputs: [], name: 'isActive', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_riddle', type: 'string' }, { name: '_answerHash', type: 'bytes32' }], name: 'setRiddle', outputs: [], type: 'function' },
  { anonymous: false, inputs: [{ indexed: false, name: 'riddle', type: 'string' }], name: 'RiddleSet', type: 'event' }
]

async function withRpcRotation(action) {
  let lastError;
  for (const rpcUrl of RPC_LIST) {
    try { return await action(rpcUrl); } 
    catch (e) { console.warn(`RPC failed: ${rpcUrl}`); lastError = e; }
  }
  throw lastError;
}

export async function handler() {
  try {
    const riddles = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'riddles.json'), 'utf8'))
    const account = privateKeyToAccount(BOT_PRIVATE_KEY.startsWith('0x') ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`)

    const isActive = await withRpcRotation(async (url) => {
      const client = createPublicClient({ chain: sepolia, transport: http(url) })
      return await client.readContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'isActive' })
    })

    if (isActive) return { statusCode: 200, body: JSON.stringify({ message: 'Active' }) }

    const logs = await withRpcRotation(async (url) => {
      const client = createPublicClient({ chain: sepolia, transport: http(url) })
      return await client.getLogs({ address: CONTRACT_ADDRESS, event: ABI[2], fromBlock: 0n })
    })

    const next = riddles[logs.length % riddles.length]
    const hash = await withRpcRotation(async (url) => {
      const pClient = createPublicClient({ chain: sepolia, transport: http(url) })
      const wClient = createWalletClient({ account, chain: sepolia, transport: http(url) })
      const tx = await wClient.writeContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'setRiddle', args: [next.question, next.answerHash] })
      await pClient.waitForTransactionReceipt({ hash: tx })
      return tx
    })

    return { statusCode: 200, body: JSON.stringify({ txHash: hash }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
```

---

## 🎨 PART 4: Frontend Implementation

### 1. Main Entry (`src/main.jsx`)
Entry point for the React application.

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import App from './App'
import './App.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
```

### 2. Global Styles (`src/App.css`)
CRT terminal styling and flip-clock animations.

```css
@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

:root {
  --yellow: #FFE81F;
  --black: #0a0a0a;
  --gray: #1a1a1a;
  --green:rgb(106, 255, 86);
  --red:rgb(255, 0, 85);
}

body {
  background: var(--black);
  color: var(--yellow);
  font-family: 'VT323', monospace;
  overflow: hidden;
}

.terminal {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px);
  z-index: 1000;
}

.container { text-align: center; padding: 2rem; }
.title { font-size: 3rem; margin-bottom: 3rem; text-shadow: 0 0 20px var(--yellow); }
.riddle { border: 2px solid var(--yellow); padding: 2rem; margin-bottom: 3rem; }

.flip-clock { display: flex; gap: 10px; justify-content: center; margin: 3rem 0; }
.flip-letter { width: 50px; height: 70px; background: var(--gray); border: 2px solid #333; position: relative; perspective: 300px; }
.flip-letter.flipping .flip-inner { animation: flip 0.4s ease-in-out infinite; }

@keyframes flip {
  0%, 100% { transform: rotateX(0); }
  50% { transform: rotateX(-90deg); }
}

.winner { color: var(--green); font-size: 2.5rem; margin: 2rem 0; animation: pulse 0.8s infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }

button {
  background: transparent; border: 2px solid var(--yellow); color: var(--yellow);
  padding: 15px 40px; font-family: 'VT323'; cursor: pointer; transition: 0.2s;
}
button:hover:not(:disabled) { background: var(--yellow); color: var(--black); box-shadow: 0 0 30px var(--yellow); }
```

### 3. Wagmi Config (`src/config/wagmi.js`)
Handles blockchain connection with RPC failover.

```javascript
import { createConfig, http, fallback } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import rpcList from '../../rpc-list.json'

const transports = rpcList.map(url => http(url))

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: fallback(transports) },
})
```

### 4. Riddle Hook (`src/hooks/useRiddle.js`)
Manages contract state and answer submission.

```javascript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useEffect, useCallback } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'

export function useRiddle() {
  const { data: riddle, refetch: refetchRiddle } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'riddle' })
  const { data: isActive, refetch: refetchActive } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'isActive' })
  const { data: winner, refetch: refetchWinner } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'winner' })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const refetchAll = useCallback(async () => {
    const [r, a, w] = await Promise.all([refetchRiddle(), refetchActive(), refetchWinner()])
    return { riddle: r.data, isActive: a.data, winner: w.data }
  }, [refetchRiddle, refetchActive, refetchWinner])

  const submitAnswer = (answer) => {
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'submitAnswer', args: [answer.toUpperCase()] })
  }

  return { riddle, isActive, winner, submitAnswer, isChecking: isPending || isConfirming, isSuccess, isError, hash, refetchAll }
}
```

### 5. Components (`src/components/`)

**FlipClock.jsx**
```jsx
function FlipClock({ value, maxLength, isChecking, result }) {
  const letters = value.padEnd(maxLength, ' ').split('')
  return (
    <div className="flip-clock">
      {letters.map((l, i) => (
        <div key={i} className={`flip-letter ${i < value.length ? 'filled' : ''} ${isChecking && i < value.length ? 'flipping' : ''} ${result && i < value.length ? result : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="flip-inner"><span>{l}</span></div>
        </div>
      ))}
    </div>
  )
}
export default FlipClock
```

**RiddleDisplay.jsx**
```jsx
function RiddleDisplay({ text }) {
  return <div className="riddle"><p>{text}</p></div>
}
export default RiddleDisplay
```

**WalletButton.jsx**
```jsx
import { useAccount, useConnect, useDisconnect } from 'wagmi'
function WalletButton() {
  const { address, isConnected } = useAccount(); const { connect, connectors } = useConnect(); const { disconnect } = useDisconnect()
  return isConnected ? (
    <button onClick={() => disconnect()}>{address?.slice(0, 6)}...{address?.slice(-4)}</button>
  ) : <button onClick={() => connect({ connector: connectors[0] })}>CONNECT WALLET</button>
}
export default WalletButton
```

### 6. Main App (`src/App.jsx`)
The core logic for sounds, animations, and bot triggers.

```jsx
import { useState, useEffect, useRef } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { useRiddle } from './hooks/useRiddle'
import FlipClock from './components/FlipClock'
import RiddleDisplay from './components/RiddleDisplay'
import WalletButton from './components/WalletButton'

const MAX_LENGTH = 12

function App() {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [isBotTriggering, setIsBotTriggering] = useState(false)
  const processedHashRef = useRef(null)
  
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { riddle, isActive, submitAnswer, isChecking, isSuccess, isError, hash, refetchAll } = useRiddle()

  const sounds = useRef({
    checking: new Audio('/sounds/checking.mp3'),
    success: new Audio('/sounds/success.mp3'),
    error: new Audio('/sounds/error.mp3'),
  })

  useEffect(() => {
    const s = sounds.current
    if (isChecking) { s.checking.loop = true; s.checking.play().catch(() => {}); }
    else { s.checking.pause(); s.checking.currentTime = 0; }
  }, [isChecking])

  useEffect(() => {
    if ((isSuccess || isError) && hash && processedHashRef.current !== hash) {
      processedHashRef.current = hash
      const handle = async () => {
        const { winner } = await refetchAll()
        const s = sounds.current
        if (isSuccess && winner?.toLowerCase() === address?.toLowerCase()) {
          setResult('correct'); s.success.play(); setTimeout(() => { setResult(null); setAnswer(''); }, 3000)
        } else {
          setResult('wrong'); s.error.play(); setTimeout(() => { setResult(null); setAnswer(''); }, 1500)
        }
      }
      handle()
    }
  }, [isSuccess, isError, hash])

  useEffect(() => {
    if (isActive === false && !isBotTriggering && riddle) {
      setIsBotTriggering(true)
      fetch('/api/new-riddle').then(() => setTimeout(() => { refetchAll(); setIsBotTriggering(false); }, 5000))
    }
  }, [isActive, riddle])

  return (
    <div className="terminal">
      <div className="scanlines" />
      <div className="container">
        <h1 className="title">RIDDLE_TERMINAL</h1>
        <RiddleDisplay text={riddle || (isBotTriggering ? 'GENERATING...' : 'LOADING...')} />
        <FlipClock value={answer} maxLength={MAX_LENGTH} isChecking={isChecking} result={result} />
        <div className="actions">
          {isConnected ? (
            <button onClick={() => chainId !== sepolia.id ? switchChain({ chainId: sepolia.id }) : submitAnswer(answer)} disabled={!answer || isChecking || result}>
              {isChecking ? 'CHECKING...' : 'SUBMIT'}
            </button>
          ) : <WalletButton />}
        </div>
      </div>
    </div>
  )
}
export default App
```

---

## 🚀 PART 5: Final Deployment

1.  **Generate Riddles**: `node scripts/generate-riddles.js`
2.  **Deploy Contract**: 
    ```bash
    cd contract
    npx hardhat run scripts/deploy.js --network sepolia
    cd ..
    ```
3.  **Push to GitHub**: Connect your repo to Netlify.
4.  **Netlify Config**: Set your Env Vars in Netlify UI:
    - `BOT_PRIVATE_KEY`: Your wallet private key.
    - `VITE_CONTRACT_ADDRESS`: The address from your deploy script.

---

## 🔐 FHE Discussion

**Current Limitation:**  
Answers are hashed with `keccak256`. While this prevents plaintext storage, it's vulnerable to:
- Rainbow table attacks (common words)
- Front-running (mempool visibility)
- Permanent answer exposure (tx data)

**Zama fhEVM Enhancement:**

```solidity
euint32 private encryptedAnswer;

function submitAnswer(externalEuint32 guess, bytes calldata proof) external {
    euint32 userGuess = FHE.fromExternal(guess, proof);
    ebool isCorrect = FHE.eq(userGuess, encryptedAnswer);
    // Result revealed via controlled decryption
}
```

**Benefits:**
- Prevents all hash-based attacks
- Eliminates front-running
- Keeps answers permanently confidential

**Trade-off:** Higher complexity + gas costs. For a tutorial, hash-based is more accessible. For production, fhEVM is the natural evolution.
