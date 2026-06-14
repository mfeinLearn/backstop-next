import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Panic Sell — Everything to USDC",
  description: "One-tap liability-aware DeFi exit",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
