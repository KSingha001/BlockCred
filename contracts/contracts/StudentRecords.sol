// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StudentRecords
 * @dev Smart contract for storing and verifying student records on-chain
 */
contract StudentRecords is AccessControl, Ownable {
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant EMPLOYER_ROLE = keccak256("EMPLOYER_ROLE");

    struct StudentRecord {
        string usn;
        string name;
        string program;
        string cid; // IPFS CID
        uint256 timestamp;
        address uploader;
        bool verified;
    }

    // Mapping from USN hash to StudentRecord
    mapping(bytes32 => StudentRecord) public records;
    // Mapping to track if a USN exists
    mapping(bytes32 => bool) public recordExists;
    // Array to store all USN hashes for enumeration
    bytes32[] public allRecordHashes;

    // Events
    event RecordUploaded(
        string indexed usn,
        string cid,
        address indexed approver,
        uint256 timestamp
    );
    
    event RecordVerified(
        string indexed usn,
        address indexed verifier,
        uint256 timestamp
    );

    event RoleGranted(bytes32 indexed role, address indexed account);

    constructor(address initialOwner) Ownable(initialOwner) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(APPROVER_ROLE, initialOwner);
        _grantRole(VERIFIER_ROLE, initialOwner);
    }

    /**
     * @dev Upload a student record to blockchain (only approvers)
     * @param usn Student's unique serial number
     * @param name Student's name
     * @param program Program/course name
     * @param cid IPFS CID of the marksheet PDF
     */
    function uploadRecord(
        string calldata usn,
        string calldata name,
        string calldata program,
        string calldata cid
    ) external onlyRole(APPROVER_ROLE) {
        bytes32 usnHash = keccak256(abi.encodePacked(usn));
        
        require(!recordExists[usnHash], "Record already exists");
        
        records[usnHash] = StudentRecord({
            usn: usn,
            name: name,
            program: program,
            cid: cid,
            timestamp: block.timestamp,
            uploader: msg.sender,
            verified: true
        });
        
        recordExists[usnHash] = true;
        allRecordHashes.push(usnHash);
        
        emit RecordUploaded(usn, cid, msg.sender, block.timestamp);
    }

    /**
     * @dev Verify a student record (only verifiers)
     * @param usn Student's unique serial number
     */
    function verifyRecord(string calldata usn) external onlyRole(VERIFIER_ROLE) {
        bytes32 usnHash = keccak256(abi.encodePacked(usn));
        
        require(recordExists[usnHash], "Record does not exist");
        require(!records[usnHash].verified, "Record already verified");
        
        records[usnHash].verified = true;
        
        emit RecordVerified(usn, msg.sender, block.timestamp);
    }

    /**
     * @dev Get a student record by USN
     * @param usn Student's unique serial number
     * @return StudentRecord struct
     */
    function getRecord(string calldata usn) external view returns (StudentRecord memory) {
        bytes32 usnHash = keccak256(abi.encodePacked(usn));
        require(recordExists[usnHash], "Record does not exist");
        return records[usnHash];
    }

    /**
     * @dev Get a student record by USN hash (for employers with role)
     * @param usnHash Hashed USN
     * @return StudentRecord struct
     */
    function getRecordByHash(bytes32 usnHash) external view returns (StudentRecord memory) {
        require(recordExists[usnHash], "Record does not exist");
        return records[usnHash];
    }

    /**
     * @dev Get total number of records
     * @return count Total number of records
     */
    function getRecordCount() external view returns (uint256) {
        return allRecordHashes.length;
    }

    /**
     * @dev Get record hash at index (for pagination)
     * @param index Index in allRecordHashes array
     * @return usnHash The hash at the index
     */
    function getRecordHashAtIndex(uint256 index) external view returns (bytes32) {
        require(index < allRecordHashes.length, "Index out of bounds");
        return allRecordHashes[index];
    }

    /**
     * @dev Grant approver role (only owner)
     * @param account Address to grant role to
     */
    function setApproverRole(address account) external onlyOwner {
        _grantRole(APPROVER_ROLE, account);
        emit RoleGranted(APPROVER_ROLE, account);
    }

    /**
     * @dev Grant verifier role (only owner)
     * @param account Address to grant role to
     */
    function setVerifierRole(address account) external onlyOwner {
        _grantRole(VERIFIER_ROLE, account);
        emit RoleGranted(VERIFIER_ROLE, account);
    }

    /**
     * @dev Grant employer role (only owner)
     * @param account Address to grant role to
     */
    function setEmployerRole(address account) external onlyOwner {
        _grantRole(EMPLOYER_ROLE, account);
        emit RoleGranted(EMPLOYER_ROLE, account);
    }

    /**
     * @dev Revoke approver role (only owner)
     * @param account Address to revoke role from
     */
    function revokeApproverRole(address account) external onlyOwner {
        _revokeRole(APPROVER_ROLE, account);
    }

    /**
     * @dev Revoke verifier role (only owner)
     * @param account Address to revoke role from
     */
    function revokeVerifierRole(address account) external onlyOwner {
        _revokeRole(VERIFIER_ROLE, account);
    }

    /**
     * @dev Revoke employer role (only owner)
     * @param account Address to revoke role from
     */
    function revokeEmployerRole(address account) external onlyOwner {
        _revokeRole(EMPLOYER_ROLE, account);
    }
}



