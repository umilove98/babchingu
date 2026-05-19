import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "밥친구",
  description: "사내 점심 모임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-cream text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
