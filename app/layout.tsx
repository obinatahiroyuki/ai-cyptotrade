import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ai-cyptotrade",
  description: "AI仮想通貨自動売買システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
