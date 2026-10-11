import { Badge, Card, CreditDisplay } from './ui';

type MilestoneType = { title: string; state: string; description: string; amount: number; deliveryDeadline: string; reviewDeadline?: string };
export function MilestoneCard({ milestone, index }: { milestone: MilestoneType, index: number }) {
  const stateColors: Record<string, 'default' | 'success' | 'warning' | 'dispute'> = {
    FUNDED: 'default',
    SUBMITTED: 'warning',
    REVISION_REQUESTED: 'warning',
    DISPUTED: 'dispute',
    RESOLVED_TERMINAL: 'success'
  };

  return (
    <Card className="mb-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-gray-500">M{index + 1}</span>
          <h3 className="font-semibold text-lg">{milestone.title}</h3>
          <Badge variant={stateColors[milestone.state] || 'default'}>{milestone.state}</Badge>
        </div>
        <p className="text-gray-400 text-sm mb-4">{milestone.description}</p>
        
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
          <div><span className="font-medium text-gray-400">Delivery:</span> {new Date(milestone.deliveryDeadline).toLocaleDateString()}</div>
          {milestone.reviewDeadline && (
            <div><span className="font-medium text-gray-400">Review:</span> {new Date(milestone.reviewDeadline).toLocaleDateString()}</div>
          )}
        </div>
      </div>
      <div className="flex md:flex-col items-end justify-between md:justify-start">
        <CreditDisplay amount={milestone.amount} size="lg" />
      </div>
    </Card>
  );
}
