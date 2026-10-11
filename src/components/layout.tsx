'use client';

import React from 'react';
import Link from 'next/link';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Button, Badge } from './ui';

export function Header() {
  const [mounted, setMounted] = React.useState(false);
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isWrongNetwork = chain && chain.id !== 11155111 && chain.id !== 31337;

  return (
    <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight">FAIRWORK</Link>
          <nav className="hidden md:flex gap-4 text-sm font-medium text-gray-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/agreements/new" className="hover:text-white transition-colors">New Agreement</Link>
            <Link href="/agreements/4" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">Agreement #4 (Live)</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {!mounted ? (
            <div className="h-8 flex items-center">
              <span className="text-xs text-gray-500 font-mono">Not Connected</span>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 font-mono hidden sm:block">
                {chain ? chain.name : 'Not Connected'}
              </div>
              
              {!isConnected ? (
                <Button variant="secondary" className="text-xs" onClick={() => connect({ connector: connectors[0] })}>
                  Connect Wallet
                </Button>
              ) : isWrongNetwork ? (
                <Button variant="danger" className="text-xs" onClick={() => switchChain({ chainId: 11155111 })}>
                  Switch to Sepolia
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="verification">{address?.slice(0,6)}...{address?.slice(-4)}</Badge>
                  <Button variant="ghost" className="text-xs border border-gray-700" onClick={() => disconnect()}>Disconnect</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border-subtle)] py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-sm text-gray-500 flex justify-between">
        <p>Fairwork Escrow Prototype</p>
        <p>Phase 05 UI & Wallet</p>
      </div>
    </footer>
  );
}
