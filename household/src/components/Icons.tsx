import type { ReactNode } from 'react';

type IconProps = { size?: number; className?: string };

function Svg({ size = 22, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" /></Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></Svg>
);
export const CoverageIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5 5 6.5v5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9v-5z" /><path d="m9 12 2.2 2.2L15 10.4" /></Svg>
);
export const HouseholdIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3" /><circle cx="17" cy="10" r="2.2" /><path d="M3.5 19c.4-3 2.6-4.8 5.5-4.8s5.1 1.8 5.5 4.8M15.5 14.6c2.4-.3 4.5 1 5 4" /></Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const MailIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 4 3.5 19h17z" /><path d="M12 10v4.2M12 16.8v.2" /></Svg>
);
export const PersonPlusIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="8.5" r="3.2" /><path d="M4 19c.4-3.2 2.7-5 6-5s5.6 1.8 6 5M19 8v5M16.5 10.5h5" /></Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const PinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 20.5s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" /><circle cx="12" cy="10.5" r="2.2" /></Svg>
);
export const ListIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" /></Svg>
);
