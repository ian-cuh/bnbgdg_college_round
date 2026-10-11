// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract FairworkEscrow is EIP712 {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    enum MilestoneState {
        UNFUNDED,
        FUNDED,
        SUBMITTED,
        REVISION_REQUESTED,
        DISPUTED,
        RESOLVED_TERMINAL
    }

    struct Milestone {
        uint256 amount;
        MilestoneState state;
        uint32 deliveryDeadline;
        uint32 reviewDuration;
        uint32 reviewDeadline;
        uint32 disputeOpenedAt;
    }

    struct Agreement {
        address buyer;
        address freelancer;
        address resolver;
        uint32 hardEnd;
        uint8 milestoneCount;
        bytes32 agreementHash;
    }

    mapping(uint256 => Agreement) public agreements;
    mapping(uint256 => mapping(uint8 => Milestone)) public milestones;
    uint256 public nextAgreementId = 1;

    // Events
    event AgreementCreated(uint256 indexed agreementId, address indexed buyer, address indexed freelancer, bytes32 agreementHash);
    event MilestoneFunded(uint256 indexed agreementId, uint8 milestoneId, uint256 amount);
    event WorkSubmitted(uint256 indexed agreementId, uint8 milestoneId, bytes32 evidenceHash);
    event WorkApproved(uint256 indexed agreementId, uint8 milestoneId);
    event RevisionRequested(uint256 indexed agreementId, uint8 milestoneId);
    event DisputeOpened(uint256 indexed agreementId, uint8 milestoneId, address indexed by);
    event DisputeResolved(uint256 indexed agreementId, uint8 milestoneId, uint256 freelancerAmount, uint256 buyerAmount);
    event FallbackExecuted(uint256 indexed agreementId, uint8 milestoneId, uint256 freelancerAmount, uint256 buyerAmount);
    event RefundReclaimed(uint256 indexed agreementId, uint8 milestoneId, string reason);
    event MutualSettlement(uint256 indexed agreementId, uint8 milestoneId, uint256 freelancerAmount, uint256 buyerAmount);

    error Unauthorized();
    error InvalidState();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error InvalidAmount();
    error DisputeGracePeriodNotPassed();

    constructor(address _token) EIP712("FairworkEscrow", "1") {
        token = IERC20(_token);
    }

    struct MilestoneParams {
        uint256 amount;
        uint32 deliveryDeadline;
        uint32 reviewDuration;
    }

    function createAgreement(
        bytes32 agreementHash,
        address freelancer,
        address resolver,
        uint32 hardEnd,
        MilestoneParams[] calldata msParams
    ) external returns (uint256) {
        require(msParams.length > 0 && msParams.length <= 5, "1-5 milestones required");
        uint256 agreementId = nextAgreementId++;

        agreements[agreementId] = Agreement({
            buyer: msg.sender,
            freelancer: freelancer,
            resolver: resolver,
            hardEnd: hardEnd,
            milestoneCount: uint8(msParams.length),
            agreementHash: agreementHash
        });

        for (uint8 i = 0; i < msParams.length; i++) {
            require(msParams[i].amount > 0, "Amount must be > 0");
            require(msParams[i].deliveryDeadline <= hardEnd, "Delivery > hardEnd");
            
            milestones[agreementId][i] = Milestone({
                amount: msParams[i].amount,
                state: MilestoneState.UNFUNDED,
                deliveryDeadline: msParams[i].deliveryDeadline,
                reviewDuration: msParams[i].reviewDuration,
                reviewDeadline: 0,
                disputeOpenedAt: 0
            });
        }

        emit AgreementCreated(agreementId, msg.sender, freelancer, agreementHash);
        return agreementId;
    }

    function fundMilestone(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        if (msg.sender != agr.buyer) revert Unauthorized();
        Milestone storage ms = milestones[agreementId][milestoneId];
        if (ms.state != MilestoneState.UNFUNDED) revert InvalidState();
        if (block.timestamp >= ms.deliveryDeadline) revert DeadlinePassed();

        ms.state = MilestoneState.FUNDED;
        
        token.safeTransferFrom(msg.sender, address(this), ms.amount);
        emit MilestoneFunded(agreementId, milestoneId, ms.amount);
    }

    function submitWork(uint256 agreementId, uint8 milestoneId, bytes32 evidenceHash) external {
        Agreement memory agr = agreements[agreementId];
        if (msg.sender != agr.freelancer) revert Unauthorized();
        if (block.timestamp >= agr.hardEnd) revert DeadlinePassed();

        Milestone storage ms = milestones[agreementId][milestoneId];
        if (ms.state != MilestoneState.FUNDED && ms.state != MilestoneState.REVISION_REQUESTED) revert InvalidState();
        
        if (ms.state == MilestoneState.FUNDED && block.timestamp >= ms.deliveryDeadline) revert DeadlinePassed();

        ms.state = MilestoneState.SUBMITTED;
        uint64 calculatedDeadline = uint64(block.timestamp) + ms.reviewDuration;
        ms.reviewDeadline = uint32(calculatedDeadline > agr.hardEnd ? agr.hardEnd : calculatedDeadline);

        emit WorkSubmitted(agreementId, milestoneId, evidenceHash);
    }

    function requestRevision(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        if (msg.sender != agr.buyer) revert Unauthorized();
        if (block.timestamp >= agr.hardEnd) revert DeadlinePassed();

        Milestone storage ms = milestones[agreementId][milestoneId];
        if (ms.state != MilestoneState.SUBMITTED) revert InvalidState();
        if (block.timestamp >= ms.reviewDeadline) revert DeadlinePassed();

        ms.state = MilestoneState.REVISION_REQUESTED;
        emit RevisionRequested(agreementId, milestoneId);
    }

    function approveWork(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        if (msg.sender != agr.buyer) revert Unauthorized();

        Milestone storage ms = milestones[agreementId][milestoneId];
        if (ms.state != MilestoneState.SUBMITTED) revert InvalidState();

        ms.state = MilestoneState.RESOLVED_TERMINAL;
        token.safeTransfer(agr.freelancer, ms.amount);
        emit WorkApproved(agreementId, milestoneId);
    }

    function claimPayment(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        Milestone storage ms = milestones[agreementId][milestoneId];
        
        if (ms.state != MilestoneState.SUBMITTED) revert InvalidState();
        if (block.timestamp < ms.reviewDeadline) revert DeadlineNotPassed();

        ms.state = MilestoneState.RESOLVED_TERMINAL;
        token.safeTransfer(agr.freelancer, ms.amount);
        emit WorkApproved(agreementId, milestoneId);
    }

    function reclaimUnsubmitted(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        Milestone storage ms = milestones[agreementId][milestoneId];
        
        if (ms.state != MilestoneState.FUNDED) revert InvalidState();
        if (block.timestamp < ms.deliveryDeadline) revert DeadlineNotPassed();

        ms.state = MilestoneState.RESOLVED_TERMINAL;
        token.safeTransfer(agr.buyer, ms.amount);
        emit RefundReclaimed(agreementId, milestoneId, "Delivery Timeout");
    }

    function refundHardEnd(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        Milestone storage ms = milestones[agreementId][milestoneId];
        
        if (block.timestamp < agr.hardEnd) revert DeadlineNotPassed();
        if (ms.state != MilestoneState.FUNDED && ms.state != MilestoneState.REVISION_REQUESTED) revert InvalidState();

        ms.state = MilestoneState.RESOLVED_TERMINAL;
        token.safeTransfer(agr.buyer, ms.amount);
        emit RefundReclaimed(agreementId, milestoneId, "Hard End");
    }

    function openDispute(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        if (msg.sender != agr.buyer && msg.sender != agr.freelancer) revert Unauthorized();
        
        Milestone storage ms = milestones[agreementId][milestoneId];
        if (ms.state != MilestoneState.FUNDED && ms.state != MilestoneState.SUBMITTED && ms.state != MilestoneState.REVISION_REQUESTED) revert InvalidState();
        
        if (ms.state == MilestoneState.FUNDED && block.timestamp >= ms.deliveryDeadline) revert DeadlinePassed();
        if (ms.state == MilestoneState.SUBMITTED && block.timestamp >= ms.reviewDeadline) revert DeadlinePassed();
        if (ms.state == MilestoneState.REVISION_REQUESTED && block.timestamp >= agr.hardEnd) revert DeadlinePassed();

        ms.state = MilestoneState.DISPUTED;
        ms.disputeOpenedAt = uint32(block.timestamp);
        
        emit DisputeOpened(agreementId, milestoneId, msg.sender);
    }

    function resolveDispute(uint256 agreementId, uint8 milestoneId, uint8 freelancerPercentage) external {
        require(freelancerPercentage <= 100, "Percentage > 100");
        Agreement memory agr = agreements[agreementId];
        if (msg.sender != agr.resolver) revert Unauthorized();

        Milestone storage ms = milestones[agreementId][milestoneId];
        if (ms.state != MilestoneState.DISPUTED) revert InvalidState();

        ms.state = MilestoneState.RESOLVED_TERMINAL;
        
        uint256 freelancerAmount = (ms.amount * freelancerPercentage) / 100;
        uint256 buyerAmount = ms.amount - freelancerAmount;

        if (freelancerAmount > 0) token.safeTransfer(agr.freelancer, freelancerAmount);
        if (buyerAmount > 0) token.safeTransfer(agr.buyer, buyerAmount);

        emit DisputeResolved(agreementId, milestoneId, freelancerAmount, buyerAmount);
    }

    function executeFallback(uint256 agreementId, uint8 milestoneId) external {
        Agreement memory agr = agreements[agreementId];
        Milestone storage ms = milestones[agreementId][milestoneId];
        
        if (ms.state != MilestoneState.DISPUTED) revert InvalidState();
        if (block.timestamp < ms.disputeOpenedAt + 72 hours) revert DisputeGracePeriodNotPassed();

        ms.state = MilestoneState.RESOLVED_TERMINAL;

        uint256 half = ms.amount / 2;
        uint256 freelancerAmount = half + (ms.amount % 2); // odd credit rule
        uint256 buyerAmount = half;

        if (freelancerAmount > 0) token.safeTransfer(agr.freelancer, freelancerAmount);
        if (buyerAmount > 0) token.safeTransfer(agr.buyer, buyerAmount);

        emit FallbackExecuted(agreementId, milestoneId, freelancerAmount, buyerAmount);
    }

    function executeMutualSettlement(
        uint256 agreementId, 
        uint8 milestoneId, 
        uint256 freelancerAmount, 
        uint256 buyerAmount, 
        bytes calldata freelancerSignature, 
        bytes calldata buyerSignature
    ) external {
        Agreement memory agr = agreements[agreementId];
        Milestone storage ms = milestones[agreementId][milestoneId];
        
        if (ms.state != MilestoneState.DISPUTED) revert InvalidState();
        require(freelancerAmount + buyerAmount == ms.amount, "Amounts must sum to escrow");

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("MutualSettlement(uint256 agreementId,uint8 milestoneId,uint256 freelancerAmount,uint256 buyerAmount)"),
                agreementId,
                milestoneId,
                freelancerAmount,
                buyerAmount
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        require(ECDSA.recover(hash, freelancerSignature) == agr.freelancer, "Invalid freelancer sig");
        require(ECDSA.recover(hash, buyerSignature) == agr.buyer, "Invalid buyer sig");

        ms.state = MilestoneState.RESOLVED_TERMINAL;

        if (freelancerAmount > 0) token.safeTransfer(agr.freelancer, freelancerAmount);
        if (buyerAmount > 0) token.safeTransfer(agr.buyer, buyerAmount);

        emit MutualSettlement(agreementId, milestoneId, freelancerAmount, buyerAmount);
    }
}
