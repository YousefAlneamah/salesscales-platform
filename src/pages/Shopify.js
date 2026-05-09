import React from "react";

export default function Shopify() {
  const stores = [
    { name: "Luux Bags", url: "luuxbags.com", customers: "4,200", orders: "234", sync: "2 min ago" },
    { name: "Flex Studio", url: "flexstudio.com", customers: "8,100", orders: "412", sync: "5 min ago" },
    { name: "Nova Store", url: "novastore.com", customers: "6,100", orders: "201", sync: "1 min ago" },
  ];
  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">CONNECTED STORES</div><div className="stat-value">3</div><div className="stat-sub">all syncing live</div></div>
        <div className="stat-card"><div className="stat-label">TOTAL CUSTOMERS</div><div className="stat-value">18,400</div><div className="stat-sub">across all stores</div></div>
        <div className="stat-card"><div className="stat-label">ORDERS THIS MONTH</div><div className="stat-value">847</div><div className="stat-sub">23% vs last month</div></div>
        <div className="stat-card"><div className="stat-label">RECOVERED REVENUE</div><div className="stat-value">$12,400</div><div className="stat-sub">cart recovery</div></div>
      </div>
      <div className="section-label">CONNECTED STORES</div>
      {stores.map((store, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px"}}>
          <div>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{store.name} — {store.url}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>{store.customers} customers • {store.orders} orders this month • Last sync: {store.sync}</div>
          </div>
          <div className="badge-green">Connected</div>
        </div>
      ))}
      <button className="btn btn-green" style={{marginTop:"8px"}}>+ Connect New Store</button>
    </div>
  );
}
