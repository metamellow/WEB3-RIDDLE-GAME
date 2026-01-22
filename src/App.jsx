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

  // Keyboard input
  useEffect(() => {
    const handleKey = (e) => {
      if (result || isChecking) return
      
      if (/^[a-zA-Z]$/.test(e.key) && answer.length < MAX_LENGTH) {
        setAnswer(prev => prev + e.key.toUpperCase())
      }
      if (e.key === 'Backspace') {
        setAnswer(prev => prev.slice(0, -1))
      }
      if (e.key === 'Enter' && answer && isConnected) {
        handleSubmit()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [answer, result, isChecking, isConnected])

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
      fetch('/api/new-riddle')
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to trigger new riddle')
          }
          console.log('New riddle triggered successfully')
          setTimeout(() => {
            refetchAll()
            setIsBotTriggering(false)
          }, 5000)
        })
        .catch((err) => {
          console.error('Bot trigger error:', err.message)
          setIsBotTriggering(false)
        })
    }
  }, [isActive, riddle])

  const handleSubmit = () => {
    if (!answer || !isConnected) return
    if (chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id })
      return
    }
    submitAnswer(answer)
  }

  return (
    <div className="terminal">
      <div className="scanlines" />
      <div className="container">
        <h1 className="title">RIDDLE_TERMINAL</h1>
        <RiddleDisplay text={riddle || (isBotTriggering ? 'GENERATING...' : 'LOADING...')} />
        <FlipClock value={answer} maxLength={MAX_LENGTH} isChecking={isChecking} result={result} />
        
        {result === 'correct' && (
          <div className="winner">
            ✓ CORRECT!
          </div>
        )}

        <div className="actions">
          {isConnected ? (
            <button onClick={handleSubmit} disabled={!answer || isChecking || result}>
              {isChecking ? 'CHECKING...' : 'SUBMIT'}
            </button>
          ) : <WalletButton />}
        </div>
      </div>
    </div>
  )
}

export default App