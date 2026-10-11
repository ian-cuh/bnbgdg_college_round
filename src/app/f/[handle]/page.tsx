import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Badge, CreditDisplay } from '@/components/ui';
import { mockFreelancers } from '@/lib/fixtures';

export const instant = false;

export default async function FreelancerStorefront({ params }: { params: Promise<{ handle: string }> }) {
  const handle = (await params).handle;
  const freelancer = mockFreelancers.find(f => f.handle === handle);
  
  if (!freelancer) return notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-start border-b border-[var(--color-border-subtle)] pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{freelancer.name}</h1>
            <Badge variant="verification">Verified Identity</Badge>
          </div>
          <p className="text-xl text-gray-400">{freelancer.role}</p>
          <div className="mt-4 flex gap-4 text-sm text-gray-500">
            <span>⭐ {freelancer.rating} Average</span>
            <span>✓ {freelancer.completed} Completed Agreements</span>
          </div>
        </div>
        <Link href={`/agreements/new?f=${freelancer.handle}`}>
          <Button className="px-6 py-2">Start Agreement</Button>
        </Link>
      </div>

      <h2 className="text-xl font-bold">Standard Packages</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {freelancer.packages.map(pkg => (
          <Card key={pkg.id} className="flex flex-col">
            <h3 className="font-semibold text-lg mb-2">{pkg.title}</h3>
            <p className="text-sm text-gray-400 mb-4 flex-1">Turnaround: {pkg.turnaround}</p>
            <div className="flex justify-between items-center mt-auto border-t border-[var(--color-border-subtle)] pt-4">
              <CreditDisplay amount={pkg.amount} size="md" />
              <Link href={`/agreements/new?f=${freelancer.handle}&pkg=${pkg.id}`}>
                <Button variant="secondary" className="text-xs">Select</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
      
      <Card className="mt-8 bg-transparent border-dashed border-gray-700">
        <h3 className="font-semibold mb-2">Custom Inquiry</h3>
        <p className="text-sm text-gray-400 mb-4">Need something not listed here? Start a custom agreement conversation.</p>
        <Link href={`/agreements/new?f=${freelancer.handle}`}>
          <Button variant="ghost" className="border border-gray-600">Propose Custom Agreement</Button>
        </Link>
      </Card>
    </div>
  );
}
