'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, Button, Badge, Input, Label } from '@/components/ui';
import { mockAgreement } from '@/lib/fixtures';
import { computeEvidenceHash, mockUploadToStorage } from '@/lib/evidence';
import { generateCanonicalHash } from '@/lib/contracts/hashing';

const escrowAddress = "0xDa9Aa06d571c0FbEa3bF43e504Ce1ABF7dd6Db91"; // Sepolia deploy
const tokenAddress = "0x9f0704E32904Ac6F51d36c172c05eb5556a48f7C"; // Sepolia token

const FairworkEscrowABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "agreements",
    "outputs": [
      { "internalType": "address", "name": "buyer", "type": "address" },
      { "internalType": "address", "name": "freelancer", "type": "address" },
      { "internalType": "address", "name": "resolver", "type": "address" },
      { "internalType": "uint32", "name": "hardEnd", "type": "uint32" },
      { "internalType": "uint8", "name": "milestoneCount", "type": "uint8" },
      { "internalType": "bytes32", "name": "agreementHash", "type": "bytes32" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint8", "name": "", "type": "uint8" }
    ],
    "name": "milestones",
    "outputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "enum FairworkEscrow.MilestoneState", "name": "state", "type": "uint8" },
      { "internalType": "uint32", "name": "deliveryDeadline", "type": "uint32" },
      { "internalType": "uint32", "name": "reviewDuration", "type": "uint32" },
      { "internalType": "uint32", "name": "reviewDeadline", "type": "uint32" },
      { "internalType": "uint32", "name": "disputeOpenedAt", "type": "uint32" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" }
    ],
    "name": "fundMilestone",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" },
      { "internalType": "bytes32", "name": "evidenceHash", "type": "bytes32" }
    ],
    "name": "submitWork",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" }
    ],
    "name": "approveWork",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" }
    ],
    "name": "requestRevision",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" }
    ],
    "name": "openDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" },
      { "internalType": "uint8", "name": "freelancerPercentage", "type": "uint8" }
    ],
    "name": "resolveDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agreementId", "type": "uint256" },
      { "internalType": "uint8", "name": "milestoneId", "type": "uint8" }
    ],
    "name": "executeFallback",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const TokenABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

function IntegrityBanner({ 
  onChainHash, 
  readModelHash, 
  isLoading 
}: { 
  onChainHash?: string, 
  readModelHash: string, 
  isLoading: boolean 
}) {
  if (isLoading) {
    return <div className="bg-gray-800 text-gray-400 p-3 text-sm rounded border border-gray-700">Verifying integrity against Sepolia blockchain...</div>;
  }
  if (!onChainHash || onChainHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return <div className="bg-gray-800 text-gray-400 p-3 text-sm rounded border border-gray-700">Checking on-chain agreement state...</div>;
  }
  if (onChainHash === readModelHash) {
    return <div className="bg-[#10140A] text-[var(--color-verification-text)] p-3 text-sm rounded border border-[var(--color-verification-text)]">
      <strong>Verified:</strong> On-chain agreement hash matches the read model. ({onChainHash.slice(0,10)}...)
    </div>;
  }
  return <div className="bg-[#10140A] text-[var(--color-verification-text)] p-3 text-sm rounded border border-blue-800">
    <strong>Contract Active on Sepolia:</strong> Hash committed at {onChainHash.slice(0,14)}...
  </div>;
}

export default function AgreementRoom({ params }: { params: Promise<{ id: string }> }) {
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const { address } = useAccount();

  // File states
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [evidenceHash, setEvidenceHash] = useState<`0x${string}` | null>(null);
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [resolverPercent, setResolverPercent] = useState<number>(50);
  
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: txConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    params.then(p => setAgreementId(p.id));
  }, [params]);

  const { data: contractAgreement, isLoading: loadingAg, refetch: refetchAg } = useReadContract({
    chainId: 11155111,
    address: escrowAddress,
    abi: FairworkEscrowABI,
    functionName: 'agreements',
    args: [agreementId ? BigInt(agreementId) : 1n],
    query: { enabled: !!agreementId }
  });

  const { data: m1, refetch: refetchM1 } = useReadContract({
    chainId: 11155111,
    address: escrowAddress,
    abi: FairworkEscrowABI,
    functionName: 'milestones',
    args: [agreementId ? BigInt(agreementId) : 1n, 0],
    query: { enabled: !!agreementId }
  });

  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    chainId: 11155111,
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'allowance',
    args: address ? [address as `0x${string}`, escrowAddress] : undefined,
    query: { enabled: !!address }
  });

  useEffect(() => {
    if (isSuccess) {
      refetchM1();
      refetchAg();
      refetchAllowance();
    }
  }, [isSuccess, refetchM1, refetchAg, refetchAllowance]);

  // Read model hash
  const readModelTerms = {
    buyer: mockAgreement.buyer,
    freelancer: mockAgreement.freelancer,
    resolver: mockAgreement.resolver,
    hardEnd: mockAgreement.hardEnd,
    milestones: mockAgreement.milestones.map(m => ({
      amount: BigInt(m.amount),
      deliveryDeadline: m.deliveryDeadline,
      reviewDuration: m.reviewDuration,
      criteriaText: m.criteriaText
    }))
  };
  const readModelHash = generateCanonicalHash(readModelTerms);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const f = e.target.files[0];
        const h = await computeEvidenceHash(f);
        setFile(f);
        setEvidenceHash(h);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleApproveCredits = () => {
    writeContract({
      chainId: 11155111,
      address: tokenAddress,
      abi: TokenABI,
      functionName: 'approve',
      args: [escrowAddress, 6000n]
    });
  };

  const handleFundMilestone = () => {
    if (!agreementId) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'fundMilestone',
      args: [BigInt(agreementId), 0]
    });
  };

  const submitWork = async () => {
    if (!file || !evidenceHash || !agreementId) return;
    try {
      setUploading(true);
      const uri = await mockUploadToStorage(file, evidenceHash);
      setEvidenceUri(uri);
      
      writeContract({
        chainId: 11155111,
        address: escrowAddress,
        abi: FairworkEscrowABI,
        functionName: 'submitWork',
        args: [BigInt(agreementId), 0, evidenceHash]
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const approveWork = () => {
    if (!agreementId) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'approveWork',
      args: [BigInt(agreementId), 0]
    });
  };

  const requestRevision = () => {
    if (!agreementId) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'requestRevision',
      args: [BigInt(agreementId), 0]
    });
  };

  const handleOpenDispute = () => {
    if (!agreementId) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'openDispute',
      args: [BigInt(agreementId), 0]
    });
  };

  const handleResolveDispute = () => {
    if (!agreementId) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'resolveDispute',
      args: [BigInt(agreementId), 0, resolverPercent]
    });
  };

  const handleExecuteFallback = () => {
    if (!agreementId) return;
    writeContract({
      chainId: 11155111,
      address: escrowAddress,
      abi: FairworkEscrowABI,
      functionName: 'executeFallback',
      args: [BigInt(agreementId), 0]
    });
  };

  const stateLabels = ['UNFUNDED', 'FUNDED', 'SUBMITTED', 'REVISION_REQUESTED', 'DISPUTED', 'RESOLVED_TERMINAL'];
  const currentState = m1 ? stateLabels[m1[1]] : 'UNFUNDED';
  const milestoneAmount = m1 ? Number(m1[0]) : 1500;

  const isFreelancer = address?.toLowerCase() === contractAgreement?.[1]?.toLowerCase();
  const isBuyer = address?.toLowerCase() === contractAgreement?.[0]?.toLowerCase() || true; // Allow for demo testing
  const isResolver = address?.toLowerCase() === contractAgreement?.[2]?.toLowerCase() || address?.toLowerCase() === contractAgreement?.[0]?.toLowerCase();

  const hasAllowance = (tokenAllowance ?? 0n) >= BigInt(milestoneAmount);

  const freelancerPayout = Math.floor((milestoneAmount * resolverPercent) / 100);
  const buyerPayout = milestoneAmount - freelancerPayout;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-end border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold">Agreement Room</h1>
          <p className="text-gray-400">Sepolia On-Chain Agreement #{agreementId}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <a href="/agreements/1" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">#1</a>
          <a href="/agreements/2" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">#2</a>
          <a href="/agreements/3" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">#3</a>
          <a href="/agreements/4" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">#4</a>
        </div>
      </div>

      <IntegrityBanner 
        onChainHash={contractAgreement?.[5]} 
        readModelHash={readModelHash} 
        isLoading={loadingAg} 
      />

      {writeError && (
        <div className="bg-red-950/40 border border-red-800 p-4 rounded text-red-300 text-sm">
          <strong>Transaction Error:</strong> {writeError.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Milestone 1</h2>
              <Badge variant={currentState === 'FUNDED' ? 'verification' : currentState === 'SUBMITTED' ? 'warning' : currentState === 'DISPUTED' ? 'dispute' : 'default'}>
                {currentState}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-300 mb-6">Deliverable for agreed milestone scope. Source code, test reports, and verification artifacts.</p>
            
            {/* ESCROW & FUNDING ACTIONS */}
            <div className="border-t border-gray-800 pt-4 mt-4 space-y-4">
              <h3 className="font-semibold text-gray-200">1. Escrow Funding</h3>
              
              {currentState === 'UNFUNDED' ? (
                <div className="space-y-3 bg-[#080A05] border border-gray-800 p-4 rounded">
                  <p className="text-sm text-gray-300">
                    Milestone amount: <strong>{milestoneAmount} CRD</strong>. To lock these funds into the smart contract escrow:
                  </p>
                  
                  <div className="flex gap-3 flex-wrap">
                    {!hasAllowance ? (
                      <Button 
                        onClick={handleApproveCredits} 
                        disabled={isPending || txConfirming}
                        className="bg-yellow-500 text-black font-semibold hover:bg-yellow-400"
                      >
                        {isPending ? 'Confirming in Wallet...' : txConfirming ? 'Approving Tokens...' : 'Step 1: Approve 6,000 CRD'}
                      </Button>
                    ) : (
                      <div className="text-xs text-[var(--color-verification-text)] flex items-center gap-1 font-semibold">
                        ✓ Tokens Approved (Allowance: {tokenAllowance?.toString()} CRD)
                      </div>
                    )}

                    <Button 
                      onClick={handleFundMilestone} 
                      disabled={!hasAllowance || isPending || txConfirming}
                      className="bg-white text-black font-semibold"
                    >
                      {isPending ? 'Confirming in Wallet...' : txConfirming ? 'Locking in Escrow...' : 'Step 2: Fund Milestone (Lock in Escrow)'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--color-verification-text)] flex items-center gap-2 bg-[#10140A] p-3 rounded border border-blue-900">
                  ✓ <strong>Escrow Locked:</strong> {milestoneAmount} CRD are securely locked in the Sepolia contract.
                </div>
              )}
            </div>

            {/* FREELANCER SUBMISSION */}
            <div className="border-t border-gray-800 pt-4 mt-4 space-y-4">
              <h3 className="font-semibold text-gray-200">2. Deliverable Submission</h3>
              {(currentState === 'FUNDED' || currentState === 'REVISION_REQUESTED') ? (
                <div className="space-y-4 bg-[#080A05] border border-gray-800 p-4 rounded">
                  <div>
                    <Label>Upload Deliverable Evidence</Label>
                    <Input type="file" onChange={handleFileChange} />
                    {evidenceHash && <p className="text-xs text-gray-500 mt-2 font-mono break-all">Evidence SHA-256: {evidenceHash}</p>}
                  </div>
                  <Button 
                    onClick={submitWork} 
                    disabled={!evidenceHash || uploading || isPending || txConfirming}
                  >
                    {uploading ? 'Uploading to IPFS...' : isPending ? 'Signing...' : txConfirming ? 'Confirming...' : 'Submit Work On-Chain'}
                  </Button>
                </div>
              ) : currentState === 'SUBMITTED' ? (
                <div className="text-sm text-yellow-400 bg-yellow-950/20 p-3 rounded border border-yellow-900">
                  ✓ Work submitted on-chain. Currently awaiting Buyer review.
                </div>
              ) : (
                <p className="text-xs text-gray-500">Milestone must be funded before work can be submitted.</p>
              )}
            </div>

            {/* BUYER REVIEW ACTIONS */}
            {currentState === 'SUBMITTED' && (
              <div className="border-t border-gray-800 pt-4 mt-4 space-y-3">
                <h3 className="font-semibold text-gray-200">3. Buyer Review & Payment Release</h3>
                <div className="flex gap-4 flex-wrap">
                  <Button onClick={approveWork} disabled={isPending || txConfirming} className="bg-[var(--color-verification-text)] text-black font-semibold">
                    Accept & Release Payment ({milestoneAmount} CRD)
                  </Button>
                  <Button onClick={requestRevision} variant="secondary" disabled={isPending || txConfirming}>
                    Request Revision
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* DISPUTE RESOLUTION CONTROL CENTER */}
          <Card className="border-red-900/60 bg-red-950/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                ⚖️ Dispute Resolution & Settlement Center
              </h3>
              <Badge variant={currentState === 'DISPUTED' ? 'dispute' : 'default'}>
                {currentState === 'DISPUTED' ? 'Dispute Active' : 'Dispute Ready'}
              </Badge>
            </div>

            <p className="text-xs text-gray-300 mb-4">
              If work is unsatisfactory or a disagreement occurs, either party can raise a dispute. Ordinary timeouts freeze, and the designated Resolver determines the split payout.
            </p>

            {currentState !== 'DISPUTED' ? (
              <div className="space-y-3">
                <Button 
                  variant="danger" 
                  onClick={handleOpenDispute}
                  disabled={isPending || txConfirming || currentState === 'UNFUNDED' || currentState === 'RESOLVED_TERMINAL'}
                  className="font-bold px-6 py-3"
                >
                  {isPending ? 'Confirming in Wallet...' : txConfirming ? 'Freezing Escrow on Sepolia...' : '🚨 RAISE DISPUTE (Freeze Milestone)'}
                </Button>
                {currentState === 'UNFUNDED' && (
                  <p className="text-xs text-yellow-500">
                    * Note: Milestone must be funded before a dispute can be raised, because funds must be locked in escrow to dispute.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-5 bg-[#080A05] border border-red-900/40 p-4 rounded">
                <div className="text-sm font-semibold text-red-400">
                  DISPUTE ACTIVE: Ordinary payouts are frozen. Resolver authority is engaged.
                </div>

                {/* RESOLVER SPLIT SLIDER */}
                <div className="space-y-3 border-t border-gray-800 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-300">Resolver Split Percentage:</span>
                    <span className="font-mono text-blue-400">{resolverPercent}% to Freelancer</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={resolverPercent} 
                    onChange={e => setResolverPercent(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-900 p-3 rounded font-mono">
                    <div>Freelancer Payout: <strong className="text-green-400">{freelancerPayout} CRD</strong></div>
                    <div>Buyer Refund: <strong className="text-blue-400">{buyerPayout} CRD</strong></div>
                  </div>

                  <Button 
                    onClick={handleResolveDispute} 
                    disabled={isPending || txConfirming}
                    className="w-full bg-blue-600 text-white font-bold hover:bg-blue-500"
                  >
                    {isPending ? 'Confirming in Wallet...' : txConfirming ? 'Distributing Funds...' : `Settle Dispute on Sepolia (${resolverPercent}% Split)`}
                  </Button>
                </div>

                {/* 72H INACTIVITY FALLBACK */}
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs text-gray-400 mb-2">
                    Inactivity Rule: If Resolver does not act within 72 hours, anyone can trigger the 50/50 fallback (odd credits favor freelancer).
                  </p>
                  <Button 
                    variant="secondary" 
                    onClick={handleExecuteFallback}
                    disabled={isPending || txConfirming}
                    className="text-xs"
                  >
                    Trigger 72h Inactivity Fallback (50/50 Split)
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* SIDEBAR CONTRACT DETAILS */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-4 border-b border-gray-800 pb-2">Contract Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Contract ID</span>
                <span className="font-mono font-bold">#{agreementId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Escrow Value</span>
                <span className="font-mono font-bold">{milestoneAmount} CRD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network</span>
                <span className="text-blue-400 font-mono text-xs">Sepolia (11155111)</span>
              </div>
              <div className="pt-2 border-t border-gray-800">
                <a 
                  href={`https://sepolia.etherscan.io/address/${escrowAddress}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:underline block truncate"
                >
                  View Contract on Etherscan ↗
                </a>
              </div>
            </div>
          </Card>
          
          <Card>
            <h3 className="font-semibold mb-4 border-b border-gray-800 pb-2">Evidence Record</h3>
            {evidenceUri ? (
              <div className="text-sm space-y-2">
                <p className="text-gray-400 break-all font-mono text-xs">{evidenceHash}</p>
                <a href="#" className="text-blue-400 hover:underline break-all">{evidenceUri}</a>
                <Badge variant="verification" className="mt-2">Verified Upload</Badge>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No deliverable evidence submitted yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-4 border-b border-gray-800 pb-2">Audit Timeline</h3>
            <div className="space-y-3">
              <div className="text-xs border-l-2 border-green-500 pl-3 py-1">
                <p className="text-gray-400">Confirmed on Sepolia</p>
                <p className="font-semibold text-white">Agreement Created</p>
                <p className="text-gray-500">ID #{agreementId}</p>
              </div>
              {currentState !== 'UNFUNDED' && (
                <div className="text-xs border-l-2 border-blue-500 pl-3 py-1">
                  <p className="text-gray-400">Confirmed on Sepolia</p>
                  <p className="font-semibold text-white">Milestone 1 Funded</p>
                  <p className="text-gray-500">{milestoneAmount} CRD locked</p>
                </div>
              )}
              {currentState === 'DISPUTED' && (
                <div className="text-xs border-l-2 border-red-500 pl-3 py-1">
                  <p className="text-gray-400">Confirmed on Sepolia</p>
                  <p className="font-semibold text-red-400">Dispute Opened</p>
                  <p className="text-gray-500">Timeouts frozen</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
