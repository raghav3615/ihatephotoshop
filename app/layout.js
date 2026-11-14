import './globals.css';

export const metadata = {
  title: 'ihatephotoshop — browser editor',
  description: 'A private, browser-first image and PDF editor.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
