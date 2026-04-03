import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav className="border-b border-border bg-white sticky top-0 z-50 flex items-center px-8" style={{ height: 'clamp(26rem, 45vw, 45rem)' }}>
      <Link to="/">
        <img src="/logo.svg" alt="BuildMatch" style={{ height: 'clamp(24rem, 42vw, 42rem)' }} />
      </Link>
    </nav>
  );
}
