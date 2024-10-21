// src/app/layout.tsx
import type { Metadata } from "next";
import Head from "next/head";
import { Kumbh_Sans } from "next/font/google"; // Import Kumbh Sans from Google Fonts
import "./globals.css"; // Tailwind is imported here, so it's globally available
import { Toaster } from "react-hot-toast"; // Import Toaster from react-hot-toast

// Load Kumbh Sans Google Font
const kumbhSans = Kumbh_Sans({
  subsets: ["latin"],
  weight: ["400", "700"], // Customize the weights you need
  variable: "--font-kumbh-sans", // Tailwind CSS variable
});

export const metadata: Metadata = {
  title: "File Upload Tool",
  description: "Drag and Drop File Upload Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        {/* Using a .ico or .png file */}
        <link rel="icon" href="/favicon.ico" />

        {/* Alternatively, using an emoji as a favicon */}
        <link
          rel="icon"
          href={`data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2220%22 font-size=%2220%22>🚀</text></svg>`}
        />
      </Head>
      <body
        className={`${kumbhSans.variable} antialiased`} // Use Kumbh Sans variable here
      >
        <Toaster position="top-right" reverseOrder={false} /> {/* Add Toaster here */}
        {children}
      </body>
    </html>
  );
}
