#!/usr/bin/env node

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const HISTORY_FILE = 'optimization_history.json';
const DEFAULT_PORT = 8080;
const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#9333ea',
  '#dc2626',
  '#0891b2',
];

/**
 * Escapes text for safe insertion into HTML.
 * @param {*} value Value to render.
 * @return {string} HTML-safe string.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serializes data for embedding inside an inline script.
 * @param {*} value JSON-serializable value.
 * @return {string} Script-safe JSON string.
 */
function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Reads and parses optimization history from a target directory.
 * @param {string} targetPath Directory containing optimization_history.json.
 * @return {Object} Parsed history object.
 */
function loadHistory(targetPath) {
  const historyPath = path.join(targetPath, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) {
    throw new Error(`${HISTORY_FILE} not found in ${targetPath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse ${historyPath}: ${error.message}`);
  }
}

/**
 * Finds numeric metrics from a round record.
 * @param {Object} round Round record from optimization_history.json.
 * @return {Object<string, number>} Flat numeric metrics.
 */
function getRoundMetrics(round) {
  if (round && isPlainObject(round.metrics)) {
    return numericEntries(round.metrics);
  }

  if (round && isPlainObject(round.evaluation)) {
    return flattenNumericValues(round.evaluation);
  }

  return {};
}

/**
 * Builds a normalized render model from raw history.
 * @param {Object} history Parsed optimization history.
 * @return {Object} Normalized history model.
 */
function normalizeHistory(history) {
  if (!isPlainObject(history)) {
    throw new Error('History must be a JSON object.');
  }

  const rawRounds = history.rounds;
  if (!Array.isArray(rawRounds)) {
    throw new Error('History field "rounds" must be an array.');
  }

  const rounds = rawRounds.map((round, index) => ({
    round: round.round ?? index + 1,
    timestamp: round.timestamp ?? '',
    elapsedMs: readNumber(round.elapsed_ms, 0),
    change: round.change ?? '',
    decision: round.decision ?? round.status ?? '',
    commit: round.git_commit ?? round.commit ?? '',
    notes: round.notes ?? round.note ?? '',
    metrics: getRoundMetrics(round),
    explicitBreakthrough: round.breakthrough === true,
  }));

  return {
    targetName: history.target_name ?? history.skill_name ?? 'Optimization Target',
    targetType: history.target_type ?? '',
    description: history.description ?? '',
    status: history.status ?? 'unknown',
    bestRound: history.best_round ?? null,
    totalTimeMs: readNumber(
      history.total_time_ms,
      rounds.reduce((sum, round) => sum + round.elapsedMs, 0),
    ),
    keyLearnings: Array.isArray(history.key_learnings)
      ? history.key_learnings
      : [],
    targetMetrics: isPlainObject(history.target_metrics)
      ? numericEntries(history.target_metrics)
      : {},
    finalMetrics: isPlainObject(history.final_metrics)
      ? numericEntries(history.final_metrics)
      : {},
    metricDirections: normalizeMetricDirections(history.metric_directions),
    rounds,
  };
}

/**
 * Generates an optimization history HTML page.
 * @param {Object} history Parsed optimization history.
 * @return {string} Complete HTML document.
 */
function generateHTML(history) {
  const model = normalizeHistory(history);
  const labels = model.rounds.map((round) => `R${round.round}`);
  const metricNames = collectMetricNames(model.rounds, model.targetMetrics);
  const breakthroughMap = detectBreakthroughs(model, metricNames);
  const roundsWithBreakthroughs = model.rounds.map((round) => ({
    ...round,
    breakthroughs: breakthroughMap.get(round.round) ?? [],
  }));
  const metricSeries = buildMetricSeries(
    roundsWithBreakthroughs,
    metricNames,
    model.targetMetrics,
  );
  const cumulativeTime = cumulativeMinutes(model.rounds);
  const totalMinutes = model.totalTimeMs / 60000;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.targetName)} - Optimization History</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #172033;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 48px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.2; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    .subtitle { margin: 0; color: var(--muted); }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    .stat-card, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .stat-card { padding: 16px; }
    .stat-value { font-size: 28px; font-weight: 700; color: var(--accent); }
    .stat-label { margin-top: 4px; color: var(--muted); font-size: 13px; }
    .panel { margin: 16px 0; padding: 18px; }
    .panel > h2:first-child { margin-top: 0; }
    .chart { min-height: 320px; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 14px;
    }
    .metric-card {
      min-height: 260px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
    }
    .metric-card canvas { width: 100%; height: 220px; }
    .chart-note {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 13px;
    }
    .empty {
      padding: 32px;
      text-align: center;
      color: var(--muted);
    }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 960px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; white-space: nowrap; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #475569; }
    .metric-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .metric-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #334155;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      white-space: nowrap;
    }
    .breakthrough-row { background: #fff7ed; }
    .breakthrough-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 9px;
      border-radius: 999px;
      background: #f97316;
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .breakthrough-detail {
      margin-top: 6px;
      color: #9a3412;
      font-size: 12px;
      line-height: 1.35;
    }
    ul { margin: 8px 0 0 20px; padding: 0; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(model.targetName)} Optimization History</h1>
      <p class="subtitle">${escapeHtml(compactSubtitle(model))}</p>
    </header>

    <section class="stats" aria-label="Summary">
      ${statCard(model.rounds.length, 'Rounds')}
      ${statCard(`${totalMinutes.toFixed(1)}m`, 'Total time')}
      ${statCard(model.status, 'Status')}
      ${statCard(formatBestRound(model.bestRound), 'Best round')}
    </section>

    ${model.rounds.length === 0 ? emptyState() : chartsSection(metricSeries, labels, cumulativeTime)}
    ${renderLearnings(model.keyLearnings)}
    ${renderRounds(roundsWithBreakthroughs)}
  </main>
</body>
</html>`;
}

/**
 * Starts an HTTP server for the generated HTML.
 * @param {string} html HTML document to serve.
 * @param {number} port Port number.
 * @return {http.Server} Started server.
 */
function serveHTML(html, port = DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Visualization server running at ${url}`);
    console.log('Press Ctrl+C to stop');
  });

  return server;
}

/**
 * Opens a URL in the system browser.
 * @param {string} url URL to open.
 */
function openBrowser(url) {
  const commandByPlatform = {
    darwin: 'open',
    linux: 'xdg-open',
    win32: 'cmd',
  };
  const command = commandByPlatform[process.platform];
  if (!command) {
    throw new Error(`Opening a browser is not supported on ${process.platform}`);
  }

  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = childProcess.spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

/**
 * Parses CLI arguments.
 * @param {string[]} argv Arguments without node and script path.
 * @return {Object} Parsed options.
 */
function parseArgs(argv) {
  const options = {
    targetPath: '.',
    outputPath: null,
    port: DEFAULT_PORT,
    open: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--target':
      case '--skill':
        options.targetPath = readOptionValue(argv, index, arg);
        index += 1;
        break;
      case '--output':
        options.outputPath = readOptionValue(argv, index, arg);
        index += 1;
        break;
      case '--port':
        options.port = parsePort(readOptionValue(argv, index, arg));
        index += 1;
        break;
      case '--open':
        options.open = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

/**
 * Runs the command-line interface.
 * @param {string[]} argv Arguments without node and script path.
 * @return {number} Exit code.
 */
function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      printHelp();
      return 0;
    }

    const history = loadHistory(options.targetPath);
    const html = generateHTML(history);
    const outputPath = options.outputPath
      ? path.resolve(options.outputPath)
      : path.join(options.targetPath, 'optimization_history.html');

    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`Generated: ${outputPath}`);

    if (options.open) {
      const server = serveHTML(html, options.port);
      openBrowser(`http://localhost:${options.port}`);
      process.on('SIGINT', () => {
        server.close(() => process.exit(0));
      });
    } else {
      console.log('Run with --open to view in browser.');
    }

    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return 1;
  }
}

/**
 * Prints CLI help text.
 */
function printHelp() {
  console.log(`
auto-optimize visualize - render optimization_history.json as HTML

Usage:
  node visualize.js [options]

Options:
  --target <path>   Directory containing optimization_history.json (default: .)
  --skill <path>    Alias for --target
  --output <path>   Output HTML path (default: <target>/optimization_history.html)
  --port <n>        HTTP port when using --open (default: ${DEFAULT_PORT})
  --open            Start a local HTTP server and open the browser
  --help            Show help

Examples:
  node visualize.js --target ./my-project
  node visualize.js --target ./my-project --output ./history.html
  node visualize.js --skill ./my-skill --open --port 3000
`);
}

/**
 * Reads the value after an option.
 * @param {string[]} argv Full argument list.
 * @param {number} index Current option index.
 * @param {string} option Option name.
 * @return {string} Option value.
 */
function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

/**
 * Parses and validates a TCP port.
 * @param {string} value Raw port value.
 * @return {number} Port number.
 */
function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

/**
 * Checks for a non-array object.
 * @param {*} value Value to check.
 * @return {boolean} Whether value is a plain object.
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reads a finite number with a fallback.
 * @param {*} value Candidate number.
 * @param {number} fallback Fallback number.
 * @return {number} Finite number.
 */
function readNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Returns only finite numeric entries from an object.
 * @param {Object} object Source object.
 * @return {Object<string, number>} Numeric entries.
 */
function numericEntries(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => Number.isFinite(value)),
  );
}

/**
 * Normalizes per-metric optimization directions.
 * @param {*} value Raw metric_directions value.
 * @return {Object<string, string>} Metric directions keyed by metric name.
 */
function normalizeMetricDirections(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, direction]) => direction === 'max' || direction === 'min')
      .map(([metric, direction]) => [metric, direction]),
  );
}

/**
 * Flattens finite numeric leaves from a nested object.
 * @param {*} value Source value.
 * @param {string} prefix Key prefix.
 * @return {Object<string, number>} Flat numeric values.
 */
function flattenNumericValues(value, prefix = '') {
  if (Number.isFinite(value)) {
    return {[prefix || 'value']: value};
  }

  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce((result, [key, child]) => {
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    return {...result, ...flattenNumericValues(child, childPrefix)};
  }, {});
}

/**
 * Collects metric names in first-seen order.
 * @param {Object[]} rounds Normalized round records.
 * @param {Object<string, number>} targetMetrics Target metrics.
 * @return {string[]} Metric names.
 */
function collectMetricNames(rounds, targetMetrics) {
  const names = [];
  for (const round of rounds) {
    for (const name of Object.keys(round.metrics)) {
      if (!names.includes(name)) {
        names.push(name);
      }
    }
  }
  for (const name of Object.keys(targetMetrics)) {
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Detects rounds that improve over all previous values for each metric.
 * @param {Object} model Normalized history model.
 * @param {string[]} metricNames Metric names in render order.
 * @return {Map<*, Object[]>} Breakthrough details keyed by round id.
 */
function detectBreakthroughs(model, metricNames) {
  const bestByMetric = new Map();
  const breakthroughs = new Map();

  for (let roundIndex = 0; roundIndex < model.rounds.length; roundIndex += 1) {
    const round = model.rounds[roundIndex];
    const details = [];

    if (round.explicitBreakthrough) {
      details.push({
        metric: 'manual',
        value: null,
        direction: 'marked',
        previousBest: null,
      });
    }

    for (const metric of metricNames) {
      const value = round.metrics[metric];
      if (!Number.isFinite(value)) {
        continue;
      }

      const direction = model.metricDirections[metric] ?? 'max';
      const previousBest = bestByMetric.get(metric);
      if (previousBest !== undefined && isImprovement(value, previousBest, direction)) {
        details.push({metric, value, direction, previousBest});
      }

      if (
        previousBest === undefined ||
        isImprovement(value, previousBest, direction)
      ) {
        bestByMetric.set(metric, value);
      }
    }

    if (roundIndex > 0 && details.length > 0) {
      breakthroughs.set(round.round, details);
    }
  }

  return breakthroughs;
}

/**
 * Checks whether a metric value improves over a previous best.
 * @param {number} value Current value.
 * @param {number} previousBest Previous best value.
 * @param {string} direction Optimization direction.
 * @return {boolean} Whether the current value is better.
 */
function isImprovement(value, previousBest, direction) {
  return direction === 'min' ? value < previousBest : value > previousBest;
}

/**
 * Builds per-metric chart series to avoid scale compression across metrics.
 * @param {Object[]} rounds Normalized rounds with breakthrough details.
 * @param {string[]} metricNames Metric names.
 * @param {Object<string, number>} targetMetrics Target metric values.
 * @return {Object[]} Per-metric chart series.
 */
function buildMetricSeries(rounds, metricNames, targetMetrics) {
  return metricNames.map((metric, index) => {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    return {
      metric,
      canvasId: `metricChart${index}`,
      color,
      values: rounds.map((round) => round.metrics[metric] ?? null),
      target: targetMetrics[metric],
      breakthroughs: rounds.map((round) =>
        round.breakthroughs.some((item) => item.metric === metric),
      ),
    };
  });
}

/**
 * Computes cumulative elapsed minutes by round.
 * @param {Object[]} rounds Normalized round records.
 * @return {number[]} Cumulative minutes.
 */
function cumulativeMinutes(rounds) {
  let total = 0;
  return rounds.map((round) => {
    total += round.elapsedMs;
    return Number((total / 60000).toFixed(3));
  });
}

/**
 * Builds compact subtitle text.
 * @param {Object} model Normalized history model.
 * @return {string} Subtitle text.
 */
function compactSubtitle(model) {
  return [model.targetType, model.description].filter(Boolean).join(' - ');
}

/**
 * Renders a summary card.
 * @param {*} value Stat value.
 * @param {string} label Stat label.
 * @return {string} HTML string.
 */
function statCard(value, label) {
  return `<div class="stat-card"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

/**
 * Formats the best round summary value.
 * @param {*} bestRound Best round value from history.
 * @return {string} Display value.
 */
function formatBestRound(bestRound) {
  if (bestRound === null || bestRound === undefined || bestRound === '') {
    return 'Not set';
  }
  return `${bestRound}`;
}

/**
 * Renders empty-history content.
 * @return {string} HTML string.
 */
function emptyState() {
  return '<section class="panel empty">No optimization rounds recorded yet.</section>';
}

/**
 * Renders chart panels and inline chart script.
 * @param {Object[]} metricSeries Per-metric chart series.
 * @param {string[]} labels Chart labels.
 * @param {number[]} cumulativeTime Cumulative minutes.
 * @return {string} HTML string.
 */
function chartsSection(metricSeries, labels, cumulativeTime) {
  return `
    <section class="panel">
      <h2>Metric trend</h2>
      <p class="chart-note">Each metric is charted independently so small-scale metrics remain visible. Orange star points mark breakthrough rounds.</p>
      <div class="metric-grid">
        ${metricSeries.map(renderMetricCard).join('')}
      </div>
    </section>
    <section class="panel chart">
      <canvas id="timeChart"></canvas>
    </section>
    <script>
      const labels = ${scriptJson(labels)};
      const metricSeries = ${scriptJson(metricSeries)};
      metricSeries.forEach((series) => {
        const datasets = [{
          label: series.metric,
          data: series.values,
          borderColor: series.color,
          backgroundColor: series.color + '33',
          tension: 0.25,
          spanGaps: true,
          pointRadius: series.breakthroughs.map((marked) => marked ? 8 : 3),
          pointHoverRadius: series.breakthroughs.map((marked) => marked ? 10 : 5),
          pointStyle: series.breakthroughs.map((marked) => marked ? 'star' : 'circle'),
          pointBackgroundColor: series.breakthroughs.map((marked) => marked ? '#f97316' : '#ffffff'),
          pointBorderColor: series.breakthroughs.map((marked) => marked ? '#f97316' : series.color),
          pointBorderWidth: series.breakthroughs.map((marked) => marked ? 2 : 1)
        }];

        if (Number.isFinite(series.target)) {
          datasets.push({
            label: series.metric + ' target',
            data: labels.map(() => series.target),
            borderColor: '#94a3b8',
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          });
        }

        new Chart(document.getElementById(series.canvasId), {
          type: 'line',
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: series.metric } },
            scales: { y: { beginAtZero: true } }
          }
        });
      });
      new Chart(document.getElementById('timeChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Cumulative time (minutes)',
            data: ${scriptJson(cumulativeTime)},
            borderColor: '#2563eb',
            backgroundColor: '#2563eb33',
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: 'Cumulative elapsed time' } }
        }
      });
    </script>`;
}

/**
 * Renders one metric chart card.
 * @param {Object} series Per-metric chart series.
 * @return {string} HTML string.
 */
function renderMetricCard(series) {
  return `<div class="metric-card"><canvas id="${escapeHtml(series.canvasId)}" aria-label="${escapeHtml(series.metric)} trend"></canvas></div>`;
}

/**
 * Renders key learnings.
 * @param {Array<*>} keyLearnings Learning records.
 * @return {string} HTML string.
 */
function renderLearnings(keyLearnings) {
  if (keyLearnings.length === 0) {
    return '';
  }

  return `<section class="panel"><h2>Key learnings</h2><ul>${keyLearnings
    .map((learning) => `<li>${escapeHtml(learning)}</li>`)
    .join('')}</ul></section>`;
}

/**
 * Renders the round table.
 * @param {Object[]} rounds Normalized round records.
 * @return {string} HTML string.
 */
function renderRounds(rounds) {
  if (rounds.length === 0) {
    return '';
  }

  return `<section class="panel table-wrap">
    <h2>Round details</h2>
    <table>
      <thead>
        <tr>
          <th>Round</th>
          <th>Breakthrough</th>
          <th>Elapsed</th>
          <th>Metrics</th>
          <th>Decision</th>
          <th>Change</th>
          <th>Commit</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rounds.map(renderRoundRow).join('')}
      </tbody>
    </table>
  </section>`;
}

/**
 * Renders one round table row.
 * @param {Object} round Normalized round record.
 * @return {string} HTML string.
 */
function renderRoundRow(round) {
  return `<tr${round.breakthroughs.length > 0 ? ' class="breakthrough-row"' : ''}>
    <td>R${escapeHtml(round.round)}</td>
    <td>${renderBreakthroughCell(round.breakthroughs)}</td>
    <td>${escapeHtml((round.elapsedMs / 60000).toFixed(1))}m</td>
    <td>${renderMetricPills(round.metrics)}</td>
    <td>${escapeHtml(round.decision)}</td>
    <td>${escapeHtml(round.change)}</td>
    <td><code>${escapeHtml(round.commit)}</code></td>
    <td>${escapeHtml(round.notes)}</td>
  </tr>`;
}

/**
 * Renders metric values as readable pills.
 * @param {Object<string, number>} metrics Round metrics.
 * @return {string} HTML string.
 */
function renderMetricPills(metrics) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) {
    return '-';
  }

  return `<ul class="metric-list">${entries
    .map(
      ([metric, value]) =>
        `<li class="metric-pill">${escapeHtml(metric)}: ${escapeHtml(value)}</li>`,
    )
    .join('')}</ul>`;
}

/**
 * Renders breakthrough badge and details.
 * @param {Object[]} breakthroughs Breakthrough details.
 * @return {string} HTML string.
 */
function renderBreakthroughCell(breakthroughs) {
  if (breakthroughs.length === 0) {
    return '-';
  }

  const details = breakthroughs
    .map((item) => {
      if (item.metric === 'manual') {
        return 'Manually marked';
      }
      const arrow = item.direction === 'min' ? '↓' : '↑';
      return `${item.metric} ${arrow} ${formatNumber(item.previousBest)} -> ${formatNumber(item.value)}`;
    })
    .join('<br>');

  return `<span class="breakthrough-badge">Breakthrough</span><div class="breakthrough-detail">${escapeHtml(details).replace(/&lt;br&gt;/g, '<br>')}</div>`;
}

/**
 * Formats numeric metric values for compact display.
 * @param {*} value Value to format.
 * @return {string} Display value.
 */
function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildMetricSeries,
  collectMetricNames,
  cumulativeMinutes,
  detectBreakthroughs,
  escapeHtml,
  generateHTML,
  getRoundMetrics,
  loadHistory,
  normalizeHistory,
  parseArgs,
  parsePort,
  scriptJson,
};
