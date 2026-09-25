import type { Metadata } from 'next';
import { Barlow_Condensed, Roboto } from 'next/font/google';
import './globals.css';

const display = Barlow_Condensed({
  variable: '--font-display-face',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'LiveSubs · Nerdearla',
  description: 'Subtítulos y traducción en vivo, open source, para conferencias.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${display.variable} ${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
