'use client';

import { BriefcaseBusiness, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Today', icon: CalendarDays },
  { href: '/applications', label: 'Applications', icon: BriefcaseBusiness },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="primary-nav" aria-label="Primary navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            href={href}
            key={href}
            className="nav-link"
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" size={17} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
