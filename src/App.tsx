import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const severityOrder: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
const severityColors: Record<Severity, string> = {
  Critical: '#ff4d4f',
  High: '#ff7a45',
  Medium: '#ffd666',
  Low: '#73d13d'
};

const App: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [aiAssessment, setAiAssessment] = useState<AiAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'hardware' | 'storage' | 'recommendations'>('overview');
  const [scanProgress, setScanProgress] = useState(0);
  const [lastLoggedProgress, setLastLoggedProgress] = useState(0);

  const runScan = async () => {
    setLoading(true);
    setScanProgress(0);
    setLastLoggedProgress(0);
    window.systemApi.writeLog('Scan started: full system scan.');

    const startedAt = Date.now();
    const targetDurationMs = 60000;
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const percent = Math.min(95, Math.round((elapsed / targetDurationMs) * 100));
      setScanProgress(percent);
    }, 200);

    const [snap, list] = await Promise.all([
      window.systemApi.getSnapshot(),
      window.systemApi.getIssues()
    ]);
    setSnapshot(snap);
    setIssues(list);

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, targetDurationMs - elapsed);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    clearInterval(progressTimer);
    setScanProgress(100);
    setLoading(false);
    setTimeout(() => setScanProgress(0), 600);
    window.systemApi.writeLog('Scan completed successfully.');
  };

  const runAi = async () => {
    setIsAiRunning(true);
    const assessment = await window.systemApi.getAiAssessment();
    setAiAssessment(assessment);
    setIsAiRunning(false);
  };

  useEffect(() => {
    runScan();
  }, []);

  useEffect(() => {
    const unsubscribe = window.systemApi.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading || scanProgress === 0) return;
    if (scanProgress - lastLoggedProgress >= 10) {
      setLastLoggedProgress(scanProgress);
      window.systemApi.writeLog(`Scan progress: ${scanProgress}%`);
    }
  }, [loading, scanProgress, lastLoggedProgress]);

  const startDownload = async () => {
    setIsDownloading(true);
    setDownloadStatus('Downloading model…');
    const result = await window.systemApi.downloadModel();
    setDownloadStatus(result.message);
    setIsDownloading(false);
  };

  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
  }, [issues]);

  const severityCounts = useMemo(() => {
    return sortedIssues.reduce<Record<Severity, number>>(
      (acc, issue) => {
        acc[issue.severity] += 1;
        return acc;
      },
      {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
      }
    );
  }, [sortedIssues]);

  const healthScore = useMemo(() => {
    if (!snapshot) return 0;
    const penalty = sortedIssues.reduce((acc, issue) => {
      switch (issue.severity) {
        case 'Critical':
          return acc + 25;
        case 'High':
          return acc + 15;
        case 'Medium':
          return acc + 8;
        default:
          return acc + 2;
      }
    }, 0);
    return Math.max(0, Math.min(100, 100 - penalty));
  }, [snapshot, sortedIssues]);

  const pieData = snapshot
    ? [
        { name: 'Used', value: snapshot.memoryUsedPercent },
        { name: 'Free', value: 100 - snapshot.memoryUsedPercent }
      ]
    : [];

  const diskData = snapshot
    ? snapshot.disks.map((disk) => ({
        name: disk.mount,
        used: disk.usedPercent
      }))
    : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">T</div>
          <div>
            <div className="brand-title">Tweak Diagnostics</div>
            <div className="brand-subtitle">System intelligence</div>
          </div>
        </div>
        <nav className="nav">
          <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} onClick={() => setActiveView('overview')}>
            Overview
          </button>
          <button className={`nav-item ${activeView === 'hardware' ? 'active' : ''}`} onClick={() => setActiveView('hardware')}>
            Hardware
          </button>
          <button className={`nav-item ${activeView === 'storage' ? 'active' : ''}`} onClick={() => setActiveView('storage')}>
            Storage
          </button>
          <button className={`nav-item ${activeView === 'recommendations' ? 'active' : ''}`} onClick={() => setActiveView('recommendations')}>
            Recommendations
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="status-pill">Live Scan</div>
          <div className="status-label">Updated just now</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>System Health</h1>
            <p className="muted">Comprehensive diagnostics and actionable fixes.</p>
          </div>
          <div className="topbar-actions">
            <div className="scan-pill">AI-ready scan</div>
            <button className="primary" onClick={runScan} disabled={loading}>
              {loading ? 'Scanning…' : 'Run Deep Scan'}
            </button>
            <button className="ghost" onClick={() => window.systemApi.openLogWindow()}>
              Open Log Window
            </button>
          </div>
          {loading ? (
            <div className="scan-progress">
              <div className="scan-progress-bar">
                <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
              </div>
              <div className="scan-progress-label">Scanning system… {scanProgress}%</div>
            </div>
          ) : null}
        </header>

        {activeView === 'overview' ? (
        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Health Score</div>
            <div className="summary-value">{loading ? '—' : `${healthScore}/100`}</div>
            <div className="summary-sub">Balanced for stability and performance</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Priority Issues</div>
            <div className="summary-value">{loading ? '—' : sortedIssues.length}</div>
            <div className="summary-sub">Critical at the top</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">OS</div>
            <div className="summary-value">{snapshot?.os ?? '—'}</div>
            <div className="summary-sub">Uptime {snapshot ? `${snapshot.uptimeHours}h` : '—'}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">CPU</div>
            <div className="summary-value">{snapshot?.cpuModel ?? '—'}</div>
            <div className="summary-sub">Load {snapshot ? `${snapshot.cpuLoad}%` : '—'}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Memory</div>
            <div className="summary-value">{snapshot ? `${snapshot.memoryTotalGb} GB` : '—'}</div>
            <div className="summary-sub">Used {snapshot ? `${snapshot.memoryUsedPercent}%` : '—'}</div>
          </div>
        </section>
        ) : null}

        {activeView === 'overview' ? (
        <section className="content-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Priority Issues</h2>
              <span className="muted">Sorted by criticality</span>
            </div>
            <div className="severity-summary">
              {severityOrder.map((severity) => (
                <div key={severity} className="severity-chip">
                  <span className="severity-dot" style={{ backgroundColor: severityColors[severity] }} />
                  <span>{severity}</span>
                  <strong>{loading ? '—' : severityCounts[severity]}</strong>
                </div>
              ))}
            </div>
            <div className="issue-list">
              {sortedIssues.map((issue) => (
                <div key={issue.id} className="issue-item">
                  <div className="issue-severity" style={{ backgroundColor: severityColors[issue.severity] }} />
                  <div className="issue-content">
                    <div className="issue-title">
                      <span>{issue.title}</span>
                      <span className="severity-pill" style={{ color: severityColors[issue.severity] }}>
                        {issue.severity}
                      </span>
                    </div>
                    <div className="issue-desc">{issue.description}</div>
                    <div className="issue-reco">Fix: {issue.recommendation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Memory Pressure</h2>
              <span className="muted">Live allocation view</span>
            </div>
            <div className="chart-area">
              {snapshot ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={4}>
                      <Cell fill="#5b8cfe" />
                      <Cell fill="#1f2738" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="muted">Loading chart…</div>
              )}
            </div>
            <div className="chart-caption">Used vs free memory</div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Disk Utilization</h2>
              <span className="muted">Usage by volume</span>
            </div>
            <div className="chart-area">
              {snapshot ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={diskData} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip />
                    <Bar dataKey="used" fill="#73d13d" radius={[6, 6, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="muted">Loading chart…</div>
              )}
            </div>
            <div className="chart-caption">Disk space used (%)</div>
          </div>

          <div className="panel ai-panel">
            <div className="panel-header">
              <h2>Local AI Assessment</h2>
              <span className={`ai-status ${aiAssessment?.available ? 'ok' : 'warn'}`}>
                {aiAssessment?.status ?? 'Loading'}
              </span>
            </div>
            <div className="ai-summary">
              {aiAssessment?.summary ?? 'Preparing local analysis…'}
            </div>
            <div className="ai-details">
              {aiAssessment?.details ?? 'Waiting for AI response.'}
            </div>
            {!aiAssessment?.available && aiAssessment?.modelPath && aiAssessment?.binaryPath ? (
              <div className="ai-paths">
                <div>Model: {aiAssessment.modelPath}</div>
                <div>Engine: {aiAssessment.binaryPath}</div>
              </div>
            ) : null}
            <div className="ai-actions">
              <button className="ai-button" onClick={runAi} disabled={isAiRunning || loading}>
                {isAiRunning ? 'Running AI…' : 'Run AI Assessment'}
              </button>
            </div>
            {aiAssessment?.status === 'Local AI not configured' ? (
              <div className="ai-download">
                <button className="ai-button" onClick={startDownload} disabled={isDownloading}>
                  {isDownloading ? 'Downloading…' : 'Download Model'}
                </button>
                {downloadProgress ? (
                  <div className="ai-progress">
                    <div className="ai-progress-bar" style={{ width: `${downloadProgress.percent}%` }} />
                    <span>{downloadProgress.percent}%</span>
                  </div>
                ) : null}
                {downloadStatus ? <div className="ai-status-text">{downloadStatus}</div> : null}
              </div>
            ) : null}
            <div className="ai-footnote">
              Data handling: all data stays on-device. No network calls or uploads.
            </div>
          </div>
        </section>
        ) : null}

        {activeView === 'hardware' ? (
          <section className="content-grid single">
            <div className="panel">
              <div className="panel-header">
                <h2>Hardware Overview</h2>
                <span className="muted">CPU, memory, and performance</span>
              </div>
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="summary-label">CPU Model</div>
                  <div className="summary-value">{snapshot?.cpuModel ?? '—'}</div>
                  <div className="summary-sub">Load {snapshot ? `${snapshot.cpuLoad}%` : '—'}</div>
                </div>
                <div className="detail-card">
                  <div className="summary-label">Memory</div>
                  <div className="summary-value">{snapshot ? `${snapshot.memoryTotalGb} GB` : '—'}</div>
                  <div className="summary-sub">Used {snapshot ? `${snapshot.memoryUsedPercent}%` : '—'}</div>
                </div>
                <div className="detail-card">
                  <div className="summary-label">OS</div>
                  <div className="summary-value">{snapshot?.os ?? '—'}</div>
                  <div className="summary-sub">Uptime {snapshot ? `${snapshot.uptimeHours}h` : '—'}</div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeView === 'storage' ? (
          <section className="content-grid single">
            <div className="panel">
              <div className="panel-header">
                <h2>Storage</h2>
                <span className="muted">Volume usage details</span>
              </div>
              <div className="detail-grid">
                {(snapshot?.disks ?? []).map((disk) => (
                  <div key={disk.mount} className="detail-card">
                    <div className="summary-label">{disk.mount}</div>
                    <div className="summary-value">{disk.usedPercent}% used</div>
                    <div className="summary-sub">{disk.used} / {disk.size} GB</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === 'recommendations' ? (
          <section className="content-grid single">
            <div className="panel">
              <div className="panel-header">
                <h2>Recommendations</h2>
                <span className="muted">Actions based on detected issues</span>
              </div>
              <div className="issue-list">
                {sortedIssues.map((issue) => (
                  <div key={issue.id} className="issue-item">
                    <div className="issue-severity" style={{ backgroundColor: severityColors[issue.severity] }} />
                    <div className="issue-content">
                      <div className="issue-title">
                        <span>{issue.title}</span>
                        <span className="severity-pill" style={{ color: severityColors[issue.severity] }}>
                          {issue.severity}
                        </span>
                      </div>
                      <div className="issue-desc">{issue.description}</div>
                      <div className="issue-reco">Fix: {issue.recommendation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default App;

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface Issue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
}

interface DiskSnapshot {
  mount: string;
  size: number;
  used: number;
  usedPercent: number;
}

interface SystemSnapshot {
  os: string;
  cpuModel: string;
  memoryTotalGb: number;
  memoryUsedPercent: number;
  cpuLoad: number;
  disks: DiskSnapshot[];
  uptimeHours: number;
}

interface AiAssessment {
  available: boolean;
  status: string;
  summary: string;
  details: string;
  modelPath?: string;
  binaryPath?: string;
}

interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}
