// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AutoTriggers {
    struct Trigger {
        address target;
        bytes payload;
        uint256 nextExec;
        uint256 interval;
        bool active;
    }

    mapping(uint256 => Trigger) public triggers;
    uint256 public triggerCount;

    event TriggerRegistered(uint256 id, address target);
    event TriggerExecuted(uint256 id);

    function registerTrigger(address _target, bytes calldata _payload, uint256 _interval) external returns (uint256) {
        triggerCount++;
        triggers[triggerCount] = Trigger({
            target: _target,
            payload: _payload,
            nextExec: block.timestamp + _interval,
            interval: _interval,
            active: true
        });
        emit TriggerRegistered(triggerCount, _target);
        return triggerCount;
    }

    function checkUpkeep(uint256 _id) external view returns (bool, bytes memory) {
        Trigger memory t = triggers[_id];
        bool upkeepNeeded = t.active && (block.timestamp >= t.nextExec);
        return (upkeepNeeded, t.payload);
    }

    function performUpkeep(uint256 _id) external {
        Trigger storage t = triggers[_id];
        require(t.active, "Not active");
        require(block.timestamp >= t.nextExec, "Too early");

        t.nextExec = block.timestamp + t.interval;
        
        (bool success, ) = t.target.call(t.payload);
        require(success, "Execution failed");
        
        emit TriggerExecuted(_id);
    }
}
