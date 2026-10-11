const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/alch_6Dp9rgK9otQqnQsuxdsoo");
  const abi = [
    "function agreements(uint256) view returns (address buyer, address freelancer, address resolver, uint32 hardEnd, uint8 milestoneCount, bytes32 agreementHash)",
    "function milestones(uint256, uint8) view returns (uint256 amount, uint8 state, uint32 deliveryDeadline, uint32 reviewDuration, uint32 reviewDeadline, uint32 disputeOpenedAt)"
  ];
  const escrow = new ethers.Contract("0xDa9Aa06d571c0FbEa3bF43e504Ce1ABF7dd6Db91", abi, provider);

  for (let id = 1; id <= 5; id++) {
    try {
      const agr = await escrow.agreements(id);
      if (agr.buyer !== "0x0000000000000000000000000000000000000000") {
        const m0 = await escrow.milestones(id, 0);
        console.log("AGREEMENT_FOUND", id, agr.buyer, agr.freelancer, agr.resolver, m0.state, m0.amount.toString());
      }
    } catch(e) {}
  }
}

main().catch(console.error);
