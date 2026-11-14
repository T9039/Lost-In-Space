import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { CompareProvider } from "@/components/CompareProvider";
import CompareTray from "@/components/CompareTray";

export const metadata: Metadata = {
  title: "Abandoned but not Forgotten — The Cosmic Relic Museum",
  description:
    "An interactive museum of the machines humans left behind on the Moon, Mars, in Earth orbit and beyond — built on real NASA data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="starfield" aria-hidden="true" />
        <CompareProvider>
          <Nav />
          <main>{children}</main>
          <footer className="footer">
            <div className="container footer-inner">
              <span>
                Data and imagery:{" "}
                <a href="https://science.nasa.gov/" target="_blank" rel="noreferrer">
                  NASA
                </a>{" "}
                ·{" "}
                <a href="https://images.nasa.gov/" target="_blank" rel="noreferrer">
                  NASA Image and Video Library
                </a>{" "}
                ·{" "}
                <a href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noreferrer">
                  NASA 3D Resources
                </a>
              </span>
              <span>
                Prototype · fixture data · no AI-generated imagery · <a href="/sources">all sources</a>
              </span>
            </div>
          </footer>
          <CompareTray />
        </CompareProvider>
      </body>
    </html>
  );
}
