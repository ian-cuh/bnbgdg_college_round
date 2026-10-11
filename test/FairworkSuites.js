const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fairwork T1-T9 Test Suites", function () {
  let token, escrow;
  let deployer, buyer, freelancer, resolver, outsider;
  let hardEnd;

  beforeEach(async function () {
    [deployer, buyer, freelancer, resolver, outsider] = await ethers.getSigners();
    
    // Deploy Token with exact 6000 supply
    const Token = await ethers.getContractFactory("FairworkToken");
    token = await Token.deploy([buyer.address, freelancer.address], [4000, 2000]);

    // Deploy Escrow
    const Escrow = await ethers.getContractFactory("FairworkEscrow");
    escrow = await Escrow.deploy(token.address);

    const latestBlock = await ethers.provider.getBlock("latest");
    hardEnd = latestBlock.timestamp + 30 * 24 * 3600; // 30 days
  });

  const getAgreementHash = (milestones, hardEnd, resolverAddr) => {
    const encodedMilestones = milestones.map(m => 
      ethers.utils.defaultAbiCoder.encode(["uint256", "uint32", "uint32"], [m.amount, m.deliveryDeadline, m.reviewDuration])
    );
    return ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["uint8", "uint32", "address", "bytes[]"],
        [milestones.length, hardEnd, resolverAddr, encodedMilestones]
      )
    );
  };

  describe("T1 - Fixed supply and allocation validation", function () {
    it("Supply equals exactly 6,000 whole credits after deployment", async function () {
      expect(await token.totalSupply()).to.equal(6000n);
    });

    it("Valid configured allocations sum to exactly 6,000", async function () {
      expect(await token.balanceOf(buyer.address)).to.equal(4000n);
      expect(await token.balanceOf(freelancer.address)).to.equal(2000n);
    });

    it("Invalid totals revert on deployment", async function () {
      const Token = await ethers.getContractFactory("FairworkToken");
      await expect(Token.deploy([buyer.address], [6001n])).to.be.revertedWith("Total supply must be exactly 6000");
      await expect(Token.deploy([buyer.address, freelancer.address], [5000n, 999n])).to.be.revertedWith("Total supply must be exactly 6000");
    });

    it("Negative/Fractional inputs are not possible due to uint256, 0 allocation reverts", async function () {
      const Token = await ethers.getContractFactory("FairworkToken");
      await expect(Token.deploy([buyer.address], [0n])).to.be.revertedWith("Allocation must be positive");
    });

    it("Transfers do not change total supply", async function () {
      await token.connect(buyer).transfer(freelancer.address, 100n);
      expect(await token.totalSupply()).to.equal(6000n);
    });
  });

  describe("T2 - Funding and escrow conservation", function () {
    let agrId;
    beforeEach(async function () {
      const ms = [{ amount: 1000n, deliveryDeadline: hardEnd - 100, reviewDuration: 100 }];
      const hash = getAgreementHash(ms, hardEnd, resolver.address);
      await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, ms);
      agrId = 1;
      await token.connect(buyer).approve(escrow.address, 2000n);
    });

    it("Only the buyer can fund a milestone", async function () {
      await expect(escrow.connect(freelancer).fundMilestone(agrId, 0)).to.be.revertedWithCustomError(escrow, "Unauthorized");
    });

    it("Each milestone is funded no more than once", async function () {
      await escrow.connect(buyer).fundMilestone(agrId, 0);
      await expect(escrow.connect(buyer).fundMilestone(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("Total account balances plus locked escrow always equals 6000", async function () {
      await escrow.connect(buyer).fundMilestone(agrId, 0);
      const b = await token.balanceOf(buyer.address);
      const f = await token.balanceOf(freelancer.address);
      const e = await token.balanceOf(escrow.address);
      expect(BigInt(b) + BigInt(f) + BigInt(e)).to.equal(6000n);
    });

    it("Unfunded milestones cannot be submitted, accepted, disputed, or settled", async function () {
      await expect(escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32))).to.be.revertedWithCustomError(escrow, "InvalidState");
      await expect(escrow.connect(buyer).approveWork(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
      await expect(escrow.connect(buyer).openDispute(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("T3 & T4 - Delivery, Review, Revisions, and Boundaries", function () {
    let agrId, deliveryDeadline, reviewDuration;
    beforeEach(async function () {
      deliveryDeadline = hardEnd - 3600;
      reviewDuration = 7200; // 2 hours
      const ms = [{ amount: 500n, deliveryDeadline, reviewDuration }];
      const hash = getAgreementHash(ms, hardEnd, resolver.address);
      await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, ms);
      agrId = 1;
      await token.connect(buyer).approve(escrow.address, 1000n);
      await escrow.connect(buyer).fundMilestone(agrId, 0);
    });

    it("Valid submissions accepted before deadline", async function () {
      await expect(escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32)))
        .to.emit(escrow, "WorkSubmitted").withArgs(agrId, 0, ethers.utils.hexZeroPad("0x1", 32));
    });

    it("User actions fail at the exact delivery deadline", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [deliveryDeadline]);
      await ethers.provider.send("evm_mine", []);
      await expect(escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32))).to.be.revertedWithCustomError(escrow, "DeadlinePassed");
    });

    it("Revision requests reset the review window and cap at hard end", async function () {
      await escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32));
      await escrow.connect(buyer).requestRevision(agrId, 0);
      
      // Move close to hard end
      await ethers.provider.send("evm_setNextBlockTimestamp", [hardEnd - 100]);
      await ethers.provider.send("evm_mine", []);
      
      await escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x2", 32));
      const m = await escrow.milestones(agrId, 0);
      expect(m.reviewDeadline).to.equal(hardEnd);
    });

    it("Revisions and new submissions at or after hard end fail", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [hardEnd]);
      await ethers.provider.send("evm_mine", []);
      await expect(escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32))).to.be.revertedWithCustomError(escrow, "DeadlinePassed");
    });
  });

  describe("T5 & T8 - Timeouts, Hard-end refunds & terminal-state safety", function () {
    let agrId, deliveryDeadline, reviewDuration;
    beforeEach(async function () {
      deliveryDeadline = hardEnd - 3600;
      reviewDuration = 7200;
      const ms = [{ amount: 500n, deliveryDeadline, reviewDuration }];
      const hash = getAgreementHash(ms, hardEnd, resolver.address);
      await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, ms);
      agrId = 1;
      await token.connect(buyer).approve(escrow.address, 1000n);
      await escrow.connect(buyer).fundMilestone(agrId, 0);
    });

    it("Buyer can reclaim if no valid submission exists by delivery deadline", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [deliveryDeadline]);
      await ethers.provider.send("evm_mine", []);
      await expect(escrow.connect(buyer).reclaimUnsubmitted(agrId, 0)).to.emit(escrow, "RefundReclaimed").withArgs(agrId, 0, "Delivery Timeout");
    });

    it("Freelancer can claim payment after applicable review deadline", async function () {
      await escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32));
      const m = await escrow.milestones(agrId, 0);
      await ethers.provider.send("evm_setNextBlockTimestamp", [Number(m.reviewDeadline)]);
      await ethers.provider.send("evm_mine", []);
      await expect(escrow.connect(freelancer).claimPayment(agrId, 0)).to.emit(escrow, "WorkApproved").withArgs(agrId, 0);
    });

    it("Submitted work awaiting review is never automatically refunded through hard-end refund path", async function () {
      await escrow.connect(freelancer).submitWork(agrId, 0, ethers.utils.hexZeroPad("0x1", 32));
      await ethers.provider.send("evm_setNextBlockTimestamp", [hardEnd]);
      await ethers.provider.send("evm_mine", []);
      await expect(escrow.connect(buyer).refundHardEnd(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
      // But freelancer can claim it
      await expect(escrow.connect(freelancer).claimPayment(agrId, 0)).to.emit(escrow, "WorkApproved");
    });

    it("Invalid state transitions revert without changing balances (Terminal state double payout safety)", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [hardEnd]);
      await ethers.provider.send("evm_mine", []);
      await escrow.connect(buyer).refundHardEnd(agrId, 0); // Terminal state

      const escrowBal = await token.balanceOf(escrow.address);
      await expect(escrow.connect(buyer).refundHardEnd(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
      expect(await token.balanceOf(escrow.address)).to.equal(escrowBal);
    });
  });

  describe("T6 & T7 - Dispute lifecycle, Mutual settlement, Fallback", function () {
    let agrId;
    beforeEach(async function () {
      const ms = [{ amount: 511n, deliveryDeadline: hardEnd - 100, reviewDuration: 100 }]; // odd credit
      const hash = getAgreementHash(ms, hardEnd, resolver.address);
      await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, ms);
      agrId = 1;
      await token.connect(buyer).approve(escrow.address, 1000n);
      await escrow.connect(buyer).fundMilestone(agrId, 0);
    });

    it("Only buyer or freelancer can open dispute before deadline", async function () {
      await expect(escrow.connect(outsider).openDispute(agrId, 0)).to.be.revertedWithCustomError(escrow, "Unauthorized");
      await expect(escrow.connect(buyer).openDispute(agrId, 0)).to.emit(escrow, "DisputeOpened");
    });

    it("Dispute freezes ordinary settlement", async function () {
      await escrow.connect(buyer).openDispute(agrId, 0);
      await ethers.provider.send("evm_setNextBlockTimestamp", [hardEnd]);
      await ethers.provider.send("evm_mine", []);
      await expect(escrow.connect(buyer).refundHardEnd(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("Resolver payout calculates floor percentage", async function () {
      await escrow.connect(buyer).openDispute(agrId, 0);
      // 511 * 30% = 153.3 -> 153. Buyer gets 358.
      const fBal = await token.balanceOf(freelancer.address);
      const bBal = await token.balanceOf(buyer.address);
      await escrow.connect(resolver).resolveDispute(agrId, 0, 30);
      expect((await token.balanceOf(freelancer.address)).sub(fBal)).to.equal(153n);
      expect((await token.balanceOf(buyer.address)).sub(bBal)).to.equal(358n);
    });

    it("Odd-credit 50/50 fallback gives freelancer the extra credit after 72h", async function () {
      await escrow.connect(buyer).openDispute(agrId, 0);
      await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);
      
      const fBal = await token.balanceOf(freelancer.address);
      const bBal = await token.balanceOf(buyer.address);
      await escrow.connect(outsider).executeFallback(agrId, 0);
      
      expect((await token.balanceOf(freelancer.address)).sub(fBal)).to.equal(256n); // 511/2 = 255.5 -> 256
      expect((await token.balanceOf(buyer.address)).sub(bBal)).to.equal(255n);
    });

    it("Mutual settlement requires exact matching valid signatures", async function () {
      await escrow.connect(buyer).openDispute(agrId, 0);
      
      const domain = {
        name: "FairworkEscrow",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: escrow.address
      };

      const types = {
        MutualSettlement: [
          { name: "agreementId", type: "uint256" },
          { name: "milestoneId", type: "uint8" },
          { name: "freelancerAmount", type: "uint256" },
          { name: "buyerAmount", type: "uint256" }
        ]
      };

      const value = {
        agreementId: agrId,
        milestoneId: 0,
        freelancerAmount: 100,
        buyerAmount: 411
      };

      const fSig = await freelancer._signTypedData(domain, types, value);
      const bSig = await buyer._signTypedData(domain, types, value);
      
      const fBal = await token.balanceOf(freelancer.address);
      await escrow.connect(outsider).executeMutualSettlement(agrId, 0, 100n, 411n, fSig, bSig);
      expect((await token.balanceOf(freelancer.address)).sub(fBal)).to.equal(100n);
    });

    it("Only one terminal outcome succeeds (races)", async function () {
      await escrow.connect(buyer).openDispute(agrId, 0);
      await escrow.connect(resolver).resolveDispute(agrId, 0, 100);
      
      await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(escrow.connect(outsider).executeFallback(agrId, 0)).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("T9 - Hash integrity, events, and recovery", function () {
    let agrId;
    it("Changing a committed term changes the hash", async function () {
      const ms1 = [{ amount: 500n, deliveryDeadline: 12345, reviewDuration: 100 }];
      const hash1 = getAgreementHash(ms1, hardEnd, resolver.address);
      
      const ms2 = [{ amount: 500n, deliveryDeadline: 12345, reviewDuration: 101 }];
      const hash2 = getAgreementHash(ms2, hardEnd, resolver.address);
      
      expect(hash1).not.to.equal(hash2);
    });

    it("Events contain identifiers needed to reconstruct state", async function () {
      const ms = [{ amount: 500n, deliveryDeadline: hardEnd - 100, reviewDuration: 100 }];
      const hash = getAgreementHash(ms, hardEnd, resolver.address);
      const tx = await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, ms);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === 'AgreementCreated');
      expect(event.args.agreementId).to.equal(1n);
      expect(event.args.buyer).to.equal(buyer.address);
      expect(event.args.freelancer).to.equal(freelancer.address);
      expect(event.args.agreementHash).to.equal(hash);
    });
  });
});
