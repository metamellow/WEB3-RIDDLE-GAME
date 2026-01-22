import { useState, useEffect } from 'react'

function FlipClock({ value, maxLength, isChecking, result }) {
  const letters = value.padEnd(maxLength, ' ').split('')

  return (
    <div className="flip-clock">
      {letters.map((letter, i) => (
        <div 
          key={i}
          className={`
            flip-letter
            ${i < value.length ? 'filled' : ''}
            ${isChecking && i < value.length ? 'flipping' : ''}
            ${result && i < value.length ? result : ''}
          `}
          style={{
            animationDelay: isChecking ? `${i * 0.05}s` : '0s'
          }}
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
