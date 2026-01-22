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
  const [result, setResult] = useState(null) // 'correct' | 'wrong' | null
  const [isBotTriggering, setIsBotTriggering] = useState(false)
  
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { riddle, isActive, winner, submitAnswer, isChecking, isSuccess, isError, refetchAll } = useRiddle()

  const soundsRef = useRef({
    checking: new Audio('/sounds/checking.mp3'),
    success: new Audio('/sounds/success.mp3'),
    error: new Audio('/sounds/error.mp3'),
  })

  // Sound management
  useEffect(() => {
    const s = soundsRef.current
    if (isChecking) {
      s.checking.loop = true
      s.checking.play().catch(e => console.warn("Audio play blocked", e))
    } else {
      s.checking.pause()
      s.checking.currentTime = 0
    }
  }, [isChecking])

  // Trigger bot when riddle inactive
  useEffect(() => {
    if (isActive === false && !isBotTriggering && riddle) {
      setIsBotTriggering(true)
      console.log("Triggering bot for new riddle...")
      fetch('/api/new-riddle')
        .then(async (res) => {
          const data = await res.json()
          console.log("Bot response:", data)
          // Wait for indexing
          setTimeout(() => {
            refetchAll()
            setIsBotTriggering(false)
          }, 3000)
        })
        .catch(err => {
          console.error("Bot error:", err)
          setIsBotTriggering(false)
        })
    }
  }, [isActive, isBotTriggering, refetchAll, riddle])

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

  // Check result after transaction
  useEffect(() => {
    if (isSuccess || isError) {
      const handleResult = async () => {
        const { winner: latestWinner } = await refetchAll()
        const s = soundsRef.current
        
        if (isSuccess && latestWinner && latestWinner.toLowerCase() === address?.toLowerCase()) {
          setResult('correct')
          s.success.play().catch(console.error)
          setTimeout(() => {
            setResult(null)
            setAnswer('')
          }, 3000)
        } else {
          setResult('wrong')
          s.error.play().catch(console.error)
          setTimeout(() => {
            setResult(null)
            setAnswer('')
          }, 1500)
        }
      }
      handleResult()
    }
  }, [isSuccess, isError, address, refetchAll])

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
        
        <RiddleDisplay text={riddle || (isBotTriggering ? 'GENERATING NEW RIDDLE...' : 'LOADING...')} />
        
        <FlipClock 
          value={answer}
          maxLength={MAX_LENGTH}
          isChecking={isChecking}
          result={result}
        />
        
        {result === 'correct' && (
          <div className="winner">
            ✓ CORRECT!
          </div>
        )}
        
        <div className="actions">
          {isConnected ? (
            <button 
              onClick={handleSubmit}
              disabled={!answer || isChecking || result || isBotTriggering}
              className="submit-btn"
            >
              {isChecking ? 'CHECKING...' : isBotTriggering ? 'WAIT...' : 'SUBMIT'}
            </button>
          ) : (
            <WalletButton />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
