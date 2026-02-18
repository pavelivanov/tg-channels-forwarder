const spinnerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '32px',
};

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: 'var(--hint-color)',
  margin: '0 4px',
  animation: 'pulse 1.4s ease-in-out infinite',
};

export function LoadingSpinner() {
  return (
    <div style={spinnerStyle}>
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ ...dotStyle, animationDelay: '0s' }} />
      <div style={{ ...dotStyle, animationDelay: '0.2s' }} />
      <div style={{ ...dotStyle, animationDelay: '0.4s' }} />
    </div>
  );
}
