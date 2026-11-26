import React from 'react'

export default function LoadingSpinner({ size = 40, color = 'var(--gold)', text = 'Loading...' }) {
  return (
    <div style={styles.container}>
      <div style={{ ...styles.spinner, width: size, height: size, borderColor: `${color}33`, borderTopColor: color }}>
      </div>
      {text && <div style={styles.text}>{text}</div>}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    height: '100%',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)',
    fontSize: 14
  },
  spinner: {
    border: '3px solid',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  text: {
    marginTop: 8
  }
}
