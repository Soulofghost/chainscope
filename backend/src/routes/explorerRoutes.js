import express from 'express';
import { db } from '../db.js';
import {
  getNetworkStats,
  getBlockByIdentifier,
  getTransactionByHash,
  getAddressProfile,
  classifySearchQuery
} from '../engine/explorer.js';

export const router = express.Router();

// Network Statistics
router.get('/network/stats', (req, res) => {
  try {
    const stats = getNetworkStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Blocks
router.get('/blocks', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 25;
    const blocks = db.prepare('SELECT * FROM blocks ORDER BY number DESC LIMIT ?').all(limit);
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/blocks/:identifier', (req, res) => {
  try {
    const block = getBlockByIdentifier(req.params.identifier);
    if (!block) return res.status(404).json({ error: 'Block not found.' });
    res.json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transactions
router.get('/transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 25;
    const txs = db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?').all(limit);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions/:hash', (req, res) => {
  try {
    const tx = getTransactionByHash(req.params.hash);
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Address Portfolio
router.get('/addresses/:address', (req, res) => {
  try {
    const profile = getAddressProfile(req.params.address);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Universal Search
router.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query parameter "q" required.' });

  try {
    const classification = classifySearchQuery(query);
    res.json(classification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
