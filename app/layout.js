import "./globals.css";

export const metadata = {
  title: "Backstop — Wind-Down",
  description: "Agent wind-down / dead-man's switch wireframe",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
