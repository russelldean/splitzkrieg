export default function BlogPostLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-3 border-navy/20 border-t-red-600 rounded-full"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        <span className="text-sm font-body text-navy/60">Loading post...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
