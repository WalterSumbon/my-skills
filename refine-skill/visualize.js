#!/usr/bin/env node

/**
 * refine-skill 优化历史可视化脚本
 * Usage: node visualize.js [--skill ./path] [--open]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

function loadHistory(skillPath) {
  const historyPath = path.join(skillPath, 'refine_history.json');
  if (!fs.existsSync(historyPath)) {
    console.error(`Error: refine_history.json not found in ${skillPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
}

function generateHTML(history) {
  const rounds = history.rounds;
  const metrics = Object.keys(rounds[0].metrics);
  
  // 生成数据点
  const labels = rounds.map(r => `R${r.round}`);
  const datasets = metrics.map((metric, i) => {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];
    const data = rounds.map(r => r.metrics[metric]);
    const target = history.target_metrics?.[metric];
    return {
      label: metric,
      data,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '20',
      target
    };
  });

  // 计算累计耗时
  const cumulativeTime = rounds.map((r, i) => 
    rounds.slice(0, i + 1).reduce((sum, rr) => sum + rr.elapsed_ms, 0) / 60000
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${history.skill_name} - Refine History</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-value { font-size: 32px; font-weight: bold; color: #4CAF50; }
    .stat-label { color: #666; margin-top: 8px; }
    .chart-container { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .round-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
    .round-table th, .round-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    .round-table th { background: #f8f9fa; font-weight: 600; }
    .commit { font-family: monospace; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 ${history.skill_name} 优化历史</h1>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${rounds.length}</div>
        <div class="stat-label">优化轮次</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(history.total_time_ms / 60000).toFixed(1)}m</div>
        <div class="stat-label">总耗时</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${history.status === 'completed' ? '✅' : '🔄'}</div>
        <div class="stat-label">状态: ${history.status}</div>
      </div>
    </div>

    <div class="chart-container">
      <canvas id="metricsChart"></canvas>
    </div>

    <div class="chart-container">
      <canvas id="timeChart"></canvas>
    </div>

    <h2>📋 详细记录</h2>
    <table class="round-table">
      <thead>
        <tr>
          <th>轮次</th>
          <th>耗时</th>
          <th>指标</th>
          <th>变更说明</th>
          <th>Commit</th>
        </tr>
      </thead>
      <tbody>
        ${rounds.map(r => `
          <tr>
            <td>R${r.round}</td>
            <td>${(r.elapsed_ms / 60000).toFixed(1)}m</td>
            <td>${JSON.stringify(r.metrics)}</td>
            <td>${r.change}</td>
            <td class="commit">${r.commit}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <script>
    // 指标趋势图
    new Chart(document.getElementById('metricsChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: ${JSON.stringify(datasets.map(d => ({
          label: d.label,
          data: d.data,
          borderColor: d.borderColor,
          backgroundColor: d.backgroundColor,
          tension: 0.3
        })))}
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: '指标优化趋势' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // 累计耗时图
    new Chart(document.getElementById('timeChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: '累计耗时 (分钟)',
          data: ${JSON.stringify(cumulativeTime)},
          backgroundColor: '#2196F3'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: '优化耗时分布' }
        }
      }
    });
  </script>
</body>
</html>`;
}

function serveHTML(html, port = 8080) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  
  server.listen(port, () => {
    console.log(`🚀 Visualization server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop');
  });
}

// Main
const args = process.argv.slice(2);

// Help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
refine visualize - 优化历史可视化工具

Usage: node visualize.js [options]

Options:
  --target <path>   目标路径 (默认: .)
  --port <n>        HTTP 端口 (默认: 8080)
  --open            启动 HTTP 服务器并打开浏览器
  --help            显示帮助

Examples:
  node visualize.js --target ./my-skill --open
  node visualize.js --target ./my-project --port 3000
`);
  process.exit(0);
}
const skillIndex = args.indexOf('--skill');
const skillPath = skillIndex >= 0 ? args[skillIndex + 1] : '.';
const shouldOpen = args.includes('--open');

try {
  const history = loadHistory(skillPath);
  const html = generateHTML(history);
  
  // 保存 HTML 文件
  const outputPath = path.join(skillPath, 'refine_history.html');
  fs.writeFileSync(outputPath, html);
  console.log(`📊 Generated: ${outputPath}`);
  
  // 启动服务器或打印文件路径
  if (shouldOpen) {
    serveHTML(html);
  } else {
    console.log(`Run with --open to view in browser`);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
