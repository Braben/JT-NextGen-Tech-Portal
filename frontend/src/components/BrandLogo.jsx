export default function BrandLogo({ className = 'w-44' }) {
  return (
    <span className={`relative block max-w-full shrink-0 overflow-hidden bg-white ${className}`} style={{ aspectRatio: '1490 / 302' }}>
      {/* Frame the artwork inside the original 1600px square without altering the official asset. */}
      <img src="/hub-logo.png" alt="J.T NextGen Tech Hub" width="1600" height="1600"
        className="absolute block !max-w-none"
        style={{ width: '107.38255%', height: 'auto', left: '-3.69128%', top: '-214.90066%' }} />
    </span>
  );
}
