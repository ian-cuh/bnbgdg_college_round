export const mockFreelancers = [
  {
    handle: "alice_design",
    name: "Alice D.",
    role: "Product Designer",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    rating: 4.9,
    completed: 42,
    packages: [
      { id: "pkg_1", title: "Brand Identity", amount: 500, turnaround: "14 days" },
      { id: "pkg_2", title: "Landing Page UI", amount: 800, turnaround: "21 days" }
    ]
  },
  {
    handle: "bob_web",
    name: "Bob W.",
    role: "Full-Stack Developer",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    rating: 5.0,
    completed: 18,
    packages: [
      { id: "pkg_3", title: "Smart Contract Audit", amount: 1500, turnaround: "7 days" },
      { id: "pkg_4", title: "DApp Frontend", amount: 2000, turnaround: "30 days" }
    ]
  },
  {
    handle: "charlie_motion",
    name: "Charlie M.",
    role: "Motion Graphics",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    rating: 4.7,
    completed: 56,
    packages: [
      { id: "pkg_5", title: "Explainer Video", amount: 1200, turnaround: "21 days" },
      { id: "pkg_6", title: "Logo Animation", amount: 300, turnaround: "5 days" }
    ]
  }
];

export const mockDashboardMetrics = {
  buyer: {
    available: 3500,
    locked: 1500,
    released: 800,
    refunded: 200
  },
  freelancer: {
    available: 1200,
    locked: 1500,
    released: 3300,
    refunded: 0
  }
};

export const mockAgreement = {
  id: "agr_0x123",
  title: "DApp Frontend Development",
  freelancer: "0x0000000000000000000000000000000000000002",
  buyer: "0x0000000000000000000000000000000000000001",
  resolver: "0x0000000000000000000000000000000000000003",
  totalAmount: 2000,
  hardEnd: Math.floor(Date.now() / 1000) + 30 * 86400,
  milestones: [
    {
      id: "m_1",
      title: "UI Scaffolding & Setup",
      description: "Initialize Next.js project with Tailwind and basic component library.",
      criteriaText: "Must pass all UI unit tests.",
      amount: 500,
      state: "RESOLVED_TERMINAL",
      deliveryDeadline: Math.floor(Date.now() / 1000) + 5 * 86400,
      reviewDuration: 7 * 86400,
    },
    {
      id: "m_2",
      title: "Smart Contract Integration",
      description: "Connect wagmi/viem and implement escrow funding logic.",
      criteriaText: "Must connect cleanly to testnet with proper error handling.",
      amount: 1000,
      state: "SUBMITTED",
      deliveryDeadline: Math.floor(Date.now() / 1000) + 15 * 86400,
      reviewDuration: 7 * 86400,
      reviewDeadline: Math.floor(Date.now() / 1000) + 22 * 86400,
    },
    {
      id: "m_3",
      title: "Final Polish & Testing",
      description: "End-to-end testing of dispute lifecycle.",
      criteriaText: "100% test coverage for invariant states.",
      amount: 500,
      state: "FUNDED",
      deliveryDeadline: Math.floor(Date.now() / 1000) + 25 * 86400,
      reviewDuration: 7 * 86400,
    }
  ],
  timeline: [
    { id: "t_1", date: new Date(Date.now() - 10 * 86400000).toISOString(), actor: "Buyer", action: "Funded Milestone 1" },
    { id: "t_2", date: new Date(Date.now() - 8 * 86400000).toISOString(), actor: "Freelancer", action: "Submitted Milestone 1 Work" },
    { id: "t_3", date: new Date(Date.now() - 7 * 86400000).toISOString(), actor: "Buyer", action: "Approved Milestone 1" },
    { id: "t_4", date: new Date(Date.now() - 6 * 86400000).toISOString(), actor: "Buyer", action: "Funded Milestone 2" },
    { id: "t_5", date: new Date(Date.now() - 1 * 86400000).toISOString(), actor: "Freelancer", action: "Submitted Milestone 2 Work" },
  ]
};
