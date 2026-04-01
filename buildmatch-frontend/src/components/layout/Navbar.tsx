import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav className="h-[60px] border-b border-border bg-white sticky top-0 z-50 flex items-center px-8">
      <Link to="/">
        <img src="/logo.svg" alt="BuildMatch" style={{ height: 40 }} />
      </Link>
    </nav>
  );
}
