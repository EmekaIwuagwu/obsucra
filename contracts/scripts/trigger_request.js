const { ethers } = require("hardhat");

async function main() {
    console.log("⚡ Triggering Oracle Request...");

    const [, , requester] = await ethers.getSigners();

    // We need the oracle address. In a real E2E we'd read this from a file or environment.
    // Let's assume the user passes it or we find the latest deployment.
    // For this helper, we'll try to find it from the generated config if possible, 
    // or just ask the user to verify.

    const oracleAddr = process.env.ORACLE_ADDR;
    if (!oracleAddr) {
        console.error("❌ Error: ORACLE_ADDR environment variable not set.");
        console.log("Usage: ORACLE_ADDR=0x... npx hardhat run scripts/trigger_request.js --network localhost");
        return;
    }

    const Oracle = await ethers.getContractFactory("ObscuraOracle");
    const oracle = Oracle.attach(oracleAddr);

    console.log(`📡 Sending request to Oracle at ${oracleAddr}...`);

    const tx = await oracle.connect(requester).requestData(
        "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
        9000000000000, // 90k min (8 decimals)
        11000000000000, // 110k max
        "Test E2E BTC Feed"
    );

    const receipt = await tx.wait();
    console.log(`✅ Request sent! TX: ${receipt.hash}`);

    // Listen for fulfillment
    console.log("⏳ Waiting for node fulfillment (this may take a few seconds)...");

    oracle.on("RequestFulfilled", (id, value) => {
        console.log("\n🎉 DATA FULFILLED!");
        console.log(`- Request ID: ${id}`);
        console.log(`- Aggregated Value: $${(Number(value) / 1e8).toLocaleString()}`);
        console.log("-----------------------------------------");

        // Check latest round data
        oracle.latestRoundData().then(data => {
            console.log("🔗 Verified in Persistent Round:", data.roundId.toString());
            process.exit(0);
        });
    });

    // Timeout after 60s
    setTimeout(() => {
        console.log("⏰ Timeout reached while waiting for fulfillment.");
        process.exit(1);
    }, 60000);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
