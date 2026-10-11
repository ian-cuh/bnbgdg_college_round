'use client';

import React, { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Card, CreditDisplay } from '@/components/ui';
import { mockDashboardMetrics } from '@/lib/fixtures';

const tokenAddress = "0x9f0704E32904Ac6F51d36c172c05eb5556a48f7C";
const escrowAddress = "0xDa9Aa06d571c0FbEa3bF43e504Ce1ABF7dd6Db91";

const TokenABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { address } = useAccount();
  const [role, setRole] = useState<'buyer' | 'freelancer'>('buyer');

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: chainBalance, isError } = useReadContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address }
  });

  const metrics = mockDashboardMetrics[role];
  const cachedAvailable = metrics.available;
  const actualAvailable = chainBalance ? Number(chainBalance) : null;
  
  const hasMismatch = actualAvailable !== null && actualAvailable !== cachedAvailable;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-400">Track your credits, escrow, and milestone activity.</p>
        </div>
        <div className="flex gap-2 bg-[#080A05] p-1 border border-gray-800 rounded">
          <button 
            className={`px-4 py-1 text-sm rounded ${role === 'buyer' ? 'bg-gray-800 text-white' : 'text-gray-400'}`}
            onClick={() => setRole('buyer')}
          >
            Buyer
          </button>
          <button 
            className={`px-4 py-1 text-sm rounded ${role === 'freelancer' ? 'bg-gray-800 text-white' : 'text-gray-400'}`}
            onClick={() => setRole('freelancer')}
          >
            Freelancer
          </button>
        </div>
      </div>

      {mounted && !address && (
        <div className="bg-yellow-950/20 border border-yellow-900/50 p-4 rounded text-yellow-500 text-sm">
          Please connect your wallet to verify live balances. Displaying cached read-model data.
        </div>
      )}

      {mounted && hasMismatch && (
        <div className="bg-red-950/20 border border-red-900/50 p-4 rounded text-red-400 text-sm flex justify-between items-center">
          <div>
            <strong>Reconciliation Warning:</strong> Cached available balance ({cachedAvailable} FWC) differs from your live on-chain balance ({actualAvailable} FWC).
          </div>
          <button className="bg-red-900 text-white px-3 py-1 rounded text-xs hover:bg-red-800 transition">Refresh Indexer</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-[var(--color-verification-text)] bg-[var(--color-verification-text)]/5">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Available Credits</h3>
          <CreditDisplay amount={mounted ? (actualAvailable ?? cachedAvailable) : cachedAvailable} size="lg" />
          <p className="text-xs text-gray-500 mt-2">Liquid wallet balance.</p>
        </Card>
        
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Locked in Escrow</h3>
          <CreditDisplay amount={metrics.locked} size="lg" />
          <p className="text-xs text-gray-500 mt-2">Funds committed to active milestones.</p>
        </Card>

        {role === 'freelancer' ? (
          <Card>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Released Earnings</h3>
            <CreditDisplay amount={metrics.released} size="lg" />
            <p className="text-xs text-gray-500 mt-2">Total approved payouts received.</p>
          </Card>
        ) : (
          <Card>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Released to Freelancers</h3>
            <CreditDisplay amount={metrics.released} size="lg" />
            <p className="text-xs text-gray-500 mt-2">Total funds paid out.</p>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Refunded Credits</h3>
          <CreditDisplay amount={metrics.refunded} size="lg" />
          <p className="text-xs text-gray-500 mt-2">Recovered from timeouts/disputes.</p>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">Active On-Chain Agreements (Sepolia)</h2>
        <div className="space-y-4">
          <div className="bg-[#10140A] border border-[var(--color-border-strong)] p-5 rounded flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white">Agreement #4</span>
                <span className="text-xs bg-yellow-950/60 border border-yellow-800 text-yellow-400 px-2 py-0.5 rounded">Milestone 1: Ready to Fund & Manage</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                Buyer: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x9FaF...1ec8'} | Freelancer: 0x3C44...93BC (bob_web)
              </p>
              <div className="text-sm font-semibold text-gray-300 mt-2">
                Escrow Value: 1,500 CRD
              </div>
            </div>
            <a href="/agreements/4">
              <button className="bg-white text-black px-5 py-2.5 rounded font-semibold text-sm hover:bg-gray-200 transition">
                Open Agreement Room & Manage Escrow →
              </button>
            </a>
          </div>

          <div className="bg-[#10140A] border border-gray-800 p-4 rounded flex justify-between items-center text-sm">
            <div>
              <span className="font-semibold text-gray-300">Agreement #2</span>
              <span className="text-xs text-gray-500 ml-3">1,500 CRD</span>
            </div>
            <a href="/agreements/2" className="text-xs text-blue-400 hover:underline">
              Open Room #2 &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
