// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OnchainRiddle {
    address public bot;
    string public riddle;
    bytes32 private answerHash;
    address public winner;
    bool public isActive;

    event RiddleSet(string riddle);
    event AnswerAttempt(address indexed user, bool correct);
    event Winner(address indexed user);

    modifier onlyBot() {
        require(msg.sender == bot, "Only bot");
        _;
    }

    constructor() {
        bot = msg.sender;
    }

    function setRiddle(string memory _riddle, bytes32 _answerHash) external onlyBot {
        require(!isActive, "Already active");
        riddle = _riddle;
        answerHash = _answerHash;
        isActive = true;
        winner = address(0);
        emit RiddleSet(_riddle);
    }

    function submitAnswer(string memory _answer) external {
        require(isActive, "No active riddle");
        require(winner == address(0), "Already solved");
        
        bool correct = keccak256(abi.encodePacked(_answer)) == answerHash;
        
        if (correct) {
            winner = msg.sender;
            isActive = false;
            emit Winner(msg.sender);
        }
        
        emit AnswerAttempt(msg.sender, correct);
    }
}
