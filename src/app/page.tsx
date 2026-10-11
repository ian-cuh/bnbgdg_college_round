import Link from 'next/link';
import { Card, Button, Badge } from '@/components/ui';
import { mockFreelancers } from '@/lib/fixtures';

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-16 border-b border-[var(--color-border-subtle)]">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Get Paid for What You Deliver.</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Verifiable agreements, milestone escrow, and impartial dispute resolution. 
          No middleman fees, just code.
        </p>
        <Link href="/dashboard">
          <Button className="px-8 py-3 text-lg">Enter Dashboard</Button>
        </Link>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Featured Freelancers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockFreelancers.map(f => (
            <Card key={f.handle} className="flex flex-col h-full">
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{f.name}</h3>
                  <Badge variant="verification">Verified</Badge>
                </div>
                <p className="text-sm text-gray-400">{f.role}</p>
              </div>
              <div className="text-sm text-gray-500 mb-6 flex-1">
                ⭐ {f.rating} ({f.completed} completed)
              </div>
              <Link href={`/f/${f.handle}`} className="w-full mt-auto">
                <Button variant="secondary" className="w-full">View Storefront</Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
