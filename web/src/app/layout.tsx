import type { Metadata } from "next";

import { ThemeProvider } from "@/lib/theme";

import "./globals.css";

const themeInitScript = `(function(){try{var t=localStorage.getItem("option-chain-live-theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Option Chain Live Stream | Anand Rathi Wealth",
  description:
    "Live NSE and BSE index option chains, plus Anand Rathi Wealth equity options.",
  icons: { icon: "/brand/arwl-logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="bg-background text-ink antialiased"
        style={{
          fontFamily: "var(--font-serif), 'Times New Roman', Times, Georgia, serif",
        }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
