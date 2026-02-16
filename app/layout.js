import './globals.css';

export const metadata = {
  title: 'FindAnyMail — Free Email Finder',
  description: 'Find verified email addresses for any person. Free, fast, and accurate.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
