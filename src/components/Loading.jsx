// A simple, globally styled loading component
export default function Loading() {
  return (
    <div style={{textAlign:'center',marginTop:100,fontSize:24,letterSpacing:2,color:'#555'}}>
      <span className="loading-spinner" style={{
        display: 'inline-block',
        width: 32,
        height: 32,
        border: '4px solid #ccc',
        borderTop: '4px solid #007bff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginRight: 16,
        verticalAlign: 'middle'
      }} />
      Loading...
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
