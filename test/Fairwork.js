const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fairwork Contracts", function () {
  let token;
  let escrow;
  let deployer;
  let buyer;
  let freelancer;
  let resolver;

  beforeEach(async function () {
    [deployer, buyer, freelancer, resolver] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("FairworkToken");
    token = await Token.deploy([buyer.address, freelancer.address], [4000, 2000]);

    const Escrow = await ethers.getContractFactory("FairworkEscrow");
    escrow = await Escrow.deploy(token.address);
  });

  describe("FairworkToken", function () {
    it("Should mint exactly 6000 tokens", async function () {
      expect(await token.totalSupply()).to.equal(6000n);
    });
    
    it("Should have 0 decimals", async function () {
      expect(await token.decimals()).to.equal(0);
    });

    it("Should revert on deployment if sum != 6000", async function () {
      const Token = await ethers.getContractFactory("FairworkToken");
      await expect(Token.deploy([buyer.address], [5999])).to.be.revertedWith("Total supply must be exactly 6000");
    });
  });

  describe("FairworkEscrow", function () {
    const agreementHash = ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32);
    let hardEnd;

    beforeEach(async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      hardEnd = latestBlock.timestamp + 30 * 24 * 3600; // 30 days
      
      await token.connect(buyer).approve(await escrow.address, 1000n);
    });

    it("Should create an agreement and fund a milestone", async function () {
      const milestones = [{
        amount: 500n,
        deliveryDeadline: hardEnd - 10000,
        reviewDuration: 7 * 24 * 3600
      }];
      
      await escrow.connect(buyer).createAgreement(
        agreementHash,
        freelancer.address,
        resolver.address,
        hardEnd,
        milestones
      );

      await expect(escrow.connect(buyer).fundMilestone(1, 0))
        .to.emit(escrow, "MilestoneFunded")
        .withArgs(1, 0, 500n);
        
      expect(await token.balanceOf(escrow.address)).to.equal(500n);
    });

    it("Should allow submission and approval", async function () {
      const milestones = [{
        amount: 500n,
        deliveryDeadline: hardEnd - 10000,
        reviewDuration: 7 * 24 * 3600
      }];
      
      await escrow.connect(buyer).createAgreement(
        agreementHash, freelancer.address, resolver.address, hardEnd, milestones
      );
      await escrow.connect(buyer).fundMilestone(1, 0);

      const evidenceHash = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);
      await escrow.connect(freelancer).submitWork(1, 0, evidenceHash);

      const ms = await escrow.milestones(1, 0);
      expect(ms.state).to.equal(2); // SUBMITTED

      await expect(escrow.connect(buyer).approveWork(1, 0))
        .to.emit(escrow, "WorkApproved")
        .withArgs(1, 0);

      expect(await token.balanceOf(freelancer.address)).to.equal(2500n); // 2000 initial + 500
    });
    
    it("Should allow dispute and 50/50 fallback with odd credit to freelancer", async function () {
      const milestones = [{ amount: 5n, deliveryDeadline: hardEnd, reviewDuration: 1000 }];
      await token.connect(buyer).approve(escrow.address, 5n);
      await escrow.connect(buyer).createAgreement(agreementHash, freelancer.address, resolver.address, hardEnd, milestones);
      await escrow.connect(buyer).fundMilestone(1, 0);
      
      await escrow.connect(buyer).openDispute(1, 0);
      
      await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);
      
      const fBalBefore = await token.balanceOf(freelancer.address);
      const bBalBefore = await token.balanceOf(buyer.address);
      
      await escrow.connect(resolver).executeFallback(1, 0);
      
      const fBalAfter = await token.balanceOf(freelancer.address);
      const bBalAfter = await token.balanceOf(buyer.address);
      
      expect(fBalAfter - fBalBefore).to.equal(3n);
      expect(bBalAfter - bBalBefore).to.equal(2n);
    });
  });
});
