import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav className="border-b border-border bg-white sticky top-0 z-50 flex items-center px-8" style={{ height: 64 }}>
      <Link to="/">
        <img src="/logo.png" alt="BuildMatch" style={{ height: 'clamp(2.6rem, 4.4vw, 4rem)' }} />
      </Link>
    </nav>
  );
}
