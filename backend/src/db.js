import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

const dbPath = process.env.CHAINSCOPE_DB || join(DATA_DIR, 'chainscope.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      number INTEGER PRIMARY KEY,
      hash TEXT UNIQUE NOT NULL,
      parent_hash TEXT NOT NULL,
      miner TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      gas_used INTEGER NOT NULL,
      gas_limit INTEGER NOT NULL,
      base_fee_gwei REAL NOT NULL,
      tx_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      hash TEXT PRIMARY KEY,
      block_number INTEGER NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT,
      value_eth REAL NOT NULL DEFAULT 0.0,
      gas_price_gwei REAL NOT NULL,
      gas_used INTEGER NOT NULL,
      fee_eth REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success', 'reverted')),
      method_name TEXT NOT NULL DEFAULT 'transfer',
      input_data TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (block_number) REFERENCES blocks(number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_transfers (
      id TEXT PRIMARY KEY,
      tx_hash TEXT NOT NULL,
      token_address TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (tx_hash) REFERENCES transactions(hash) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS addresses (
      address TEXT PRIMARY KEY,
      label TEXT,
      balance_eth REAL NOT NULL DEFAULT 0.0,
      is_contract INTEGER NOT NULL DEFAULT 0,
      tx_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  const blockCount = db.prepare('SELECT count(*) as count FROM blocks').get().count;
  if (blockCount === 0) {
    seedEVMData();
  }
}

function seedEVMData() {
  const insertBlock = db.prepare(`
    INSERT INTO blocks (number, hash, parent_hash, miner, timestamp, gas_used, gas_limit, base_fee_gwei, tx_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTx = db.prepare(`
    INSERT INTO transactions (hash, block_number, from_address, to_address, value_eth, gas_price_gwei, gas_used, fee_eth, status, method_name, input_data, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertToken = db.prepare(`
    INSERT INTO token_transfers (id, tx_hash, token_address, token_symbol, from_address, to_address, amount, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAddr = db.prepare(`
    INSERT OR REPLACE INTO addresses (address, label, balance_eth, is_contract, tx_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  const baseTimestamp = Math.floor(Date.now() / 1000) - 300;

  // Blocks
  insertBlock.run(
    20184910,
    '0x7a9c8b3d4f1e56a2b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    '0x6b8a7c2d3e4f5a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b',
    '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
    baseTimestamp - 24,
    14250810,
    30000000,
    21.4,
    3
  );

  insertBlock.run(
    20184911,
    '0x8b0d9e2f3a4c5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    '0x7a9c8b3d4f1e56a2b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    '0xDAFEA492D9c6733ae3d56b7Ed1ADB60692c98Bc5',
    baseTimestamp - 12,
    11840220,
    30000000,
    19.8,
    2
  );

  insertBlock.run(
    20184912,
    '0x9c1e0f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e',
    '0x8b0d9e2f3a4c5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    '0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97',
    baseTimestamp,
    16940150,
    30000000,
    22.6,
    3
  );

  // Key Addresses
  const addrWhale = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth
  const addrUniswap = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'; // Uniswap Universal Router
  const addrUSDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Contract
  const addrBinance = '0x28C6c06298d514Db089934071355E5743bf21d60'; // Binance 14
  const addrUser1 = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  const addrUser2 = '0x3cD751E6b0078Be393132286c442345e5DC49699';

  insertAddr.run(addrWhale, 'Vitalik Buterin (vitalik.eth)', 1845.42, 0, 482);
  insertAddr.run(addrUniswap, 'Uniswap V3 Universal Router', 82.14, 1, 912040);
  insertAddr.run(addrUSDC, 'USD Coin (ERC-20)', 0.0, 1, 1420500);
  insertAddr.run(addrBinance, 'Binance Hot Wallet 14', 45210.88, 0, 680210);
  insertAddr.run(addrUser1, 'Institutional Liquidity Provider', 320.5, 0, 84);
  insertAddr.run(addrUser2, 'DeFi Arbitrage Bot', 42.18, 0, 1420);

  // Transactions
  // 1. Uniswap swap
  insertTx.run(
    '0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    20184910,
    addrUser1,
    addrUniswap,
    15.0,
    21.4,
    148200,
    (21.4 * 148200) / 1e9,
    'success',
    'swapExactTokensForTokens',
    '0x38ed1739000000000000000000000000000000000000000000000000000000000000000f',
    baseTimestamp - 24
  );

  // 2. Direct ETH Transfer from Binance
  insertTx.run(
    '0x4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c',
    20184910,
    addrBinance,
    addrWhale,
    50.0,
    21.4,
    21000,
    (21.4 * 21000) / 1e9,
    'success',
    'transfer',
    '0x',
    baseTimestamp - 24
  );

  // 3. USDC Token Transfer
  insertTx.run(
    '0x5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    20184911,
    addrWhale,
    addrUSDC,
    0.0,
    19.8,
    45000,
    (19.8 * 45000) / 1e9,
    'success',
    'transfer(address,uint256)',
    '0xa9059cbb00000000000000000000000071c7656ec7ab88b098defb751b7401b5f6d8976f00000000000000000000000000000000000000000000000000000002540be400',
    baseTimestamp - 12
  );

  insertToken.run(
    'tok-1',
    '0x5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    addrUSDC,
    'USDC',
    addrWhale,
    addrUser1,
    10000.0,
    baseTimestamp - 12
  );

  // 4. Large Layer 2 Bridge Deposit
  insertTx.run(
    '0x6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
    20184912,
    addrUser2,
    '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f', // Arbitrum Bridge
    12.5,
    22.6,
    78500,
    (22.6 * 78500) / 1e9,
    'success',
    'depositTransaction',
    '0x12345678',
    baseTimestamp
  );
}
