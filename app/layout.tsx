import type { Metadata } from "next";
import { Orbitron, Rajdhani, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { CompareProvider } from "@/components/CompareProvider";
import CompareTray from "@/components/CompareTray";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700", "800", "900"],
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["500", "600", "700"],
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  variable: "--font-telemetry",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lost in Space — NASA Mission Archive",
  description: "Follow NASA missions through time and explore the machines, discoveries, and stories they left across space.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${rajdhani.variable} ${shareTechMono.variable}`}>
      <body className="cyber-body">
        <div className="cyber-scanlines" aria-hidden="true" />
        <div className="cyber-grid-bg" aria-hidden="true" />
        <div className="starfield" aria-hidden="true" />
        <CompareProvider>
          <Nav />
          <main className="main-content">{children}</main>
          <footer className="footer">
            <div className="container footer-inner">
              <span className="footer-telemetry">
                [NASA DATA FEED // VERIFIED HISTORICAL TELEMETRY] ·{" "}
                <a href="https://science.nasa.gov/" target="_blank" rel="noreferrer">NASA Science</a>{" · "}
                <a href="https://images.nasa.gov/" target="_blank" rel="noreferrer">Image Archive</a>{" · "}
                <a href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noreferrer">3D Resources</a>
              </span>
              <span className="footer-tag">LOST IN SPACE // EST. 1958 · <a href="/sources">SOURCE ARCHIVE</a></span>
            </div>
          </footer>
          <CompareTray />
        </CompareProvider>
      </body>
    </html>
  );
}
