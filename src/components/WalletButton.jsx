import { useAccount, useConnect, useDisconnect } from 'wagmi'
function WalletButton() {
  const { address, isConnected } = useAccount(); const { connect, connectors } = useConnect(); const { disconnect } = useDisconnect()
  return isConnected ? (
    <button onClick={() => disconnect()}>{address?.slice(0, 6)}...{address?.slice(-4)}</button>
  ) : <button onClick={() => connect({ connector: connectors[0] })}>CONNECT WALLET</button>
}
export default WalletButton