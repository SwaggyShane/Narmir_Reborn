import React, { useState, useEffect } from 'react';

const icons = {
  food: "🌾",
  wood: "🪵",
  stone: "🪨",
  iron: "🔗",
  coal: "🌑",
  steel: "📏",
  mana: "✨",
  hammers: "🔨",
  weapons: "⚔️",
  armor: "🛡️",
  war_machines: "🏹",
  land: "🗺️",
};

const MarketPanel = () => {
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [sellMultiplier, setSellMultiplier] = useState(0.7);
  const [state, setState] = useState({});

  useEffect(() => {
    // Initial state copy
    if (window.gameState) setState({ ...window.gameState });

    const updateState = () => {
      if (window.gameState) {
        setState({ ...window.gameState });
        let mult = 0.7;
        if (window.gameState.prestige_level && window.gameState.prestige_level > 0) {
          mult += Math.min(0.1, window.gameState.prestige_level * 0.02);
        }
        setSellMultiplier(mult);
      }
    };

    updateState();

    const unreg = window.registerPanelReactHook && window.registerPanelReactHook('market', updateState);

    // Replace the global loadMarket
    window.loadMarket = refreshMarket;
    refreshMarket();

    return () => { if (unreg) unreg(); };
  }, []);

  const fmt = (n) => {
    if (n === undefined || n === null || isNaN(n)) return "0";
    return Math.round(n).toLocaleString();
  };

  const fmtPrice = (n) => {
    if (n === undefined || n === null || isNaN(n)) return "0";
    // Show up to 3 decimal places, removing trailing zeros
    if (n >= 0.01) {
      return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    }
    // For very small prices, show more precision
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 6 });
  };

  const formatLabel = (id) => {
    return id
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const ownedAmount = (id) => {
    let key = id;
    if (id === "weapons") key = "weapons_stockpile";
    if (id === "armor") key = "armor_stockpile";
    
    // Check top level first
    if (state[key] !== undefined) return state[key];
    
    // Check resources obj
    if (state.resources && state.resources[key] !== undefined) return state.resources[key];

    return 0; 
  };

  const refreshMarket = async () => {
    setLoading(true);
    if (window.apiCall) {
      try {
         const data = await window.apiCall("GET", "/api/kingdom/market/prices");
         if (Array.isArray(data)) {
           setPrices(data.filter((p) => p.id !== "hammers"));
         }
      } catch (e) {
         console.error("Failed to load market prices", e);
      }
    }
    setLoading(false);
  };

  const marketTrade = async (resource, op) => {
    const qtyStr = quantities[resource];
    const qty = parseInt(qtyStr);
    if (!qty || qty <= 0) {
      if (window.toast) window.toast("Enter a valid quantity", "error");
      return;
    }

    if (window.apiCall) {
      const res = await window.apiCall("POST", "/api/kingdom/market/" + op, {
        resource: resource,
        amount: qty,
      });

      if (res.error) {
        if (window.toast) window.toast(res.error, "error");
        return;
      }

      if (window.applyServerUpdates) window.applyServerUpdates(res.updates);
      const successMsg = op === "buy" ? `Bought ${qty} ${resource}` : `Sold ${qty} ${resource}`;
      if (window.toast) window.toast(res.message || successMsg, "success");

      setQuantities(prev => ({ ...prev, [resource]: "" }));

      // Refresh prices
      refreshMarket();
    }
  };

  const setMktMax = (resource, op, priceObj) => {
    let q = 0;
    if (op === "buy") {
      const val = state.resources ? (state.resources.gold || 0) : (state.gold || 0);
      q = priceObj > 0 ? Math.floor(val / priceObj) : 0;
    } else {
      q = ownedAmount(resource);
    }
    setQuantities(prev => ({ ...prev, [resource]: (q > 0 ? q : 0).toString() }));
  };

  const handleQtyChange = (resource, val) => {
    setQuantities(prev => ({ ...prev, [resource]: val }));
  };


  return (
    <div id="market" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div className="card-title">⚖️ Commodity Market</div>
          <button className="base-btn" onClick={refreshMarket}> ↻ Refresh Prices </button>
        </div>
        <div style={{ background: 'rgba(244, 166, 35, 0.1)', border: '1px solid rgba(244, 166, 35, 0.2)', padding: '10px', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>
            ⚖️ Marketplace Trading
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5 }}>
            Buy and sell resources at global prices.
            <strong style={{ color: 'var(--gold)' }}> Price Volatility:</strong>
            {' '}Constant trading shift prices in real-time. <br />
            <strong style={{ color: 'var(--accent1)' }}>Prestige Bonus:</strong>
            {' '}Elite kingdoms get +10% sell value on all commodities.
          </div>
        </div>
      </div>

      <div id="market-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {loading && (
          <div style={{ color: 'var(--text3)', padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}>
            Loading market data...
          </div>
        )}

        {!loading && prices.map(p => (
          <div key={p.id} className="card" style={{ margin: 0, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>{icons[p.id] || "📦"}</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                    {formatLabel(p.id)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                    Owned: <span style={{ color: 'var(--text)' }}>{fmt(ownedAmount(p.id))}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }}>
                  {fmtPrice(p.current_price)} <span style={{ fontSize: '10px' }}>GC</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  Current Price
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div style={{ background: 'rgba(0, 255, 0, 0.05)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--green)' }}>BUY</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                  {fmtPrice(p.current_price)}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 165, 0, 0.05)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--gold)' }}>SELL</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                  {fmtPrice(p.current_price * sellMultiplier)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                className="input"
                value={quantities[p.id] || ""}
                onChange={(e) => handleQtyChange(p.id, e.target.value)}
                style={{ width: '70px', fontSize: '12px' }}
                placeholder="Qty"
                min="1"
              />
              <button
                className="base-btn variant-gold"
                style={{ flex: 1, background: 'var(--gold)', color: '#000' }}
                onClick={() => marketTrade(p.id, 'buy')}
              >
                BUY
              </button>
              <button
                className="base-btn"
                style={{ flex: 1 }}
                onClick={() => marketTrade(p.id, 'sell')}
              >
                SELL
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
              <button
                className="base-btn"
                onClick={() => setMktMax(p.id, 'buy', p.current_price)}
                style={{ flex: 1, fontSize: '9px', padding: '3px', minHeight: 0 }}
              >
                Max Buy
              </button>
              <button
                className="base-btn"
                onClick={() => setMktMax(p.id, 'sell', 0)}
                style={{ flex: 1, fontSize: '9px', padding: '3px', minHeight: 0 }}
              >
                Max Sell
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketPanel;
