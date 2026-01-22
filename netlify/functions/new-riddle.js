import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import fs from 'fs'
import path from 'path'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY

// Load centralized RPC list
const rpcListPath = path.resolve(process.cwd(), 'rpc-list.json')
const RPC_LIST = JSON.parse(fs.readFileSync(rpcListPath, 'utf8'))

const ABI = [
  {
    inputs: [],
    name: 'isActive',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: '_riddle', type: 'string' },
      { name: '_answerHash', type: 'bytes32' }
    ],
    name: 'setRiddle',
    outputs: [],
    type: 'function'
  }
]

// Helper to execute client actions with RPC rotation
async function withRpcRotation(action) {
  let lastError;
  // Try each RPC in the list until one works
  for (const rpcUrl of RPC_LIST) {
    try {
      return await action(rpcUrl);
    } catch (error) {
      console.warn(`RPC failed (${rpcUrl}): ${error.message}`);
      lastError = error;
    }
  }
  throw new Error(`All RPCs failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

export async function handler() {
  try {
    if (!CONTRACT_ADDRESS || !BOT_PRIVATE_KEY) {
      throw new Error("Missing CONTRACT_ADDRESS or BOT_PRIVATE_KEY environment variables")
    }

    const riddlesPath = path.resolve(process.cwd(), 'riddles.json')
    const riddles = JSON.parse(fs.readFileSync(riddlesPath, 'utf8'))

    const formattedPK = BOT_PRIVATE_KEY.startsWith('0x') ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`
    const account = privateKeyToAccount(formattedPK)

    // 1. Check if riddle is active
    const isActive = await withRpcRotation(async (rpcUrl) => {
      const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
      return await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'isActive'
      })
    })

    console.log("Current contract isActive status:", isActive)

    if (isActive) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Riddle still active, no action needed' })
      }
    }

    // 2. Get next riddle index
    const logs = await withRpcRotation(async (rpcUrl) => {
      const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
      return await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: {
          type: 'event',
          name: 'RiddleSet',
          inputs: [{ type: 'string', name: 'riddle' }]
        },
        fromBlock: 0n 
      })
    })

    const nextIndex = logs.length % riddles.length
    const next = riddles[nextIndex]
    
    console.log(`Setting next riddle (index ${nextIndex}): ${next.question}`)

    // 3. Set new riddle with retry logic
    const txHash = await withRpcRotation(async (rpcUrl) => {
      const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(rpcUrl)
      })

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'setRiddle',
        args: [next.question, next.answerHash]
      })

      await publicClient.waitForTransactionReceipt({ hash })
      return hash
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'New riddle set',
        riddleIndex: nextIndex,
        txHash
      })
    }

  } catch (error) {
    console.error("Bot function error:", error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}