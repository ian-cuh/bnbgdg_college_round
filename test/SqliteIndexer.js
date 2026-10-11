const { expect } = require("chai");
const { ethers } = require("hardhat");
const Database = require("better-sqlite3");

function initDB(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cursors (
      chain_id INTEGER,
      contract_address TEXT,
      last_block INTEGER,
      PRIMARY KEY (chain_id, contract_address)
    );

    CREATE TABLE IF NOT EXISTS events (
      chain_id INTEGER,
      contract_address TEXT,
      tx_hash TEXT,
      log_index INTEGER,
      block_number INTEGER,
      event_name TEXT,
      data TEXT,
      PRIMARY KEY (chain_id, contract_address, tx_hash, log_index)
    );

    CREATE TABLE IF NOT EXISTS agreements (
      id INTEGER PRIMARY KEY,
      buyer TEXT,
      freelancer TEXT,
      agreement_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS milestones (
      agreement_id INTEGER,
      milestone_id INTEGER,
      amount TEXT,
      state INTEGER,
      evidence_hash TEXT,
      PRIMARY KEY (agreement_id, milestone_id)
    );
  `);
}

async function syncLogs(db, provider, escrowContract) {
  const chainId = (await provider.getNetwork()).chainId;
  const address = escrowContract.address;

  // Get cursor
  const stmtCursor = db.prepare("SELECT last_block FROM cursors WHERE chain_id = ? AND contract_address = ?");
  const rowCursor = stmtCursor.get(chainId, address);
  let fromBlock = rowCursor ? rowCursor.last_block + 1 : 0;
  let toBlock = await provider.getBlockNumber();

  if (fromBlock > toBlock) return 0; // Nothing to sync

  const logs = await provider.getLogs({
    address,
    fromBlock,
    toBlock
  });

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (chain_id, contract_address, tx_hash, log_index, block_number, event_name, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAgreement = db.prepare(`INSERT OR IGNORE INTO agreements (id, buyer, freelancer, agreement_hash) VALUES (?, ?, ?, ?)`);
  const insertMilestone = db.prepare(`INSERT OR IGNORE INTO milestones (agreement_id, milestone_id, amount, state) VALUES (?, ?, ?, ?)`);
  const updateMilestoneState = db.prepare(`UPDATE milestones SET state = ? WHERE agreement_id = ? AND milestone_id = ?`);
  const updateMilestoneEvidence = db.prepare(`UPDATE milestones SET evidence_hash = ? WHERE agreement_id = ? AND milestone_id = ?`);

  let newEvents = 0;

  for (const rawLog of logs) {
    let log;
    try { log = escrowContract.interface.parseLog(rawLog); } catch (e) { continue; }
    if (!log) continue;

    const res = insertEvent.run(
      chainId, address, rawLog.transactionHash, rawLog.logIndex, rawLog.blockNumber, log.name, JSON.stringify(log.args)
    );

    if (res.changes === 0) continue; // Was a duplicate
    newEvents++;

    // Reconstruct Read Model
    if (log.name === "AgreementCreated") {
      insertAgreement.run(log.args.agreementId.toNumber(), log.args.buyer, log.args.freelancer, log.args.agreementHash);
    } else if (log.name === "MilestoneFunded") {
      insertMilestone.run(log.args.agreementId.toNumber(), log.args.milestoneId, log.args.amount.toString(), 1); // FUNDED
    } else if (log.name === "WorkSubmitted") {
      updateMilestoneState.run(2, log.args.agreementId.toNumber(), log.args.milestoneId); // SUBMITTED
      updateMilestoneEvidence.run(log.args.evidenceHash, log.args.agreementId.toNumber(), log.args.milestoneId);
    } else if (log.name === "WorkApproved" || log.name === "DisputeResolved" || log.name === "RefundReclaimed" || log.name === "FallbackExecuted" || log.name === "MutualSettlement") {
      updateMilestoneState.run(5, log.args.agreementId.toNumber(), log.args.milestoneId); // RESOLVED_TERMINAL
    } else if (log.name === "RevisionRequested") {
      updateMilestoneState.run(3, log.args.agreementId.toNumber(), log.args.milestoneId); // REVISION_REQUESTED
    } else if (log.name === "DisputeOpened") {
      updateMilestoneState.run(4, log.args.agreementId.toNumber(), log.args.milestoneId); // DISPUTED
    }
  }

  // Update Cursor
  db.prepare(`
    INSERT INTO cursors (chain_id, contract_address, last_block) 
    VALUES (?, ?, ?) 
    ON CONFLICT(chain_id, contract_address) DO UPDATE SET last_block = ?
  `).run(chainId, address, toBlock, toBlock);

  return newEvents;
}

async function reconcile(db, escrowContract) {
  // Compares all milestones in DB with the authoritative contract state
  const milestones = db.prepare("SELECT * FROM milestones").all();
  const discrepancies = [];

  for (const m of milestones) {
    const onChain = await escrowContract.milestones(m.agreement_id, m.milestone_id);
    if (onChain.state !== m.state) {
      discrepancies.push({
        type: 'STATE_MISMATCH',
        agreement_id: m.agreement_id,
        milestone_id: m.milestone_id,
        db_state: m.state,
        chain_state: onChain.state
      });
    }
  }
  return discrepancies;
}

describe("Phase 10: SQLite Read Model and Event Recovery", function () {
  let db;
  let token, escrow;
  let deployer, buyer, freelancer, resolver;
  let hardEnd;

  before(async function () {
    [deployer, buyer, freelancer, resolver] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("FairworkToken");
    token = await Token.deploy([buyer.address], [6000]);
    const Escrow = await ethers.getContractFactory("FairworkEscrow");
    escrow = await Escrow.deploy(token.address);
    const latestBlock = await ethers.provider.getBlock("latest");
    hardEnd = latestBlock.timestamp + 30 * 24 * 3600;

    await token.connect(buyer).approve(escrow.address, 6000n);
  });

  beforeEach(function () {
    if (db) db.close();
    db = new Database(':memory:');
    initDB(db);
  });

  it("1. Normal event ingestion", async function () {
    const hash = ethers.utils.hexZeroPad("0x1", 32);
    await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, [{ amount: 1000n, deliveryDeadline: hardEnd, reviewDuration: 100 }]);
    await escrow.connect(buyer).fundMilestone(1, 0);

    const newEvents = await syncLogs(db, ethers.provider, escrow);
    expect(newEvents).to.equal(2); // AgreementCreated, MilestoneFunded

    const m = db.prepare("SELECT * FROM milestones WHERE agreement_id = 1").get();
    expect(m.state).to.equal(1); // FUNDED
  });

  it("2. Repeated ingestion without duplication", async function () {
    // Generate some events
    const hash = ethers.utils.hexZeroPad("0x2", 32);
    await escrow.connect(buyer).createAgreement(hash, freelancer.address, resolver.address, hardEnd, [{ amount: 1000n, deliveryDeadline: hardEnd, reviewDuration: 100 }]);
    
    // Reset cursor to 0 to simulate re-reading
    await syncLogs(db, ethers.provider, escrow);
    db.prepare("UPDATE cursors SET last_block = 0").run();
    
    // Sync again over same blocks
    const newEvents = await syncLogs(db, ethers.provider, escrow);
    expect(newEvents).to.equal(0); // Idempotency: INSERT OR IGNORE blocks duplicates
  });

  it("3. Recovery after the indexer stops", async function () {
    // First sync
    await syncLogs(db, ethers.provider, escrow);
    
    // Indexer "stops". Generate new events.
    await escrow.connect(buyer).fundMilestone(2, 0);
    
    // Indexer wakes up and syncs again
    const newEvents = await syncLogs(db, ethers.provider, escrow);
    expect(newEvents).to.equal(1); // MilestoneFunded

    const m = db.prepare("SELECT * FROM milestones WHERE agreement_id = 2").get();
    expect(m.state).to.equal(1);
  });

  it("4. Rebuilding the read model from contract events & 6. Continued correctness when recreated", async function () {
    // Generate complex state
    await escrow.connect(freelancer).submitWork(2, 0, ethers.utils.hexZeroPad("0xABC", 32));
    
    // Destroy DB and recreate
    db.close();
    db = new Database(':memory:');
    initDB(db);

    // Sync from block 0
    const newEvents = await syncLogs(db, ethers.provider, escrow);
    expect(newEvents).to.be.greaterThan(0);

    // Verify completely rebuilt state matches chain
    const m = db.prepare("SELECT * FROM milestones WHERE agreement_id = 2").get();
    expect(m.state).to.equal(2); // SUBMITTED
    expect(m.evidence_hash).to.equal(ethers.utils.hexZeroPad("0xABC", 32).toLowerCase());
  });

  it("5. Detection of a stale or inconsistent cache", async function () {
    await syncLogs(db, ethers.provider, escrow);

    // Maliciously tamper with SQLite cache
    db.prepare("UPDATE milestones SET state = 99 WHERE agreement_id = 2").run();

    const discrepancies = await reconcile(db, escrow);
    
    expect(discrepancies.length).to.equal(1);
    expect(discrepancies[0].type).to.equal('STATE_MISMATCH');
    expect(discrepancies[0].db_state).to.equal(99);
    expect(discrepancies[0].chain_state).to.equal(2); // Actual chain state is 2 (SUBMITTED)
  });
});
