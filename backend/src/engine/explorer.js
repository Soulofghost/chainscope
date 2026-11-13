import { db } from '../db.js';
import { ethers } from 'ethers';

const KNOWN_SELECTORS = {
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x38ed1739': 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  '0x12345678': 'depositTransaction(address,uint256,bytes)'
};

export function decodeMethodSignature(inputData) {
  if (!inputData || inputData === '0x' || inputData.length < 10) {
    return 'ETH Transfer';
  }
  const selector = inputData.slice(0, 10).toLowerCase();
  return KNOWN_SELECTORS[selector] || `Unknown (${selector})`;
}

export function getNetworkStats() {
  const latestBlock = db.prepare('SELECT * FROM blocks ORDER BY number DESC LIMIT 1').get();
  const txTotal = db.prepare('SELECT count(*) as count FROM transactions').get().count;
  const avgGasPrice = db.prepare('SELECT AVG(gas_price_gwei) as avg_price FROM transactions').get().avg_price || 21.0;

  return {
    latestBlockNumber: latestBlock ? latestBlock.number : 0,
    latestBlockHash: latestBlock ? latestBlock.hash : '',
    totalIndexedTxs: txTotal,
    averageGasPriceGwei: Number(avgGasPrice.toFixed(2)),
    baseFeeGwei: latestBlock ? latestBlock.base_fee_gwei : 21.0,
    gasUtilizationPct: latestBlock ? Number(((latestBlock.gas_used / latestBlock.gas_limit) * 100).toFixed(1)) : 50.0
  };
}

export function getBlockByIdentifier(identifier) {
  let query = 'SELECT * FROM blocks WHERE ';
  let param;

  if (/^\d+$/.test(identifier)) {
    query += 'number = ?';
    param = parseInt(identifier, 10);
  } else {
    query += 'hash = ?';
    param = identifier.toLowerCase();
  }

  const block = db.prepare(query).get(param);
  if (!block) return null;

  const txs = db.prepare('SELECT * FROM transactions WHERE block_number = ? ORDER BY timestamp DESC').all(block.number);

  return {
    ...block,
    gasUtilizationPct: Number(((block.gas_used / block.gas_limit) * 100).toFixed(1)),
    transactions: txs
  };
}

export function getTransactionByHash(hash) {
  const tx = db.prepare('SELECT * FROM transactions WHERE hash = ?').get(hash.toLowerCase());
  if (!tx) return null;

  const tokenTransfers = db.prepare('SELECT * FROM token_transfers WHERE tx_hash = ?').all(tx.hash);
  const block = db.prepare('SELECT timestamp, base_fee_gwei FROM blocks WHERE number = ?').get(tx.block_number);

  return {
    ...tx,
    blockTimestamp: block ? block.timestamp : tx.timestamp,
    tokenTransfers
  };
}

export function getAddressProfile(rawAddress) {
  const normalized = rawAddress.toLowerCase();
  const addressRecord = db.prepare('SELECT * FROM addresses WHERE LOWER(address) = ?').get(normalized);

  // Compute live balances from indexed transactions
  const txs = db.prepare(`
    SELECT * FROM transactions
    WHERE LOWER(from_address) = ? OR LOWER(to_address) = ?
    ORDER BY timestamp DESC
  `).all(normalized, normalized);

  const tokenTransfers = db.prepare(`
    SELECT * FROM token_transfers
    WHERE LOWER(from_address) = ? OR LOWER(to_address) = ?
    ORDER BY timestamp DESC
  `).all(normalized, normalized);

  return {
    address: addressRecord ? addressRecord.address : rawAddress,
    label: addressRecord ? addressRecord.label : (isPotentialContract(normalized) ? 'Smart Contract' : 'External Owned Account (EOA)'),
    balanceEth: addressRecord ? addressRecord.balance_eth : 0.0,
    isContract: addressRecord ? Boolean(addressRecord.is_contract) : 0,
    txCount: txs.length,
    transactions: txs,
    tokenTransfers
  };
}

export function classifySearchQuery(q) {
  const clean = q.trim();
  if (/^\d+$/.test(clean)) {
    return { type: 'block', value: clean };
  }
  if (/^0x[a-fA-F0-9]{64}$/.test(clean)) {
    // Check if it matches a block hash or transaction hash
    const isBlock = db.prepare('SELECT number FROM blocks WHERE LOWER(hash) = ?').get(clean.toLowerCase());
    if (isBlock) return { type: 'block', value: clean };
    return { type: 'transaction', value: clean };
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(clean)) {
    return { type: 'address', value: clean };
  }
  return { type: 'unknown', value: clean };
}

function isPotentialContract(address) {
  const match = db.prepare('SELECT is_contract FROM addresses WHERE LOWER(address) = ?').get(address);
  return match ? Boolean(match.is_contract) : false;
}
