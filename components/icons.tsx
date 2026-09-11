import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 14, ...rest }: IconProps, strokeWidth = 2) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

/** Shield: built-in quality gates. */
export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props }, 2.5)}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

/** Pull request: PR quality gates. */
export function PullRequestIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props }, 2.5)}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <path d="M6 9v12" />
    </svg>
  );
}

/** Lightning: flow quality gates. */
export function FlowIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props }, 2.5)}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

/** Pencil: custom write-in quality gates. */
export function PencilIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props }, 2.5)}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

/** Two people: who can deploy. */
export function UsersIcon(props: IconProps) {
  return (
    <svg {...base({ size: 14, ...props })}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, 2.5)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props }, 2.5)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base({ size: 12, ...props }, 2.5)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function BranchIcon(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props })}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M6 9v6M18 9a9 9 0 0 1-9 9" />
      <circle cx="18" cy="6" r="3" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base({ size: 14, ...props })}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props })}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function SnapshotIcon(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props })}>
      <rect x="8" y="8" width="14" height="14" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props })}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props })}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props })}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props })}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props })}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function BulbIcon(props: IconProps) {
  return (
    <svg {...base({ size: 20, ...props })}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.5 1 2.5h6c0-1 .3-1.9 1-2.5A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

/** The app mark: a cloud with a pipeline flowing through it. */
export function CloudPipelineMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#ffffff" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path d="M7.5 13.5h9" stroke="#0ea5e9" strokeWidth="1.4" />
      <circle cx="7.5" cy="13.5" r="1.5" fill="#0ea5e9" />
      <circle cx="12" cy="13.5" r="1.5" fill="#0ea5e9" />
      <circle cx="16.5" cy="13.5" r="1.5" fill="#0ea5e9" />
    </svg>
  );
}
