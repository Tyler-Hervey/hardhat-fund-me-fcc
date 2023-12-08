import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { network, deployments, ethers, getNamedAccounts } from "hardhat"
import { assert, expect } from "chai"
import { developmentChains } from "../../helper-hardhat-config"
import { FundMe, MockV3Aggregator } from "../../typechain-types"

// https://hardhat.org/tutorial/debugging-with-hardhat-network  - to use console.log with solidity

describe("FundMe", function () {
    let fundMe: FundMe
    let deployer: SignerWithAddress
    let MockV3Aggregator: MockV3Aggregator
    const sendValue = ethers.utils.parseEther("1")

    beforeEach(async function () {
        // deploy our FundMe contract

        // use ethers to get our local blockchain accounts
        // const accounts = await ethers.getSigners()
        // const accountZero = accounts[0]
        // const accounts = await ethers.getSigners()
        // deployer = accounts[0]
        if (!developmentChains.includes(network.name)) {
            throw "You need to be on a development chain to run tests"
        }
        const accounts = await ethers.getSigners()
        deployer = accounts[0]

        // const deployer = (await getNamedAccounts()).deployer
        // allows us to deploy with as many tags as we want, deploys everything with the tag "all"
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        MockV3Aggregator = await ethers.getContract("MockV3Aggregator")
    })

    describe("constructor", function () {
        it("sets the aggregator addresses correctly", async function () {
            const response = await fundMe.getPriceFeed()
            assert.equal(response, MockV3Aggregator.address)
        })
    })
    // write tests for receive and fallback for hw

    describe("fund", function () {
        it("Fails if you don't send enough eth", async function () {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH"
            )
        })
        // we could be even more precise here by making sure exactly $50 works
        // but this is good enough for now
        it("Updates the amount funded data structure", async () => {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getAddressToAmountFunded(
                deployer.address
            )
            assert.equal(response.toString(), sendValue.toString())
        })
        it("Adds funder to array of funders", async () => {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getFunder(0)
            assert.equal(response, deployer.address)
        })
    })

    describe("withdraw", function () {
        beforeEach(async () => {
            await fundMe.fund({ value: sendValue })
        })
        it("gives a single funder all their ETH back", async () => {
            // Arrange
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer.address
            )

            // Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait()

            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer.address
            )

            // Assert
            assert.equal(endingFundMeBalance.toString(), "0")
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            )
        })
        // this test is overloaded. Ideally we'd split it into multiple tests
        // but for simplicity we left it as one
        it("is allows us to withdraw with multiple funders", async () => {
            // Arrange
            const accounts = await ethers.getSigners()
            await fundMe.connect(accounts[1]).fund({ value: sendValue })
            await fundMe.connect(accounts[2]).fund({ value: sendValue })
            await fundMe.connect(accounts[3]).fund({ value: sendValue })
            await fundMe.connect(accounts[4]).fund({ value: sendValue })
            await fundMe.connect(accounts[5]).fund({ value: sendValue })
            // Act
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer.address
            )
            const transactionResponse = await fundMe.cheaperWithdraw()
            // Let's comapre gas costs :)
            // const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait()
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const withdrawGasCost = gasUsed.mul(effectiveGasPrice)
            console.log(`GasCost: ${withdrawGasCost}`)
            console.log(`GasUsed: ${gasUsed}`)
            console.log(`GasPrice: ${effectiveGasPrice}`)
            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer.address
            )
            // Assert
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(withdrawGasCost).toString()
            )
            await expect(fundMe.getFunder(0)).to.be.reverted
            assert.equal(
                (
                    await fundMe.getAddressToAmountFunded(accounts[1].address)
                ).toString(),
                "0"
            )
            assert.equal(
                (
                    await fundMe.getAddressToAmountFunded(accounts[2].address)
                ).toString(),
                "0"
            )
            assert.equal(
                (
                    await fundMe.getAddressToAmountFunded(accounts[3].address)
                ).toString(),
                "0"
            )
            assert.equal(
                (
                    await fundMe.getAddressToAmountFunded(accounts[4].address)
                ).toString(),
                "0"
            )
            assert.equal(
                (
                    await fundMe.getAddressToAmountFunded(accounts[5].address)
                ).toString(),
                "0"
            )
        })
    })
})
