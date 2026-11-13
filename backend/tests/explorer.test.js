import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDb } from '../src/db.js';
import {
  getNetworkStats,
  getBlockByIdentifier,
  getTransactionByHash,
  getAddressProfile,
  decodeMethodSignature,
  classifySearchQuery
} from '../src/engine/explorer.js';

describe('ChainScope EVM Explorer Engine Tests', () => {
  before(() => {
    initDb();
  });

  test('Database seeds initial EVM blocks and transactions', () => {
    const blocksCount = db.prepare('SELECT count(*) as count FROM blocks').get().count;
    const txCount = db.prepare('SELECT count(*) as count FROM transactions').get().count;
    assert.ok(blocksCount >= 3, 'Should have at least 3 seeded blocks');
    assert.ok(txCount >= 4, 'Should have at least 4 seeded transactions');
  });

  test('getNetworkStats returns real-time EVM metrics', () => {
    const stats = getNetworkStats();
    assert.ok(stats.latestBlockNumber >= 20184910);
    assert.ok(stats.totalIndexedTxs >= 4);
    assert.ok(stats.baseFeeGwei > 0);
    assert.ok(stats.averageGasPriceGwei > 0);
  });

  test('getBlockByIdentifier retrieves block by integer height and hex hash', () => {
    const blockByNum = getBlockByIdentifier('20184910');
    assert.ok(blockByNum, 'Block should be found by number');
    assert.equal(blockByNum.number, 20184910);
    assert.ok(blockByNum.transactions.length > 0);

    const blockByHash = getBlockByIdentifier(blockByNum.hash);
    assert.ok(blockByHash, 'Block should be found by hash');
    assert.equal(blockByHash.number, 20184910);
  });

  test('getTransactionByHash returns transaction with gas metrics and token transfers', () => {
    const txHash = '0x5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
    const tx = getTransactionByHash(txHash);
    assert.ok(tx, 'Transaction should exist');
    assert.equal(tx.status, 'success');
    assert.ok(tx.tokenTransfers.length >= 1, 'Should include USDC transfer');
    assert.equal(tx.tokenTransfers[0].token_symbol, 'USDC');
    assert.equal(tx.tokenTransfers[0].amount, 10000.0);
  });

  test('getAddressProfile aggregates ETH balance and transaction activity', () => {
    const vitalik = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const profile = getAddressProfile(vitalik);
    assert.ok(profile, 'Address profile should be returned');
    assert.equal(profile.balanceEth, 1845.42);
    assert.ok(profile.transactions.length >= 2, 'Should have linked transactions');
  });

  test('decodeMethodSignature translates 4-byte EVM selectors to human signatures', () => {
    assert.equal(decodeMethodSignature('0xa9059cbb000000'), 'transfer(address,uint256)');
    assert.equal(decodeMethodSignature('0x095ea7b3000000'), 'approve(address,uint256)');
    assert.equal(decodeMethodSignature('0x'), 'ETH Transfer');
  });

  test('classifySearchQuery accurately identifies block, transaction, and address queries', () => {
    assert.equal(classifySearchQuery('20184912').type, 'block');
    assert.equal(classifySearchQuery('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045').type, 'address');
    assert.equal(classifySearchQuery('0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b').type, 'transaction');
    assert.equal(classifySearchQuery('invalid-query').type, 'unknown');
  });
});
