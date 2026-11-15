import './globals.css';

export const metadata = {
  title: 'ihatephotoshop — Fast, calm browser image editor',
  description: 'A private, browser-first image, text, and PDF editor with layers, filters, and fonts. No subscriptions, no tracking.',
  keywords: ['image editor', 'photo editor', 'browser photoshop', 'online photoshop', 'crop', 'canvas', 'layers', 'filters'],
  authors: [{ name: 'Raghav Dadhich', url: 'https://github.com/raghav3615' }],
  openGraph: {
    title: 'ihatephotoshop — Browser Image Editor',
    description: 'Fast, calm workspace for images, text, and PDFs. Start with a color, drop in files, and export in seconds.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#101113',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Caveat:wght@600&family=Cinzel:wght@600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Inter:wght@400;500;600;700;900&family=Montserrat:wght@400;600;700;800&family=Oswald:wght@500;700&family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%2317181a'/><rect x='6' y='12' width='3' height='7' rx='1.5' fill='%23d5fb50'/><rect x='10.5' y='7' width='3' height='12' rx='1.5' fill='%23d5fb50'/><rect x='15' y='10' width='3' height='9' rx='1.5' fill='%23d5fb50'/></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
