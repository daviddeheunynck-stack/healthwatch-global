"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

interface ReportData {
  region: string;
  regionLabel: string;
  date: string;
  activeOutbreaks: number;
  totalCases: number;
  highRisk: number;
  diseases: Array<{ name: string; country: string; cases: number; deaths: number; risk: string }>;
}

interface Props {
  data: ReportData;
  label: string;
}

const RISK_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export default function ReportDownloadButton({ data, label }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = () => {
    setLoading(true);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>HealthWatch Global — ${data.regionLabel} Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; background: #fff; padding: 40px; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-dot { width: 12px; height: 12px; background: #dc2626; border-radius: 50%; }
    .brand-name { font-size: 18px; font-weight: 800; color: #111; letter-spacing: -0.3px; }
    .report-meta { text-align: right; }
    .report-meta .region { font-size: 22px; font-weight: 700; color: #111; }
    .report-meta .date { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .stats { display: flex; gap: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 28px; }
    .stat { flex: 1; padding: 16px 20px; border-right: 1px solid #e5e7eb; }
    .stat:last-child { border-right: none; }
    .stat-value { font-size: 28px; font-weight: 800; color: #111; }
    .stat-value.red { color: #dc2626; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
    h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    tr:last-child td { border-bottom: none; }
    .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
    .risk-high { background: #fef2f2; color: #dc2626; }
    .risk-medium { background: #fffbeb; color: #d97706; }
    .risk-low { background: #f0fdf4; color: #16a34a; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print {
      body { padding: 20px; }
      @page { margin: 1.5cm; size: A4; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-dot"></div>
      <span class="brand-name">HealthWatch Global</span>
    </div>
    <div class="report-meta">
      <div class="region">${data.regionLabel}</div>
      <div class="date">Epidemiological Report · ${data.date}</div>
    </div>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${data.activeOutbreaks}</div>
      <div class="stat-label">Active outbreaks</div>
    </div>
    <div class="stat">
      <div class="stat-value">${data.totalCases.toLocaleString()}</div>
      <div class="stat-label">Total reported cases</div>
    </div>
    <div class="stat">
      <div class="stat-value red">${data.highRisk}</div>
      <div class="stat-label">High risk alerts</div>
    </div>
  </div>

  ${data.diseases.length > 0 ? `
  <h2>Outbreak Detail</h2>
  <table>
    <thead>
      <tr>
        <th>Disease</th>
        <th>Country</th>
        <th>Cases</th>
        <th>Deaths</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody>
      ${data.diseases.map((d) => `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.country}</td>
        <td>${d.cases.toLocaleString()}</td>
        <td>${d.deaths.toLocaleString()}</td>
        <td><span class="risk-badge risk-${d.risk}">${d.risk}</span></td>
      </tr>`).join("")}
    </tbody>
  </table>` : "<p style='color:#9ca3af;font-size:13px'>No active outbreaks reported for this region.</p>"}

  <footer>
    <span>Source: WHO · CDC · ECDC · ProMED — healthwatch-global.com</span>
    <span>Generated ${data.date}</span>
  </footer>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.focus();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      setLoading(false);
    }, 2000);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );
}
