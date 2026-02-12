import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
  ChartDataLabels
);

const colorMap = {
  持續列管: '#ef4444',
  解除列管: '#10b981',
  自行列管: '#f59e0b',
};

export default function DashboardCharts({ globalStats }) {
  if (!globalStats) return null;
  const { status = [], unit = [], year = [] } = globalStats;

  const sLabels = status.filter((x) => x.status && x.status !== 'Open').map((x) => x.status);
  const sData = status.filter((x) => x.status && x.status !== 'Open').map((x) => parseInt(x.count, 10));
  const sColors = sLabels.map((l) => colorMap[l] || '#cbd5e1');

  const statusChartData = {
    labels: sLabels,
    datasets: [{ data: sData, backgroundColor: sColors }],
  };

  const uSorted = [...unit].sort((a, b) => parseInt(b.count, 10) - parseInt(a.count, 10));
  const unitChartData = {
    labels: uSorted.map((x) => x.unit),
    datasets: [
      {
        label: '案件',
        data: uSorted.map((x) => parseInt(x.count, 10)),
        backgroundColor: '#667eea',
        borderRadius: 8,
      },
    ],
  };

  const tSorted = [...year].sort((a, b) => (a.year || '').localeCompare(b.year || ''));
  const trendChartData = {
    labels: tSorted.map((x) => x.year),
    datasets: [
      {
        label: '開立事項數',
        data: tSorted.map((x) => parseInt(x.count, 10)),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        display: false,
      },
    },
  };

  const doughnutOptions = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 12 } } },
      datalabels: {
        formatter: (v, ctx) => {
          const dataArr = ctx.chart.data.datasets[0]?.data || [];
          if (!dataArr.length) return '';
          const t = dataArr.reduce((a, b) => a + b, 0);
          return t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '0%';
        },
        color: '#64748b',
        font: { weight: '600', size: 12 },
      },
    },
  };

  const barOptions = {
    ...commonOptions,
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } },
      y: { ticks: { color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } },
    },
  };

  const lineOptions = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      title: { display: true, text: '年度開立事項趨勢', color: '#64748b', font: { size: 14, weight: '600' } },
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: '#64748b', font: { size: 12 } },
        grid: { color: '#e2e8f0' },
      },
    },
    animation: { duration: 0 },
  };

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <div style={{ height: 220 }}>
          <Doughnut data={statusChartData} options={doughnutOptions} />
        </div>
      </div>
      <div className="chart-card">
        <div style={{ height: 250, width: '100%' }}>
          <Bar data={unitChartData} options={barOptions} />
        </div>
      </div>
      <div className="chart-card">
        <div style={{ height: 250, width: '100%' }}>
          <Line data={trendChartData} options={lineOptions} />
        </div>
      </div>
    </div>
  );
}
