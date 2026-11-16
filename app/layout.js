import "./globals.css";
import { AppProvider } from "../lib/store";

export const metadata = {
  title: "InstaInvest — Transparent investing for India",
  description:
    "Mobile-first retail investing: instant KYC, transparent pre-trade fee calculator (Brokerage, STT, Exchange charges) and contextual education on Market vs Limit orders.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00c48c",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div className="shell">{children}</div>
        </AppProvider>
      </body>
    </html>
  );
}
