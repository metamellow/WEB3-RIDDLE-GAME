import { useState, useEffect } from 'react'

function FlipClock({ value, maxLength, isChecking, result }) {
  const [checkingIndex, setCheckingIndex] = useState(-1)
  
  const letters = value.padEnd(maxLength, ' ').split('')

  // Animate checking sequence
  useEffect(() => {
    if (isChecking) {
      setCheckingIndex(0)
      const interval = setInterval(() => {
        setCheckingIndex(prev => {
          if (prev >= value.length - 1) {
            return 0 // Loop back for continuous animation
          }
          return prev + 1
        })
      }, 100) // Much faster: 100ms per letter
      
      return () => clearInterval(interval)
    } else {
      setCheckingIndex(-1)
    }
  }, [isChecking, value.length])

  return (
    <div className="flip-clock">
      {letters.map((letter, i) => (
        <div 
          key={i}
          className={`
            flip-letter
            ${i < value.length ? 'filled' : ''}
            ${isChecking && i === checkingIndex ? 'flipping' : ''}
            ${result && i < value.length ? result : ''}
          `}
        >
          <div className="flip-inner">
            <span>{letter}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FlipClock
