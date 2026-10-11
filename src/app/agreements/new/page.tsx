'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Button, Label, Input, Textarea, Badge } from '@/components/ui';
import { generateCanonicalHash, AgreementTerms } from '@/lib/contracts/hashing';
import { mockFreelancers } from '@/lib/fixtures';

// Minimal ABI for creating an agreement
const FairworkEscrowABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "agreementHash", "type": "bytes32" },
      { "internalType": "address", "name": "freelancer", "type": "address" },
      { "internalType": "address", "name": "resolver", "type": "address" },
      { "internalType": "uint32", "name": "hardEnd", "type": "uint32" },
      {
        "components": [
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint32", "name": "deliveryDeadline", "type": "uint32" },
          { "internalType": "uint32", "name": "reviewDuration", "type": "uint32" }
        ],
        "internalType": "struct FairworkEscrow.MilestoneParams[]",
        "name": "msParams",
        "type": "tuple[]"
      }
    ],
    "name": "createAgreement",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

function AgreementBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [freelancer, setFreelancer] = useState('');
  const [resolver, setResolver] = useState('');
  const [hardEnd, setHardEnd] = useState('');
  const [packageBanner, setPackageBanner] = useState<{ title: string; subtitle: string; isCustom?: boolean } | null>(null);
  
  const [milestones, setMilestones] = useState([
    { title: '', criteriaText: '', amount: '', deliveryDeadline: '', reviewDuration: '7' }
  ]);

  // Read URL query parameters to pre-fill package or custom inquiry
  useEffect(() => {
    const handleParam = searchParams.get('f');
    const pkgParam = searchParams.get('pkg');

    if (handleParam) {
      const fl = mockFreelancers.find(f => f.handle === handleParam);
      if (fl) {
        setFreelancer(fl.address || '');

        if (pkgParam) {
          const selectedPkg = fl.packages.find(p => p.id === pkgParam);
          if (selectedPkg) {
            const turnaroundDays = parseInt(selectedPkg.turnaround) || 14;
            const deliveryDate = new Date(Date.now() + turnaroundDays * 86400000).toISOString().split('T')[0];
            const computedHardEnd = new Date(Date.now() + (turnaroundDays + 30) * 86400000).toISOString().split('T')[0];

            setHardEnd(computedHardEnd);
            setMilestones([
              {
                title: selectedPkg.title,
                criteriaText: `Deliverable for standard package "${selectedPkg.title}" (${selectedPkg.turnaround} turnaround). Source code, build artifacts, and test reports.`,
                amount: String(selectedPkg.amount),
                deliveryDeadline: deliveryDate,
                reviewDuration: '7'
              }
            ]);
            setPackageBanner({
              title: `Standard Package: ${selectedPkg.title} (${selectedPkg.amount} CRD)`,
              subtitle: `Configured for ${fl.name} (${selectedPkg.turnaround} turnaround). Terms have been pre-filled below.`
            });
            return;
          }
        }

        // Custom Inquiry
        setPackageBanner({
          title: `Custom Agreement with ${fl.name}`,
          subtitle: `Define your custom milestone scope, deadlines, and credit compensation below.`,
          isCustom: true
        });
      }
    }
  }, [searchParams]);

  const { data: hashData, isPending, writeContract, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: hashData });

  useEffect(() => {
    if (isConfirmed) {
      router.push('/dashboard');
    }
  }, [isConfirmed, router]);

  const parsedTerms = useMemo((): AgreementTerms | null => {
    try {
      const hEnd = Math.floor(new Date(hardEnd).getTime() / 1000);
      if (!address || isNaN(hEnd) || milestones.length === 0 || milestones.length > 5) return null;
      
      const parsedMilestones = milestones.map(m => {
        const amt = BigInt(m.amount);
        const dDead = Math.floor(new Date(m.deliveryDeadline).getTime() / 1000);
        const rDur = Math.floor(parseInt(m.reviewDuration) * 86400); // days to seconds
        
        if (isNaN(dDead) || isNaN(rDur) || amt <= BigInt(0)) throw new Error('Invalid');
        return {
          amount: amt,
          deliveryDeadline: dDead,
          reviewDuration: rDur,
          criteriaText: m.criteriaText
        };
      });

      return {
        buyer: address,
        freelancer,
        resolver: resolver || '0x0000000000000000000000000000000000000000',
        hardEnd: hEnd,
        milestones: parsedMilestones
      };
    } catch (e) {
      return null;
    }
  }, [address, freelancer, resolver, hardEnd, milestones]);

  const termsHash = parsedTerms ? generateCanonicalHash(parsedTerms) : null;
  const escrowAddress = "0xDa9Aa06d571c0FbEa3bF43e504Ce1ABF7dd6Db91"; // Sepolia deploy

  const handleCreate = () => {
    if (!parsedTerms || !termsHash) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'createAgreement',
      args: [
        termsHash,
        parsedTerms.freelancer as `0x${string}`,
        (parsedTerms.resolver || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        Math.floor(parsedTerms.hardEnd),
        parsedTerms.milestones.map(m => ({
          amount: m.amount,
          deliveryDeadline: Math.floor(m.deliveryDeadline),
          reviewDuration: Math.floor(m.reviewDuration)
        }))
      ],
    });
  };

  const addMilestone = () => {
    if (milestones.length < 5) {
      setMilestones([...milestones, { title: '', criteriaText: '', amount: '', deliveryDeadline: '', reviewDuration: '7' }]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Build Agreement</h1>
        <p className="text-gray-400">Structure milestones, set deadlines, and preview the canonical terms hash.</p>
      </div>

      {packageBanner && (
        <div className={`p-4 rounded border text-sm ${packageBanner.isCustom ? 'bg-blue-950/30 border-blue-800 text-blue-300' : 'bg-[#10140A] border-[var(--color-verification-text)] text-[var(--color-verification-text)]'}`}>
          <div className="font-semibold">{packageBanner.title}</div>
          <div className="text-xs mt-1 text-gray-300">{packageBanner.subtitle}</div>
        </div>
      )}

      <Card>
        <h2 className="text-xl font-semibold mb-6 border-b border-[var(--color-border-subtle)] pb-2">1. Participants</h2>
        <div className="space-y-4">
          <div>
            <Label>Freelancer Address (0x...)</Label>
            <Input value={freelancer} onChange={e => setFreelancer(e.target.value)} placeholder="0x..." />
          </div>
          <div>
            <Label>Designated Resolver (Optional)</Label>
            <Input value={resolver} onChange={e => setResolver(e.target.value)} placeholder="0x..." />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-6 border-b border-[var(--color-border-subtle)] pb-2">2. Milestones</h2>
        <div className="space-y-6">
          {milestones.map((m, idx) => (
            <div key={idx} className="border border-[var(--color-border-subtle)] p-4 rounded-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Milestone {idx + 1}</h3>
                {milestones.length > 1 && (
                  <Button variant="ghost" className="text-xs text-[var(--color-dispute-text)]" onClick={() => {
                    const newM = [...milestones];
                    newM.splice(idx, 1);
                    setMilestones(newM);
                  }}>Remove</Button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Acceptance Criteria</Label>
                  <Textarea value={m.criteriaText} onChange={e => {
                    const newM = [...milestones];
                    newM[idx].criteriaText = e.target.value;
                    setMilestones(newM);
                  }} placeholder="Specific conditions for approval..." rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Amount (Credits)</Label>
                    <Input type="number" min="1" value={m.amount} onChange={e => {
                      const newM = [...milestones];
                      newM[idx].amount = e.target.value;
                      setMilestones(newM);
                    }} />
                  </div>
                  <div>
                    <Label>Delivery Date</Label>
                    <Input type="date" value={m.deliveryDeadline} onChange={e => {
                      const newM = [...milestones];
                      newM[idx].deliveryDeadline = e.target.value;
                      setMilestones(newM);
                    }} />
                  </div>
                  <div>
                    <Label>Review (Days)</Label>
                    <Input type="number" min="1" value={m.reviewDuration} onChange={e => {
                      const newM = [...milestones];
                      newM[idx].reviewDuration = e.target.value;
                      setMilestones(newM);
                    }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {milestones.length < 5 && (
            <Button variant="secondary" className="w-full border-dashed" onClick={addMilestone}>
              + Add Milestone
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-6 border-b border-[var(--color-border-subtle)] pb-2">3. Contract Settings</h2>
        <div className="space-y-4">
          <div>
            <Label>Hard End Date</Label>
            <Input type="date" value={hardEnd} onChange={e => setHardEnd(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Absolute timeout date for all activity.</p>
          </div>
        </div>
      </Card>

      <Card className="bg-gray-900 border-gray-700">
        <h3 className="font-semibold mb-2">Canonical Integrity Hash</h3>
        {termsHash ? (
          <div className="break-all font-mono text-sm text-[var(--color-verification-text)]">{termsHash}</div>
        ) : (
          <div className="text-sm text-gray-500">Fill all valid fields above to generate canonical hash...</div>
        )}
      </Card>

      <div className="bg-[#10140A] border border-[var(--color-border-subtle)] p-4 rounded text-sm space-y-2">
        <div className="font-semibold text-gray-200">Validation Checklist:</div>
        {!mounted ? (
          <div className="text-gray-400 text-xs">Checking wallet connection...</div>
        ) : !address ? (
          <div className="text-yellow-400 text-xs flex items-center gap-2">
            ⚠️ <span>Wallet not connected. Click <strong>Connect Wallet</strong> in the top header.</span>
          </div>
        ) : (
          <div className="text-[var(--color-verification-text)] text-xs flex items-center gap-2">
            ✓ <span>Wallet connected: {address.slice(0, 6)}...{address.slice(-4)}</span>
          </div>
        )}
        {!freelancer || !freelancer.startsWith('0x') || freelancer.length !== 42 ? (
          <div className="text-yellow-400 text-xs flex items-center gap-2">
            ⚠️ <span>Freelancer address must be a valid 42-character Ethereum address (starts with 0x).</span>
          </div>
        ) : (
          <div className="text-[var(--color-verification-text)] text-xs flex items-center gap-2">
            ✓ <span>Freelancer address specified</span>
          </div>
        )}
        {!hardEnd || isNaN(new Date(hardEnd).getTime()) ? (
          <div className="text-yellow-400 text-xs flex items-center gap-2">
            ⚠️ <span>Hard End Date must be selected in section 3.</span>
          </div>
        ) : (
          <div className="text-[var(--color-verification-text)] text-xs flex items-center gap-2">
            ✓ <span>Hard End Date set: {hardEnd}</span>
          </div>
        )}
        {!milestones.every(m => m.amount && Number(m.amount) > 0 && m.deliveryDeadline && m.criteriaText) ? (
          <div className="text-yellow-400 text-xs flex items-center gap-2">
            ⚠️ <span>All milestones must have positive credits (&gt; 0), a delivery date, and acceptance criteria.</span>
          </div>
        ) : (
          <div className="text-[var(--color-verification-text)] text-xs flex items-center gap-2">
            ✓ <span>Milestone terms and criteria defined</span>
          </div>
        )}
      </div>

      {writeError && (
        <div className="bg-red-950/40 border border-red-800 p-3 rounded text-[var(--color-dispute-text)] text-xs">
          <strong>Transaction Error:</strong> {writeError.message}
        </div>
      )}

      <div className="flex justify-end items-center gap-4 pt-4 border-t border-[var(--color-border-subtle)]">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button 
          variant="primary"
          onClick={handleCreate} 
          disabled={!termsHash || isPending || isConfirming}
          className="px-6 py-3 font-bold"
        >
          {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Deploying to Sepolia...' : 'Create Agreement On-Chain'}
        </Button>
      </div>
    </div>
  );
}

export default function NewAgreementPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto text-gray-400 py-12 text-center">Loading Agreement Builder...</div>}>
      <AgreementBuilderContent />
    </Suspense>
  );
}
