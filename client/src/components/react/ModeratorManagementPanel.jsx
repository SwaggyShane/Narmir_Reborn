import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function ModeratorManagementPanel() {
  const [activeTab, setActiveTab] = useState('moderators'); // 'moderators', 'bans', 'logs'
  const [moderators, setModerators] = useState([]);
  const [bans, setBans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [newModPlayerId, setNewModPlayerId] = useState('');
  const [newModBoardId, setNewModBoardId] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load boards
      const boardsData = await apiCall('/api/forum/boards');
      if (boardsData && !boardsData.error) {
        setBoards(boardsData);
      }

      // Load moderators
      const modsData = await apiCall('/api/forum/admin/moderators');
      if (modsData && !modsData.error) {
        setModerators(modsData);
      }

      // Load bans
      const bansData = await apiCall('/api/forum/admin/bans');
      if (bansData && !bansData.error) {
        setBans(bansData);
      }

      // Load logs
      const logsData = await apiCall('/api/forum/admin/logs');
      if (logsData && !logsData.error) {
        setLogs(logsData);
      }
    } catch (err) {
      console.error('Error loading moderation data:', err);
      setError('Failed to load moderation data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignModerator = async (e) => {
    e.preventDefault();
    if (!newModPlayerId || !newModBoardId) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setSubmitLoading(true);
      const res = await apiCall('/api/forum/admin/moderators', {
        method: 'POST',
        body: {
          playerId: parseInt(newModPlayerId),
          boardId: parseInt(newModBoardId)
        }
      });

      if (res && res.error) {
        setError(res.error);
        return;
      }

      setSuccessMessage('Moderator assigned successfully');
      setNewModPlayerId('');
      setNewModBoardId('');
      loadData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error assigning moderator:', err);
      setError('Failed to assign moderator');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRemoveModerator = async (modId) => {
    if (!confirm('Remove this moderator?')) return;

    try {
      const res = await apiCall(`/api/forum/admin/moderators/${modId}`, {
        method: 'DELETE'
      });

      if (res && res.error) {
        setError(res.error);
        return;
      }

      setSuccessMessage('Moderator removed');
      loadData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error removing moderator:', err);
      setError('Failed to remove moderator');
    }
  };

  const handleUnbanUser = async (banId) => {
    if (!confirm('Unban this user?')) return;

    try {
      const res = await apiCall(`/api/forum/moderation/bans/${banId}`, {
        method: 'DELETE'
      });

      if (res && res.error) {
        setError(res.error);
        return;
      }

      setSuccessMessage('User unbanned');
      loadData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error unbanning user:', err);
      setError('Failed to unban user');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const formatBanType = (type) => {
    const types = {
      forum_ban: 'Forum Ban',
      board_silence: 'Board Silence'
    };
    return types[type] || type;
  };

  if (loading) {
    return <div className="mod-panel">Loading moderation data...</div>;
  }

  return (
    <div className="mod-panel">
      <h2 className="mod-panel-title">Forum Moderation Management</h2>

      {successMessage && <div className="mod-panel-success">{successMessage}</div>}
      {error && <div className="mod-panel-error">{error}</div>}

      <div className="mod-panel-tabs">
        <button
          className={`mod-panel-tab ${activeTab === 'moderators' ? 'active' : ''}`}
          onClick={() => setActiveTab('moderators')}
        >
          Moderators
        </button>
        <button
          className={`mod-panel-tab ${activeTab === 'bans' ? 'active' : ''}`}
          onClick={() => setActiveTab('bans')}
        >
          Bans ({bans.length})
        </button>
        <button
          className={`mod-panel-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Audit Log
        </button>
      </div>

      {activeTab === 'moderators' && (
        <div className="mod-panel-content">
          <div className="mod-panel-section">
            <h3>Assign New Moderator</h3>
            <form onSubmit={handleAssignModerator} className="mod-panel-form">
              <div className="mod-form-group">
                <label>Player ID:</label>
                <input
                  type="number"
                  value={newModPlayerId}
                  onChange={(e) => setNewModPlayerId(e.target.value)}
                  placeholder="Enter player ID"
                  disabled={submitLoading}
                />
              </div>
              <div className="mod-form-group">
                <label>Board:</label>
                <select
                  value={newModBoardId}
                  onChange={(e) => setNewModBoardId(e.target.value)}
                  disabled={submitLoading}
                >
                  <option value="">Select a board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={submitLoading} className="mod-panel-btn-submit">
                {submitLoading ? 'Assigning...' : 'Assign Moderator'}
              </button>
            </form>
          </div>

          <div className="mod-panel-section">
            <h3>Current Moderators</h3>
            {moderators.length === 0 ? (
              <p className="mod-panel-empty">No moderators assigned yet</p>
            ) : (
              <div className="mod-panel-list">
                {moderators.map((mod) => (
                  <div key={mod.id} className="mod-panel-item">
                    <div className="mod-panel-item-info">
                      <div className="mod-panel-item-title">
                        Player {mod.player_id} - {mod.board_name || 'Unknown Board'}
                      </div>
                      <div className="mod-panel-item-meta">
                        Assigned by Player {mod.assigned_by} • {formatTime(mod.created_at)}
                      </div>
                    </div>
                    <button
                      className="mod-panel-btn-remove"
                      onClick={() => handleRemoveModerator(mod.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bans' && (
        <div className="mod-panel-content">
          <div className="mod-panel-section">
            <h3>Active Bans</h3>
            {bans.length === 0 ? (
              <p className="mod-panel-empty">No active bans</p>
            ) : (
              <div className="mod-panel-list">
                {bans.map((ban) => {
                  const isExpired = ban.expires_at && ban.expires_at < Math.floor(Date.now() / 1000);
                  return (
                    <div key={ban.id} className={`mod-panel-item ${isExpired ? 'expired' : ''}`}>
                      <div className="mod-panel-item-info">
                        <div className="mod-panel-item-title">
                          Player {ban.player_id} - {formatBanType(ban.ban_type)}
                          {ban.board_name && ` (${ban.board_name})`}
                        </div>
                        <div className="mod-panel-item-meta">
                          {ban.reason && `Reason: ${ban.reason} • `}
                          Banned by Player {ban.banned_by} • {formatTime(ban.created_at)}
                        </div>
                        {ban.expires_at && (
                          <div className="mod-panel-item-meta">
                            Expires: {formatTime(ban.expires_at)}
                            {isExpired && ' (EXPIRED)'}
                          </div>
                        )}
                      </div>
                      {!isExpired && (
                        <button
                          className="mod-panel-btn-remove"
                          onClick={() => handleUnbanUser(ban.id)}
                        >
                          Unban
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="mod-panel-content">
          <div className="mod-panel-section">
            <h3>Moderation Audit Log</h3>
            {logs.length === 0 ? (
              <p className="mod-panel-empty">No moderation actions logged yet</p>
            ) : (
              <div className="mod-panel-list">
                {logs.map((log) => (
                  <div key={log.id} className="mod-panel-item">
                    <div className="mod-panel-item-info">
                      <div className="mod-panel-item-title">
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </div>
                      <div className="mod-panel-item-meta">
                        Moderator {log.moderator_id} • Target: {log.target_type} #{log.target_id}
                        {log.reason && ` • Reason: ${log.reason}`}
                      </div>
                      <div className="mod-panel-item-meta">
                        {formatTime(log.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button className="mod-panel-btn-refresh" onClick={loadData}>
        Refresh Data
      </button>
    </div>
  );
}
