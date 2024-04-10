const { expect } = require("chai");
const hre = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Escrow", () => {
  const amount = hre.ethers.parseUnits("10.0");

  const deployContract = async () => {
    /**
     * Deploy ERC20 token
     * */
    const ERC20Contract = await ethers.getContractFactory("MockDaiToken");
    const erc20 = await ERC20Contract.deploy();

    /**
     * Get test accounts
     * */
    const [deployer, happyPathAccount, unhappyPathAccount] =
      await hre.ethers.getSigners();

    /**
     * Transfer some ERC20s to happyPathAccount
     * */
    const transferTx = await erc20.transfer(
      happyPathAccount.address,
      "80000000000000000000"
    );
    await transferTx.wait();

    /**
     * Deploy Escrow Contract
     *
     * - Add ERC20 address to the constructor
     * - Add escrow admin wallet address to the constructor
     * */
    const EscrowContract = await ethers.getContractFactory("Escrow");
    const contract = await EscrowContract.deploy(await erc20.getAddress());

    /**
     * Seed ERC20 allowance
     * */
    const erc20WithSigner = erc20.connect(happyPathAccount);
    const approveTx = await erc20WithSigner.approve(
      await contract.getAddress(),
      "90000000000000000000"
    );
    await approveTx.wait();

    return { deployer, happyPathAccount, unhappyPathAccount, erc20, contract };
  };

  // Test depositEscrow function

  it("Happy Path: depositEscrow", async () => {
    const { happyPathAccount, contract, erc20 } = await loadFixture(
      deployContract
    );
    const contractWithSigner = contract.connect(happyPathAccount);
    const trxHash = await contract.getHash(amount);
    const depositEscrowTx = await contractWithSigner.depositEscrow(
      trxHash,
      amount
    );
    await depositEscrowTx.wait();

    expect(
      (await erc20.balanceOf(happyPathAccount.address)).toString()
    ).to.equal("70000000000000000000");
  });

  it("Unhappy Path: depositEscrow - Transaction hash cannot be empty!", async () => {
    const { unhappyPathAccount, contract } = await loadFixture(deployContract);
    const contractWithSigner = contract.connect(unhappyPathAccount);
    let err = "";

    try {
      await contractWithSigner.depositEscrow(hre.ethers.ZeroHash, amount);
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal(
      "VM Exception while processing transaction: reverted with reason string 'Transaction hash cannot be empty!'"
    );
  });

  it("Unhappy Path: depositEscrow - Escrow amount cannot be equal to 0.", async () => {
    const { unhappyPathAccount, contract } = await loadFixture(deployContract);
    const contractWithSigner = contract.connect(unhappyPathAccount);
    const trxHash = await contract.getHash(amount);
    let err = "";

    try {
      await contractWithSigner.depositEscrow(
        trxHash,
        hre.ethers.parseUnits("0")
      );
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal(
      "VM Exception while processing transaction: reverted with reason string 'Escrow amount cannot be equal to 0.'"
    );
  });

  it("Unhappy Path: depositEscrow - Unique hash conflict, hash is already in use.", async () => {
    const { happyPathAccount, contract, erc20 } = await loadFixture(
      deployContract
    );
    const contractWithSigner = contract.connect(happyPathAccount);
    const trxHash = await contract.getHash(amount);
    const depositEscrowTx = await contractWithSigner.depositEscrow(
      trxHash,
      amount
    );
    await depositEscrowTx.wait();

    expect(
      (await erc20.balanceOf(happyPathAccount.address)).toString()
    ).to.equal("70000000000000000000");
    let err = "";

    try {
      await contractWithSigner.depositEscrow(trxHash, amount);
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal(
      "VM Exception while processing transaction: reverted with reason string 'Unique hash conflict, hash is already in use.'"
    );
  });

  it("Unhappy Path: depositEscrow - ERC20: insufficient allowance", async () => {
    const { unhappyPathAccount, contract } = await loadFixture(deployContract);
    const contractWithSigner = contract.connect(unhappyPathAccount);
    const trxHash = await contract.getHash(amount);
    let err = "";

    try {
      await contractWithSigner.depositEscrow(trxHash, amount);
    } catch (e) {
      err = e.message;
    }

    expect(err).to.contains("ERC20InsufficientAllowance");
  });

  // Test withdrawal function

  it("Happy Path: withdrawalEscrow", async () => {
    const { happyPathAccount, contract, erc20 } = await loadFixture(
      deployContract
    );
    const contractWithSigner = contract.connect(happyPathAccount);
    const trxHash = await contract.getHash(amount);
    const depositEscrowTx = await contractWithSigner.depositEscrow(
      trxHash,
      amount
    );
    await depositEscrowTx.wait();

    expect(
      (await erc20.balanceOf(happyPathAccount.address)).toString()
    ).to.equal("70000000000000000000");

    const withdrawalEscrowTx = await contractWithSigner.withdrawalEscrow(
      trxHash
    );

    await withdrawalEscrowTx.wait();

    expect(
      (await erc20.balanceOf(happyPathAccount.address)).toString()
    ).to.equal("80000000000000000000");
  });

  it("Unhappy Path: withdrawalEscrow - Transaction hash cannot be empty!", async () => {
    const { unhappyPathAccount, contract } = await loadFixture(deployContract);
    const contractWithSigner = contract.connect(unhappyPathAccount);
    let err = "";

    try {
      await contractWithSigner.withdrawalEscrow(hre.ethers.ZeroHash);
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal(
      "VM Exception while processing transaction: reverted with reason string 'Transaction hash cannot be empty!'"
    );
  });

  it("Unhappy Path: withdrawalEscrow - Escrow with transaction hash doesn't exist.", async () => {
    const { happyPathAccount, contract } = await loadFixture(deployContract);
    const contractWithSigner = contract.connect(happyPathAccount);
    const trxHash = await contract.getHash(hre.ethers.parseUnits("1.0"));
    let err = "";

    try {
      await contractWithSigner.withdrawalEscrow(trxHash);
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal(
      "VM Exception while processing transaction: reverted with reason string 'Escrow with transaction hash doesn't exist.'"
    );
  });
});
