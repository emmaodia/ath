/**
 *Submitted for verification at sepolia.lineascan.build/ on 2024-08-31
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract ATH {
    address public owner;
    uint256 public houseBalance;

    event GamePlayed(address indexed player, uint256 amount, uint256 prediction, uint256 houseNumber);
    event GameWon(address indexed player, uint256 amountWon);
    event GameLost(address indexed player, uint256 amountLost);
    event HouseDeposit(address indexed owner, uint256 amount);
    event HouseWithdrawal(address indexed owner, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    modifier sufficientFunds(uint256 amount) {
        require(msg.value >= amount, "Insufficient funds to play");
        _;
    }

    function depositToHouse() public payable onlyOwner {
        houseBalance += msg.value;
        emit HouseDeposit(msg.sender, msg.value);  // Emit the deposit event
    }

    function withdrawHouseFunds(uint256 amount) public onlyOwner {
        require(amount <= houseBalance, "Not enough funds in the house");
        houseBalance -= amount;
        payable(owner).transfer(amount);
        emit HouseWithdrawal(msg.sender, amount);  // Emit the withdrawal event
    }

    function generateRandomNumber() private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 10;
    }

    function play(uint256 userPrediction) public payable sufficientFunds(0.0001 ether) {
        require(houseBalance >= msg.value * 10 / 100, "House doesn't have enough balance to cover potential winnings");
        require(msg.value >= 0.0001 ether, "Must bet at least 0.0001 Ether");
        require(userPrediction >= 0 && userPrediction <= 9, "Prediction must be between 0 and 9");

        uint256 houseNumber = generateRandomNumber();
        emit GamePlayed(msg.sender, msg.value, userPrediction, houseNumber);  // Emit the game played event

        if (userPrediction == houseNumber) {
            uint256 winnings = msg.value + msg.value * 10 / 100;
            houseBalance -= winnings - msg.value;
            payable(msg.sender).transfer(winnings);
            emit GameWon(msg.sender, winnings);  // Emit the game won event
        } else {
            uint256 loss = msg.value * 15 / 100;
            houseBalance += loss;
            payable(owner).transfer(msg.value - loss);
            emit GameLost(msg.sender, loss);  // Emit the game lost event
        }
    }

    receive() external payable {
        houseBalance += msg.value;
        emit HouseDeposit(msg.sender, msg.value);  // Emit the deposit event when funds are received
    }
}