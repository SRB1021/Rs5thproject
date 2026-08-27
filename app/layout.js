import "./globals.css";

export const metadata = {
  title: "TextMate",
  description: "Text and call an AI that feels like texting a real person.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
