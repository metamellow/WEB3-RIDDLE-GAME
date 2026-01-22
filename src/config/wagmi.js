import { createConfig, http, fallback } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import rpcList from '../../rpc-list.json'

// Create transports array from the centralized list
const transports = rpcList.map(url => http(url))

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [sepolia.id]: fallback(transports),
  },
})
