import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Voice Chat',
  description: 'Secure voice rooms for everyone',
  twitter: {
    card: 'summary_large_image',
  },
  openGraph: {
    images: [
      {
        url: '/images/open-graph.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/images/apple-touch.png',
        sizes: '180x180',
      },
      { rel: 'mask-icon', url: '/images/safari-pinned-tab.svg', color: '#070707' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50">
        <div className="min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
