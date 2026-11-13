// ChainScope EVM Explorer Client
const API_BASE = '/api/v1';

let pollTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  setupUI();
  loadDashboard();
  pollTimer = setInterval(loadDashboard, 6000); // Poll fresh blocks every 6s
});

function setupUI() {
  document.getElementById('searchForm').addEventListener('submit', handleSearch);
  document.getElementById('btnBackToHome').addEventListener('click', showHomeView);
}

async function loadDashboard() {
  try {
    const [stats, blocks, txs] = await Promise.all([
      fetch(`${API_BASE}/network/stats`).then(r => r.json()),
      fetch(`${API_BASE}/blocks?limit=10`).then(r => r.json()),
      fetch(`${API_BASE}/transactions?limit=10`).then(r => r.json())
    ]);

    updateNetworkMetrics(stats);
    renderBlocksFeed(blocks);
    renderTransactionsFeed(txs);
  } catch (err) {
    console.error('Error fetching dashboard feeds:', err);
  }
}

function updateNetworkMetrics(stats) {
  document.getElementById('mLatestBlock').textContent = `#${stats.latestBlockNumber.toLocaleString()}`;
  document.getElementById('mBaseFee').textContent = `${stats.baseFeeGwei} Gwei`;
  document.getElementById('mGasPrice').textContent = `${stats.averageGasPriceGwei} Gwei`;
  document.getElementById('mGasUtil').textContent = `${stats.gasUtilizationPct}%`;
  document.getElementById('mTotalTxs').textContent = stats.totalIndexedTxs.toLocaleString();
}

function renderBlocksFeed(blocks) {
  const container = document.getElementById('blocksFeed');
  container.innerHTML = blocks.map(b => `
    <div class="feed-card" onclick="viewBlock('${b.number}')">
      <div class="card-main">
        <div class="icon-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </div>
        <div>
          <a class="hash-link" href="javascript:void(0)">Block #${b.number}</a>
          <div class="sub-meta">${b.tx_count} txns · Base Fee: ${b.base_fee_gwei} Gwei</div>
        </div>
      </div>
      <div class="card-right">
        <div class="value-pill">${formatTimeAgo(b.timestamp)}</div>
        <div class="sub-meta" style="font-family:var(--font-mono);">${formatAddress(b.miner)}</div>
      </div>
    </div>
  `).join('');
}

function renderTransactionsFeed(txs) {
  const container = document.getElementById('txsFeed');
  container.innerHTML = txs.map(tx => `
    <div class="feed-card" onclick="viewTransaction('${tx.hash}')">
      <div class="card-main">
        <div class="icon-box" style="background:rgba(6, 182, 212, 0.12);color:#38bdf8;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div>
          <a class="hash-link" href="javascript:void(0)">${formatHash(tx.hash)}</a>
          <div class="sub-meta">${escapeHtml(tx.method_name)}</div>
        </div>
      </div>
      <div class="card-right">
        <div class="value-pill">${tx.value_eth > 0 ? tx.value_eth + ' ETH' : '0 ETH'}</div>
        <div class="sub-meta" style="font-family:var(--font-mono);">${formatAddress(tx.from_address)} &rarr; ${formatAddress(tx.to_address)}</div>
      </div>
    </div>
  `).join('');
}

async function handleSearch(e) {
  e.preventDefault();
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    const result = await res.json();

    if (result.type === 'block') {
      viewBlock(result.value);
    } else if (result.type === 'transaction') {
      viewTransaction(result.value);
    } else if (result.type === 'address') {
      viewAddress(result.value);
    } else {
      alert(`No matching block, transaction, or address found for: "${query}"`);
    }
  } catch (err) {
    alert('Search query failed: ' + err.message);
  }
}

// Detail Views
window.viewBlock = async function(identifier) {
  showDetailView('Block #' + identifier);
  const container = document.getElementById('detailContent');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading block telemetry...</p>';

  try {
    const res = await fetch(`${API_BASE}/blocks/${identifier}`);
    const b = await res.json();

    container.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="row-label">Block Height:</span>
          <span class="row-value"><strong>#${b.number}</strong></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Timestamp:</span>
          <span class="row-value">${new Date(b.timestamp * 1000).toUTCString()} (${formatTimeAgo(b.timestamp)})</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Transactions:</span>
          <span class="row-value"><strong>${b.tx_count} transactions</strong> verified in this block</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Fee Recipient / Miner:</span>
          <span class="row-value"><a class="hash-link" href="javascript:void(0)" onclick="viewAddress('${b.miner}')">${b.miner}</a></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Block Hash:</span>
          <span class="row-value">${b.hash}</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Parent Hash:</span>
          <span class="row-value">${b.parent_hash}</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Gas Used / Target:</span>
          <span class="row-value">${b.gas_used.toLocaleString()} / ${b.gas_limit.toLocaleString()} (${b.gasUtilizationPct}% utilized)</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Base Fee Per Gas:</span>
          <span class="row-value" style="color:var(--cyan-light);">${b.base_fee_gwei} Gwei</span>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--rose-danger);">Error fetching block: ${err.message}</p>`;
  }
};

window.viewTransaction = async function(hash) {
  showDetailView('Transaction ' + formatHash(hash));
  const container = document.getElementById('detailContent');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading transaction verification...</p>';

  try {
    const res = await fetch(`${API_BASE}/transactions/${hash}`);
    const tx = await res.json();

    let tokensHtml = '';
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      tokensHtml = `
        <div class="detail-row">
          <span class="row-label">ERC-20 Tokens Transferred:</span>
          <div class="row-value">
            ${tx.tokenTransfers.map(t => `
              <div style="margin-bottom:4px;color:var(--cyan-light);">
                &bull; <strong>${t.amount.toLocaleString()} ${escapeHtml(t.token_symbol)}</strong>
                from <a class="hash-link" href="javascript:void(0)" onclick="viewAddress('${t.from_address}')">${formatAddress(t.from_address)}</a>
                to <a class="hash-link" href="javascript:void(0)" onclick="viewAddress('${t.to_address}')">${formatAddress(t.to_address)}</a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="row-label">Transaction Hash:</span>
          <span class="row-value">${tx.hash}</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Execution Status:</span>
          <span class="row-value"><span class="status-badge-ok">${tx.status.toUpperCase()}</span></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Block Number:</span>
          <span class="row-value"><a class="hash-link" href="javascript:void(0)" onclick="viewBlock('${tx.block_number}')">#${tx.block_number}</a></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Timestamp:</span>
          <span class="row-value">${new Date(tx.timestamp * 1000).toUTCString()} (${formatTimeAgo(tx.timestamp)})</span>
        </div>
        <div class="detail-row">
          <span class="row-label">From:</span>
          <span class="row-value"><a class="hash-link" href="javascript:void(0)" onclick="viewAddress('${tx.from_address}')">${tx.from_address}</a></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Interacted With (To):</span>
          <span class="row-value"><a class="hash-link" href="javascript:void(0)" onclick="viewAddress('${tx.to_address}')">${tx.to_address}</a></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Transfer Value:</span>
          <span class="row-value" style="font-size:1.05rem;font-weight:700;">${tx.value_eth} ETH</span>
        </div>
        ${tokensHtml}
        <div class="detail-row">
          <span class="row-label">Transaction Fee:</span>
          <span class="row-value">${tx.fee_eth.toFixed(6)} ETH (${tx.gas_price_gwei} Gwei &times; ${tx.gas_used.toLocaleString()} gas)</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Decoded Method:</span>
          <span class="row-value"><code style="color:var(--emerald-success);font-weight:700;">${escapeHtml(tx.method_name)}</code></span>
        </div>
        <div class="detail-row">
          <span class="row-label">Raw Calldata:</span>
          <div class="row-value">
            <div class="hex-box">${escapeHtml(tx.input_data || '0x')}</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--rose-danger);">Error fetching transaction: ${err.message}</p>`;
  }
};

window.viewAddress = async function(address) {
  showDetailView('Address Portfolio');
  const container = document.getElementById('detailContent');
  container.innerHTML = '<p style="color:var(--text-muted);">Indexing portfolio & historical ledger...</p>';

  try {
    const res = await fetch(`${API_BASE}/addresses/${address}`);
    const a = await res.json();

    container.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="row-label">Ethereum Address:</span>
          <span class="row-value">${a.address}</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Entity Label / Type:</span>
          <span class="row-value"><strong>${escapeHtml(a.label)}</strong> (${a.isContract ? 'Smart Contract' : 'EOA'})</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Ether Balance:</span>
          <span class="row-value" style="font-size:1.15rem;font-weight:700;color:var(--cyan-light);">${a.balanceEth.toLocaleString()} ETH</span>
        </div>
        <div class="detail-row">
          <span class="row-label">Total Transactions:</span>
          <span class="row-value">${a.txCount} historical transfers</span>
        </div>
      </div>

      <h3 style="margin:24px 0 12px;font-family:var(--font-heading);font-size:1.05rem;">Linked Transactions</h3>
      <div class="feed-list">
        ${a.transactions.map(tx => `
          <div class="feed-card" onclick="viewTransaction('${tx.hash}')">
            <div>
              <a class="hash-link" href="javascript:void(0)">${formatHash(tx.hash)}</a>
              <div class="sub-meta">${escapeHtml(tx.method_name)} · Block #${tx.block_number}</div>
            </div>
            <div class="card-right">
              <div class="value-pill">${tx.value_eth} ETH</div>
              <div class="sub-meta">${formatTimeAgo(tx.timestamp)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--rose-danger);">Error fetching address: ${err.message}</p>`;
  }
};

function showDetailView(breadcrumb) {
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');
  document.getElementById('detailBreadcrumb').textContent = breadcrumb;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHomeView() {
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('homeView').classList.remove('hidden');
  loadDashboard();
}

function formatAddress(addr) {
  if (!addr) return 'None';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatHash(hash) {
  if (!hash) return '';
  return hash.slice(0, 10) + '...' + hash.slice(-8);
}

function formatTimeAgo(ts) {
  const diffSec = Math.floor(Date.now() / 1000) - ts;
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
