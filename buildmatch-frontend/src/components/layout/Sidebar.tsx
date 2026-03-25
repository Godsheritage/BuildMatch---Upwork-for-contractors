import React from 'react';

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface min-h-full p-6">
      {children}
    </aside>
  );
}
