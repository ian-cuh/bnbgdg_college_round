import { Header, Footer } from '@/components/layout';
import { WalletProvider } from '@/components/WalletProvider';
import '@/app/globals.css';

export const metadata = {
  title: 'Fairwork',
  description: 'Blockchain-backed freelance escrow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <WalletProvider>
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
