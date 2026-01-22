import { useAccount, useConnect, useDisconnect } from 'wagmi'

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <button onClick={() => disconnect()} className="wallet-btn">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </button>
    )
  }

  return (
    <button 
      onClick={() => connect({ connector: connectors[0] })}
      className="wallet-btn"
    >
      CONNECT WALLET
    </button>
  )
}

export default WalletButton
