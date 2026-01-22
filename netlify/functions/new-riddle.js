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