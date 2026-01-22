import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useRiddle } from './hooks/useRiddle'
import FlipClock from './components/FlipClock'
import RiddleDisplay from './components/RiddleDisplay'
import WalletButton from './components/WalletButton'

const MAX_LENGTH = 12

function App() {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null) // 'correct' | 'wrong' | null
  
  const { isConnected } = useAccount()
  const { riddle, isActive, winner, submitAnswer, isChecking, isSuccess } = useRiddle()

  // Trigger bot when riddle inactive
  useEffect(() => {
    if (isActive === false) {
      fetch('/api/new-riddle').catch(console.error)
    }
  }, [isActive])

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
    if (isSuccess) {
      setTimeout(() => {
        if (winner && winner !== '0x0000000000000000000000000000000000000000') {
          setResult('correct')
          setTimeout(() => {
            setResult(null)
            setAnswer('')
          }, 3000)
        } else {
          setResult('wrong')
          setTimeout(() => {
            setResult(null)
            setAnswer('')
          }, 1500)
        }
      }, 1000)
    }
  }, [isSuccess, winner])

  const handleSubmit = () => {
    if (!answer || !isConnected) return
    submitAnswer(answer)
  }

  return (
    <div className="terminal">
      <div className="scanlines" />
      
      <div className="container">
        <h1 className="title">RIDDLE_TERMINAL</h1>
        
        <RiddleDisplay text={riddle || 'LOADING...'} />
        
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
              disabled={!answer || isChecking || result}
              className="submit-btn"
            >
              {isChecking ? 'CHECKING...' : 'SUBMIT'}
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
