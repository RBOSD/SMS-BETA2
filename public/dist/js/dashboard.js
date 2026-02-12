/**
 * 統計圖表：updateChartsData、initCharts
 * 依賴：core.js (charts, cachedGlobalStats), Chart.js (CDN)
 */
(function () {
    'use strict';

    function updateChartsData(stats) {
        var charts = window.charts;
        if (!charts || !charts.status || !charts.unit || !charts.trend) return;
        if (!stats) return;
        var colorMap = {
            '持續列管': '#ef4444',
            '解除列管': '#10b981',
            '自行列管': '#f59e0b'
        };
        var sLabels = stats.status.map(function (x) { return x.status; }).filter(function (s) { return s && s !== 'Open'; });
        var sData = stats.status.filter(function (x) { return x.status && x.status !== 'Open'; }).map(function (x) { return parseInt(x.count, 10); });
        var sColors = sLabels.map(function (label) { return colorMap[label] || '#cbd5e1'; });
        charts.status.data = { labels: sLabels, datasets: [{ data: sData, backgroundColor: sColors }] };
        charts.status.update();
        var uSorted = stats.unit.sort(function (a, b) { return parseInt(b.count, 10) - parseInt(a.count, 10); });
        charts.unit.data = {
            labels: uSorted.map(function (x) { return x.unit; }),
            datasets: [{
                label: '案件',
                data: uSorted.map(function (x) { return parseInt(x.count, 10); }),
                backgroundColor: '#667eea',
                borderRadius: 8
            }]
        };
        if (charts.unit.options && charts.unit.options.scales) {
            charts.unit.options.scales.x.ticks.color = '#64748b';
            charts.unit.options.scales.y.ticks.color = '#64748b';
            charts.unit.options.scales.x.grid.color = '#e2e8f0';
            charts.unit.options.scales.y.grid.color = '#e2e8f0';
        }
        charts.unit.update();
        var tSorted = stats.year.sort(function (a, b) { return a.year.localeCompare(b.year); });
        if (charts.trend && charts.trend.data) {
            charts.trend.data.labels = [];
            charts.trend.data.datasets = [];
        }
        charts.trend.data = {
            labels: tSorted.map(function (x) { return x.year; }),
            datasets: [{
                label: '開立事項數',
                data: tSorted.map(function (x) { return parseInt(x.count, 10); }),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2
            }]
        };
        if (charts.trend.options && charts.trend.options.scales) {
            charts.trend.options.scales.x.ticks.color = '#64748b';
            charts.trend.options.scales.y.ticks.color = '#64748b';
            charts.trend.options.scales.x.grid.color = '#e2e8f0';
            charts.trend.options.scales.y.grid.color = '#e2e8f0';
        }
        if (charts.trend.options && charts.trend.options.plugins && charts.trend.options.plugins.title) {
            charts.trend.options.plugins.title.color = '#64748b';
        }
        if (charts.trend && charts.trend.canvas) {
            var ctx = charts.trend.canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, charts.trend.canvas.width, charts.trend.canvas.height);
            }
        }
        charts.trend.update('none');
        if (charts.trend && charts.trend.canvas) {
            setTimeout(function () {
                charts.trend.resize();
                charts.trend.draw();
            }, 50);
        }
    }
    window.updateChartsData = updateChartsData;

    function initCharts() {
        try {
            var Chart = window.Chart;
            var ChartDataLabels = window.ChartDataLabels;
            var charts = window.charts;
            if (!Chart || !charts) return;
            var c1 = document.getElementById('statusChart');
            var c2 = document.getElementById('unitChart');
            var c3 = document.getElementById('trendChart');
            if (c1) {
                charts.status = new Chart(c1, {
                    type: 'doughnut',
                    plugins: ChartDataLabels ? [ChartDataLabels] : [],
                    data: { labels: [], datasets: [] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 12 } } },
                            datalabels: {
                                formatter: function (v, ctx) {
                                    var dataArr = ctx.chart.data.datasets[0].data;
                                    if (!dataArr || dataArr.length === 0) return '';
                                    var t = dataArr.reduce(function (a, b) { return a + b; }, 0);
                                    return t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '0%';
                                },
                                color: '#64748b',
                                font: { weight: '600', size: 12 }
                            }
                        }
                    }
                });
            }
            if (c2) {
                charts.unit = new Chart(c2, {
                    type: 'bar',
                    data: { labels: [], datasets: [] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } },
                            y: { ticks: { color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } }
                        }
                    }
                });
            }
            if (c3) {
                charts.trend = new Chart(c3, {
                    type: 'line',
                    data: { labels: [], datasets: [] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 0 },
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: '年度開立事項趨勢', color: '#64748b', font: { size: 14, weight: '600' } }
                        },
                        scales: {
                            x: { ticks: { color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } },
                            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#64748b', font: { size: 12 } }, grid: { color: '#e2e8f0' } }
                        },
                        elements: { point: { radius: 0 }, line: { borderWidth: 2 } }
                    }
                });
            }
            if (window.cachedGlobalStats && typeof window.updateChartsData === 'function') {
                window.updateChartsData(window.cachedGlobalStats);
            }
        } catch (e) {
            console.error('Chart Init Error:', e);
        }
    }
    window.initCharts = initCharts;
})();
