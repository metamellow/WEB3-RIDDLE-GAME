function FlipClock({ value, maxLength, isChecking, result }) {
    const letters = value.padEnd(maxLength, ' ').split('')
    return (
      <div className="flip-clock">
        {letters.map((l, i) => (
          <div key={i} className={`flip-letter ${i < value.length ? 'filled' : ''} ${isChecking && i < value.length ? 'flipping' : ''} ${result && i < value.length ? result : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flip-inner"><span>{l}</span></div>
          </div>
        ))}
      </div>
    )
  }
  export default FlipClock