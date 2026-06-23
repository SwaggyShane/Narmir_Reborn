export function refreshStatus() {
  return fetch('/api/status')
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      var u = document.getElementById('status-uptime');
      var v = document.getElementById('status-version');
      var n = document.getElementById('status-nodeid');

      if (u) u.textContent = d.uptime;
      if (v) v.textContent = d.version;
      if (n) n.textContent = d.nodeId;
    })
    .catch(function () {});
}

export function setupStatusRefresh() {
  refreshStatus();
  return setInterval(refreshStatus, 60000);
}
