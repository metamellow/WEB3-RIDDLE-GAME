import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import riddles from '../../riddles.json' with { type: 'json' }

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
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(RPC)
    })

    const isActive = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'isActive'
    })

    if (isActive) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Riddle active' })
      }
    }

    // Get next riddle
    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: {
        type: 'event',
        name: 'RiddleSet',
        inputs: [{ type: 'string', name: 'riddle' }]
      },
      fromBlock: 'earliest'
    })

    const nextIndex = logs.length % riddles.length
    const next = riddles[nextIndex]

    // Set new riddle
    const account = privateKeyToAccount(BOT_PRIVATE_KEY)
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
