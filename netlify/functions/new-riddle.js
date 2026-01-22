import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import fs from 'fs'
import path from 'path'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY
const RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

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

export async function handler() {
  try {
    if (!CONTRACT_ADDRESS || !BOT_PRIVATE_KEY) {
      throw new Error("Missing CONTRACT_ADDRESS or BOT_PRIVATE_KEY environment variables")
    }

    // Load riddles manually to avoid 'import with' compatibility issues
    const riddlesPath = path.resolve(process.cwd(), 'riddles.json')
    const riddles = JSON.parse(fs.readFileSync(riddlesPath, 'utf8'))

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC)
    })

    const isActive = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'isActive'
    })

    console.log("Current contract isActive status:", isActive)

    if (isActive) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Riddle still active, no action needed' })
      }
    }

    // Get next riddle index by counting RiddleSet events
    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: {
        type: 'event',
        name: 'RiddleSet',
        inputs: [{ type: 'string', name: 'riddle' }]
      },
      fromBlock: 0n 
    })

    const nextIndex = logs.length % riddles.length
    const next = riddles[nextIndex]
    
    console.log(`Setting next riddle (index ${nextIndex}): ${next.question}`)

    // Ensure private key is properly formatted
    const formattedPK = BOT_PRIVATE_KEY.startsWith('0x') ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`
    const account = privateKeyToAccount(formattedPK)
    
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(RPC)
    })

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'setRiddle',
      args: [next.question, next.answerHash]
    })

    await publicClient.waitForTransactionReceipt({ hash })

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'New riddle set',
        riddleIndex: nextIndex,
        txHash: hash
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
