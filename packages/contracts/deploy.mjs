import { Aptos, AptosConfig, Network, Account } from "@aptos-labs/ts-sdk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

async function main() {
  console.log("Generating deployment account...");
  const account = Account.generate();
  console.log(`Deployment Account Address: ${account.accountAddress.toString()}`);
  console.log(`Deployment Account Private Key: ${account.privateKey.toString()}`);

  console.log("\nFunding account from testnet faucet...");
  await aptos.fundAccount({
    accountAddress: account.accountAddress,
    amount: 100_000_000, // 1 APT
  });
  console.log("Account funded successfully.");

  console.log("\nCompiling Move module...");
  const moduleAddress = account.accountAddress.toString();
  
  // Use npx aptos to just BUILD the module to get the bytecode.
  execSync(
    `npx aptos move build --named-addresses nft_collection=${moduleAddress} --skip-fetch-latest-git-deps`,
    { stdio: "inherit" }
  );

  console.log("\nReading compiled package metadata and bytecode...");
  const packageMetadata = fs.readFileSync(
    path.join("build", "nft_collection", "package-metadata.bcs")
  );
  
  const modulePath = path.join("build", "nft_collection", "bytecode_modules", "nft_collection.bcs");
  const moduleBytecode = fs.readFileSync(modulePath);

  console.log("Publishing package to testnet...");
  const transaction = await aptos.publishPackageTransaction({
    account: account.accountAddress,
    metadataBytes: packageMetadata,
    moduleBytecode: [moduleBytecode],
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  console.log(`Waiting for transaction: ${pendingTxn.hash}`);
  const response = await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
  
  console.log("\n✅ Smart Contract Deployed Successfully!");
  console.log(`Contract Address: ${moduleAddress}`);
  console.log(`View on Explorer: https://explorer.aptoslabs.com/account/${moduleAddress}/modules?network=testnet`);
  
  console.log("\n🔥 IMPORTANT: Update your frontend .env.local with this address:");
  console.log(`NEXT_PUBLIC_NFT_COLLECTION_ADDRESS=${moduleAddress}`);
}

main().catch(console.error);
