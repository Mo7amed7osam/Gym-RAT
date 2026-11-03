import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gym RAT", template: "%s · Gym RAT" },
  description: "Invitation and password links for the Gym RAT app.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0e0e10", width: "device-width", initialScale: 1 };

/** Theme is applied before paint from localStorage (dark by default) so there is no flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('gymrat-theme');if(t==='light'||t==='black'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${barlow.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        {children}
      </body>
    </html>
  );
}
