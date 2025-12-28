// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ObscuraToken.sol";

/**
 * @title ObscuraGovernance
 * @notice Decentralized governance for the Obscura protocol
 * @dev Allows token holders to create and vote on proposals
 */
contract ObscuraGovernance is Ownable, ReentrancyGuard {
    // Proposal status
    enum ProposalStatus {
        Pending,
        Active,
        Passed,
        Failed,
        Executed,
        Cancelled
    }

    // Proposal types
    enum ProposalType {
        ParameterChange, // Change protocol parameters
        Treasury, // Treasury fund allocation
        NodeSlashing, // Slash a malicious node
        Upgrade, // Protocol upgrade
        Emergency // Emergency action
    }

    // Proposal structure
    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        string title;
        string description;
        bytes callData; // Encoded function call
        address targetContract;
        uint256 votingStart;
        uint256 votingEnd;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quorumRequired;
        ProposalStatus status;
        bool executed;
    }

    // Vote record
    struct Vote {
        bool hasVoted;
        uint8 support; // 0 = against, 1 = for, 2 = abstain
        uint256 weight;
    }

    // State
    ObscuraToken public token;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public votes;
    uint256 public proposalCount;

    // Configuration
    uint256 public votingDelay; // Time before voting starts
    uint256 public votingPeriod; // Duration of voting
    uint256 public proposalThreshold; // Min tokens to create proposal
    uint256 public quorumPercentage; // Percentage of total supply needed

    // Timelock
    uint256 public timelockDelay;
    mapping(bytes32 => uint256) public timelockQueue;

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string title,
        uint256 votingStart,
        uint256 votingEnd
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event TimelockQueued(bytes32 indexed id, uint256 executeTime);
    event ParameterUpdated(string param, uint256 oldValue, uint256 newValue);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        token = ObscuraToken(_token);

        // Default configuration
        votingDelay = 1 days;
        votingPeriod = 7 days;
        proposalThreshold = 10000 * 10 ** 18; // 10,000 tokens
        quorumPercentage = 4; // 4% of total supply
        timelockDelay = 2 days;
    }

    // ============ PROPOSAL CREATION ============

    /**
     * @notice Create a new proposal
     */
    function createProposal(
        ProposalType proposalType,
        string calldata title,
        string calldata description,
        address targetContract,
        bytes calldata callData
    ) external returns (uint256) {
        require(
            getVotingPower(msg.sender) >= proposalThreshold,
            "Below proposal threshold"
        );

        proposalCount++;
        uint256 proposalId = proposalCount;

        uint256 quorumRequired = (token.totalSupply() * quorumPercentage) / 100;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: proposalType,
            title: title,
            description: description,
            callData: callData,
            targetContract: targetContract,
            votingStart: block.timestamp + votingDelay,
            votingEnd: block.timestamp + votingDelay + votingPeriod,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            quorumRequired: quorumRequired,
            status: ProposalStatus.Pending,
            executed: false
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            proposalType,
            title,
            block.timestamp + votingDelay,
            block.timestamp + votingDelay + votingPeriod
        );

        return proposalId;
    }

    /**
     * @notice Create an emergency proposal (shorter timeline)
     */
    function createEmergencyProposal(
        string calldata title,
        string calldata description,
        address targetContract,
        bytes calldata callData
    ) external onlyOwner returns (uint256) {
        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: ProposalType.Emergency,
            title: title,
            description: description,
            callData: callData,
            targetContract: targetContract,
            votingStart: block.timestamp,
            votingEnd: block.timestamp + 1 days, // 1 day vote
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            quorumRequired: (token.totalSupply() * 10) / 100, // 10% quorum for emergency
            status: ProposalStatus.Active,
            executed: false
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            ProposalType.Emergency,
            title,
            block.timestamp,
            block.timestamp + 1 days
        );

        return proposalId;
    }

    // ============ VOTING ============

    /**
     * @notice Cast a vote on a proposal
     * @param support 0 = against, 1 = for, 2 = abstain
     */
    function castVote(uint256 proposalId, uint8 support) external {
        Proposal storage proposal = proposals[proposalId];
        Vote storage vote = votes[proposalId][msg.sender];

        require(proposal.id != 0, "Proposal doesn't exist");
        require(!vote.hasVoted, "Already voted");
        require(support <= 2, "Invalid vote type");
        require(block.timestamp >= proposal.votingStart, "Voting not started");
        require(block.timestamp <= proposal.votingEnd, "Voting ended");

        // Update status if needed
        if (proposal.status == ProposalStatus.Pending) {
            proposal.status = ProposalStatus.Active;
        }

        uint256 weight = getVotingPower(msg.sender);
        require(weight > 0, "No voting power");

        vote.hasVoted = true;
        vote.support = support;
        vote.weight = weight;

        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Get voting power for an address (staked + balance)
     */
    function getVotingPower(address account) public view returns (uint256) {
        // Voting power = token balance + staked amount
        (uint256 stakedAmount, , , ) = token.getStakeInfo(account);
        return token.balanceOf(account) + stakedAmount;
    }

    // ============ PROPOSAL EXECUTION ============

    /**
     * @notice Finalize voting and update status
     */
    function finalizeVoting(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            proposal.status == ProposalStatus.Active ||
                proposal.status == ProposalStatus.Pending,
            "Cannot finalize"
        );
        require(block.timestamp > proposal.votingEnd, "Voting not ended");

        uint256 totalVotes = proposal.forVotes +
            proposal.againstVotes +
            proposal.abstainVotes;

        if (
            totalVotes >= proposal.quorumRequired &&
            proposal.forVotes > proposal.againstVotes
        ) {
            proposal.status = ProposalStatus.Passed;

            // Queue for timelock
            bytes32 timelockId = keccak256(abi.encode(proposalId));
            timelockQueue[timelockId] = block.timestamp + timelockDelay;
            emit TimelockQueued(timelockId, block.timestamp + timelockDelay);
        } else {
            proposal.status = ProposalStatus.Failed;
        }
    }

    /**
     * @notice Execute a passed proposal after timelock
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(
            proposal.status == ProposalStatus.Passed,
            "Proposal not passed"
        );
        require(!proposal.executed, "Already executed");

        bytes32 timelockId = keccak256(abi.encode(proposalId));
        require(timelockQueue[timelockId] != 0, "Not queued");
        require(
            block.timestamp >= timelockQueue[timelockId],
            "Timelock not expired"
        );

        proposal.executed = true;
        proposal.status = ProposalStatus.Executed;

        // Execute the call
        if (
            proposal.targetContract != address(0) &&
            proposal.callData.length > 0
        ) {
            (bool success, ) = proposal.targetContract.call(proposal.callData);
            require(success, "Execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal (only proposer or owner)
     */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || msg.sender == owner(),
            "Not authorized"
        );
        require(
            proposal.status == ProposalStatus.Pending ||
                proposal.status == ProposalStatus.Active,
            "Cannot cancel"
        );

        proposal.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // ============ VIEW FUNCTIONS ============

    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (
            address proposer,
            ProposalType proposalType,
            string memory title,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            ProposalStatus status
        )
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.proposer,
            p.proposalType,
            p.title,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.status
        );
    }

    function getVote(
        uint256 proposalId,
        address voter
    ) external view returns (bool hasVoted, uint8 support, uint256 weight) {
        Vote storage v = votes[proposalId][voter];
        return (v.hasVoted, v.support, v.weight);
    }

    function proposalState(
        uint256 proposalId
    ) external view returns (ProposalStatus) {
        return proposals[proposalId].status;
    }

    // ============ ADMIN FUNCTIONS ============

    function setVotingDelay(uint256 newDelay) external onlyOwner {
        uint256 old = votingDelay;
        votingDelay = newDelay;
        emit ParameterUpdated("votingDelay", old, newDelay);
    }

    function setVotingPeriod(uint256 newPeriod) external onlyOwner {
        uint256 old = votingPeriod;
        votingPeriod = newPeriod;
        emit ParameterUpdated("votingPeriod", old, newPeriod);
    }

    function setProposalThreshold(uint256 newThreshold) external onlyOwner {
        uint256 old = proposalThreshold;
        proposalThreshold = newThreshold;
        emit ParameterUpdated("proposalThreshold", old, newThreshold);
    }

    function setQuorumPercentage(uint256 newQuorum) external onlyOwner {
        uint256 old = quorumPercentage;
        quorumPercentage = newQuorum;
        emit ParameterUpdated("quorumPercentage", old, newQuorum);
    }

    function setTimelockDelay(uint256 newDelay) external onlyOwner {
        uint256 old = timelockDelay;
        timelockDelay = newDelay;
        emit ParameterUpdated("timelockDelay", old, newDelay);
    }
}
