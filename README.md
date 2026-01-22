# 🎮 ON-CHAIN RIDDLE GAME

A retro-themed, fully automated Web3 riddle game where players solve puzzles directly on the Ethereum Sepolia testnet.

## 🛠 Technical Approach

The game follows a hybrid architecture to balance blockchain security with a smooth user experience:

- **Smart Contract (Solidity):** Deployed on Sepolia, the `OnchainRiddle` contract maintains the game state, validates answers (via `keccak256` hashing), and records winners.
- **Frontend (React + Vite):** A modern stack using `Wagmi` and `Viem` for seamless wallet connectivity and real-time contract interactions.
- **Automated Bot (Netlify Functions):** A serverless "game master" that monitors the contract. When a riddle is solved, it automatically triggers a transaction to set the next puzzle from a predefined library.
- **RPC Failover System:** A centralized list of RPC providers with automatic rotation to ensure high availability for the automated bot and frontend.

## 🎨 Design Decisions

- **Retro Terminal Aesthetic:** The UI features a yellow-on-black CRT scanline effect, drawing inspiration from classic mechanical interfaces.
- **Mechanical Flip-Clock:** Instead of standard text inputs, user answers are displayed on a virtual mechanical flip-clock. The letters flip mechanically during transaction confirmation, providing tactile visual feedback.
- **Keyboard-Driven Interaction:** The game is designed for keyboard input—users simply type to see the clock update, creating an immersive "terminal" experience.
- **Multi-Sensory Feedback:** Integrated sound effects for mechanical "flipping," success cascades, and error shakes to enhance the user experience during blockchain wait times.

## 🚀 Key Features & Extensions

- **Auto-Cycle System:** No manual intervention is required. The bot handles the transition between riddles, allowing for continuous 24/7 gameplay.
- **Robustness Layer:** The project includes a centralized `rpc-list.json` that the entire stack uses to rotate through healthy nodes if a primary provider fails.
- **Future-Proofing (FHE Ready):** While the current version uses `keccak256` for simplicity, the architecture is designed to eventually migrate to **fhEVM (Fully Homomorphic Encryption)**, which would allow for completely hidden on-chain answers and total protection against front-running.

## 📦 Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Riddles:**
   ```bash
   node scripts/generate-riddles.js
   ```

3. **Deploy Contract:**
   ```bash
   cd contract
   npx hardhat run scripts/deploy.js --network sepolia
   ```

4. **Environment Variables:**
   Set the following in your `.env` or Netlify dashboard:
   - `BOT_PRIVATE_KEY`: Private key of the account that deployed the contract.
   - `VITE_CONTRACT_ADDRESS`: Address of the deployed `OnchainRiddle` contract.
