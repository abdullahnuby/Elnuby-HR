'use client';
import type { SVGProps, ReactElement } from 'react';

type Props = SVGProps<SVGSVGElement> & { name: string; size?: number };
const paths: Record<string, ReactElement> = {
  dashboard:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  projects:<><path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h7l2 2"/></>,
  shifts:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  attendance:<><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M8 6h8M8 10h8M8 14h4"/><path d="m15 17 2 2 4-4"/></>,
  leaves:<><path d="M4 4h16v16H4z"/><path d="M8 2v4M16 2v4M4 9h16"/><path d="M8 13h3M8 17h5"/></>,
  permissions:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  deductions:<><path d="M5 12h14"/></>,
  reports:<><path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V7M16 16v-9"/></>,
  settings:<><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a2 2 0 1 1-4 0V19a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 5.2 12a1.7 1.7 0 0 0-1.2-1.6h-.3a2 2 0 1 1 0-4H4A1.7 1.7 0 0 0 5.2 3.5l-.1-.1A2 2 0 1 1 7.9.6l.1.1A1.7 1.7 0 0 0 10.9-.5v-.3"/></>,
  menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
  logout:<><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
  check:<><path d="m5 12 4 4L19 6"/></>,
  x:<><path d="M6 6l12 12M18 6 6 18"/></>,
  plus:<><path d="M12 5v14M5 12h14"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  alert:<><path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  spinner:<><path d="M12 3a9 9 0 1 0 9 9"/></>,
  calendar:<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/></>,
};
export default function Icon({name,size=18,strokeWidth=1.8,className,...props}:Props){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className} {...props}>{paths[name]||paths.dashboard}</svg>}
