import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import riddles from '../../riddles.json'
import RPC_LIST from '../../rpc-list.json'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY

const ABI = [
  {
    inputs: [],
    name: 'isActive',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'bot',
    outputs: [{ type: 'address' }],
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
      throw new Error(`Missing environment variables: ${!CONTRACT_ADDRESS ? 'CONTRACT_ADDRESS ' : ''}${!BOT_PRIVATE_KEY ? 'BOT_PRIVATE_KEY' : ''}`)
    }

    const formattedPK = BOT_PRIVATE_KEY.startsWith('0x') ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`
    const account = privateKeyToAccount(formattedPK)

    // 1. Check bot permissions and contract status
    const { isActive, contractBot } = await withRpcRotation(async (rpcUrl) => {
      const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
      const [active, cBot] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: 'isActive'
        }),
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: 'bot'
        })
      ])
      return { isActive: active, contractBot: cBot }
    })

    console.log(`Contract: ${CONTRACT_ADDRESS}`)
    console.log(`Contract Bot: ${contractBot}`)
    console.log(`Your Bot: ${account.address}`)
    console.log(`Is Active: ${isActive}`)

    if (contractBot.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`Bot address mismatch. Contract bot: ${contractBot}, your account: ${account.address}. Ensure BOT_PRIVATE_KEY corresponds to the account that deployed the contract.`)
    }

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