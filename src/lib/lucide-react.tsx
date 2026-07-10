import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string };

function Icon({ children, size = 20, strokeWidth = 2, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const LayoutDashboard = (props: IconProps) => <Icon {...props}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Icon>;
export const BarChart3 = (props: IconProps) => <Icon {...props}><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></Icon>;
export const FileText = (props: IconProps) => <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></Icon>;

export const Truck = (props: IconProps) => <Icon {...props}><path d="M10 17h4V5H2v12h3" /><path d="M14 8h4l4 4v5h-3" /><path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0" /><path d="M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0" /></Icon>;
export const Building2 = (props: IconProps) => <Icon {...props}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" /><path d="M6 12H4a2 2 0 0 0-2 2v8" /><path d="M18 9h2a2 2 0 0 1 2 2v11" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></Icon>;
export const Users = (props: IconProps) => <Icon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
export const Tags = (props: IconProps) => <Icon {...props}><path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z" /><path d="M7 7h.01" /></Icon>;
export const Settings = (props: IconProps) => <Icon {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2l-.16 1.2a8 8 0 0 0-1.11.46l-1.11-.47a2 2 0 0 0-2.44.82l-.22.38a2 2 0 0 0 .36 2.57l.96.75a8 8 0 0 0 0 1.18l-.96.75a2 2 0 0 0-.36 2.57l.22.38a2 2 0 0 0 2.44.82l1.11-.47c.36.19.73.35 1.11.46l.16 1.2a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2l.16-1.2c.38-.12.75-.27 1.11-.46l1.11.47a2 2 0 0 0 2.44-.82l.22-.38a2 2 0 0 0-.36-2.57l-.96-.75a8 8 0 0 0 0-1.18l.96-.75a2 2 0 0 0 .36-2.57l-.22-.38a2 2 0 0 0-2.44-.82l-1.11.47a8 8 0 0 0-1.11-.46L14.22 4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const UserCircle = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M7 20.7a6 6 0 0 1 10 0" /></Icon>;
export const Menu = (props: IconProps) => <Icon {...props}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></Icon>;
export const LogOut = (props: IconProps) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Icon>;
export const Search = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></Icon>;
export const Plus = (props: IconProps) => <Icon {...props}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>;
export const RefreshCw = (props: IconProps) => <Icon {...props}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></Icon>;
export const AlertCircle = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></Icon>;
export const CheckCircle2 = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Icon>;
export const CircleDashed = (props: IconProps) => <Icon {...props}><path d="M10.1 2.18a10 10 0 0 1 3.8 0" /><path d="M17.6 3.72a10 10 0 0 1 2.68 2.7" /><path d="M21.82 10.1a10 10 0 0 1 0 3.8" /><path d="M20.28 17.6a10 10 0 0 1-2.7 2.68" /><path d="M13.9 21.82a10 10 0 0 1-3.8 0" /><path d="M6.4 20.28a10 10 0 0 1-2.68-2.7" /><path d="M2.18 13.9a10 10 0 0 1 0-3.8" /><path d="M3.72 6.4a10 10 0 0 1 2.7-2.68" /></Icon>;
export const Inbox = (props: IconProps) => <Icon {...props}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></Icon>;
export const MoreHorizontal = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>;
export const ShieldCheck = (props: IconProps) => <Icon {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></Icon>;
export const Sparkles = (props: IconProps) => <Icon {...props}><path d="m12 3-1.9 5.8L4 11l6.1 2.2L12 19l1.9-5.8L20 11l-6.1-2.2Z" /><path d="M5 3v4" /><path d="M3 5h4" /><path d="M19 17v4" /><path d="M17 19h4" /></Icon>;
export const ChevronDown = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
export const X = (props: IconProps) => <Icon {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
