import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

async function deploy() {
  console.log('1. Setting up Aptos client for Testnet...');
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  console.log('2. Generating a new burner account for deployment...');
  const account = Account.generate();
  console.log(`Account Address: ${account.accountAddress.toString()}`);
  console.log(`Private Key: ${account.privateKey.toString()}`);

  console.log('3. Funding account via Faucet...');
  await aptos.fundAccount({
    accountAddress: account.accountAddress,
    amount: 100_000_000, // 1 APT
  });
  console.log('Funded 1 APT.');

  console.log('4. Initializing Aptos CLI profile...');
  // We use the CLI to compile and publish because writing a raw publisher script
  // requires compiling the Move code first anyway.
  const privateKeyHex = account.privateKey.toString();
  const contractsPath = path.join(process.cwd(), 'packages', 'contracts');
  
  // Create a .aptos/config.yaml manually for the CLI
  const aptosDir = path.join(contractsPath, '.aptos');
  if (!fs.existsSync(aptosDir)) fs.mkdirSync(aptosDir);
  
  fs.writeFileSync(path.join(aptosDir, 'config.yaml'), `
profiles:
  default:
    network: testnet
    private_key: "${privateKeyHex}"
    public_key: "${account.publicKey.toString()}"
    account: "${account.accountAddress.toString()}"
    rest_url: "https://api.testnet.aptoslabs.com"
    faucet_url: "https://faucet.testnet.aptos.dev"
    skip_prompt: true
`);

  console.log('5. Compiling and Publishing Move Contract...');
  try {
    // First we must update Move.toml to use the new account address for nft_collection
    const moveTomlPath = path.join(contractsPath, 'Move.toml');
    let moveToml = fs.readFileSync(moveTomlPath, 'utf8');
    moveToml = moveToml.replace(/nft_collection = "0x[a-f0-9A-F]+"/g, `nft_collection = "${account.accountAddress.toString()}"`);
    fs.writeFileSync(moveTomlPath, moveToml);

    // Call aptos CLI locally if installed, or we can use npx aptos
    // Wait, let's write a script that downloads the statically linked CLI
    console.log('We will use npx @aptos-labs/ts-sdk to publish or the wallet directly.');
  } catch (e) {
    console.error('Publishing failed:', e);
  }
}

deploy();
