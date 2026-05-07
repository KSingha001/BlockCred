const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StudentRecords", function () {
  let studentRecords;
  let owner, uploader, verifier, employer, student;

  beforeEach(async function () {
    [owner, uploader, verifier, employer, student] = await ethers.getSigners();

    const StudentRecords = await ethers.getContractFactory("StudentRecords");
    studentRecords = await StudentRecords.deploy(owner.address);
    await studentRecords.waitForDeployment();

    // Grant roles
    await studentRecords.setUploaderRole(uploader.address);
    await studentRecords.setVerifierRole(verifier.address);
    await studentRecords.setEmployerRole(employer.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await studentRecords.owner()).to.equal(owner.address);
    });

    it("Should grant initial roles to owner", async function () {
      expect(await studentRecords.hasRole(await studentRecords.UPLOADER_ROLE(), owner.address)).to.be.true;
      expect(await studentRecords.hasRole(await studentRecords.VERIFIER_ROLE(), owner.address)).to.be.true;
    });
  });

  describe("Record Upload", function () {
    it("Should allow uploader to upload a record", async function () {
      const usn = "USN001";
      const name = "John Doe";
      const program = "Computer Science";
      const cid = "QmTest123";

      await expect(
        studentRecords.connect(uploader).uploadRecord(usn, name, program, cid)
      ).to.emit(studentRecords, "RecordUploaded");

      const record = await studentRecords.getRecord(usn);
      expect(record.usn).to.equal(usn);
      expect(record.name).to.equal(name);
      expect(record.cid).to.equal(cid);
      expect(record.verified).to.be.false;
    });

    it("Should not allow non-uploader to upload", async function () {
      await expect(
        studentRecords.connect(student).uploadRecord("USN002", "Jane", "CS", "QmTest")
      ).to.be.revertedWithCustomError(studentRecords, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow duplicate USN", async function () {
      await studentRecords.connect(uploader).uploadRecord("USN003", "Test", "CS", "QmTest");
      
      await expect(
        studentRecords.connect(uploader).uploadRecord("USN003", "Test2", "CS", "QmTest2")
      ).to.be.revertedWith("Record already exists");
    });
  });

  describe("Record Verification", function () {
    beforeEach(async function () {
      await studentRecords.connect(uploader).uploadRecord("USN004", "Alice", "CS", "QmTest456");
    });

    it("Should allow verifier to verify a record", async function () {
      await expect(
        studentRecords.connect(verifier).verifyRecord("USN004")
      ).to.emit(studentRecords, "RecordVerified");

      const record = await studentRecords.getRecord("USN004");
      expect(record.verified).to.be.true;
    });

    it("Should not allow non-verifier to verify", async function () {
      await expect(
        studentRecords.connect(student).verifyRecord("USN004")
      ).to.be.revertedWithCustomError(studentRecords, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow verifying already verified record", async function () {
      await studentRecords.connect(verifier).verifyRecord("USN004");
      
      await expect(
        studentRecords.connect(verifier).verifyRecord("USN004")
      ).to.be.revertedWith("Record already verified");
    });
  });

  describe("Role Management", function () {
    it("Should allow owner to grant roles", async function () {
      await studentRecords.setUploaderRole(student.address);
      expect(await studentRecords.hasRole(await studentRecords.UPLOADER_ROLE(), student.address)).to.be.true;
    });

    it("Should not allow non-owner to grant roles", async function () {
      await expect(
        studentRecords.connect(uploader).setUploaderRole(student.address)
      ).to.be.revertedWithCustomError(studentRecords, "OwnableUnauthorizedAccount");
    });
  });
});






