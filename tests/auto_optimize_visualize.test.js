'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const visualize = require('../auto-optimize/visualize.js');

test('normalizeHistory supports current example schema', () => {
  const history = {
    target_name: 'demo',
    target_type: 'framework',
    status: 'completed',
    best_round: 2,
    rounds: [
      {round: 1, elapsed_ms: 60000, metrics: {score: 1, text: 'skip'}},
      {round: 2, elapsed_ms: 120000, metrics: {score: 2}},
    ],
  };

  const model = visualize.normalizeHistory(history);

  assert.equal(model.targetName, 'demo');
  assert.equal(model.targetType, 'framework');
  assert.equal(model.totalTimeMs, 180000);
  assert.equal(model.bestRound, 2);
  assert.deepEqual(model.rounds.map((round) => round.metrics), [
    {score: 1},
    {score: 2},
  ]);
});

test('normalizeHistory supports SKILL.md documented evaluation schema', () => {
  const history = {
    rounds: [
      {
        round: 1,
        git_commit: 'abc123',
        decision: 'keep',
        evaluation: {
          main: {score: 0.9},
          guardrail: {latency_ms: 12},
          comment: 'ignored',
        },
      },
    ],
  };

  const model = visualize.normalizeHistory(history);

  assert.deepEqual(model.rounds[0].metrics, {
    'main.score': 0.9,
    'guardrail.latency_ms': 12,
  });
  assert.equal(model.rounds[0].commit, 'abc123');
  assert.equal(model.rounds[0].decision, 'keep');
});

test('normalizeHistory rejects invalid rounds field', () => {
  assert.throws(
    () => visualize.normalizeHistory({rounds: {}}),
    /rounds" must be an array/,
  );
});

test('generateHTML escapes untrusted history values', () => {
  const html = visualize.generateHTML({
    target_name: '<script>alert(1)</script>',
    rounds: [
      {
        round: 1,
        elapsed_ms: 1000,
        change: '<img src=x onerror=alert(1)>',
        metrics: {score: 1},
      },
    ],
  });

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
});

test('generateHTML renders independent metric charts and breakthrough markers', () => {
  const html = visualize.generateHTML({
    target_name: 'breakthrough-demo',
    rounds: [
      {round: 1, elapsed_ms: 1000, metrics: {large: 1000, small: 1}},
      {round: 2, elapsed_ms: 1000, metrics: {large: 1200, small: 1}},
      {round: 3, elapsed_ms: 1000, metrics: {large: 1100, small: 2}},
    ],
  });

  assert.match(html, /id="metricChart0"/);
  assert.match(html, /id="metricChart1"/);
  assert.match(html, /Orange star points mark breakthrough rounds/);
  assert.match(html, /Breakthrough/);
  assert.match(html, /large ↑ 1000 -&gt; 1200/);
  assert.match(html, /small ↑ 1 -&gt; 2/);
  assert.match(html, /class="metric-pill">large: 1000/);
  assert.doesNotMatch(html, /id="metricsChart"/);
});

test('generateHTML renders cumulative time as a line chart', () => {
  const html = visualize.generateHTML({
    target_name: 'time-demo',
    rounds: [
      {round: 1, elapsed_ms: 1000, metrics: {score: 1}},
      {round: 2, elapsed_ms: 2000, metrics: {score: 2}},
    ],
  });

  assert.match(html, /new Chart\(document\.getElementById\('timeChart'\), \{\n        type: 'line'/);
  assert.doesNotMatch(html, /type: 'bar'/);
});

test('generateHTML renders explicit and missing best round clearly', () => {
  const withBestRound = visualize.generateHTML({
    target_name: 'best-demo',
    best_round: 5,
    rounds: [{round: 5, elapsed_ms: 1000, metrics: {score: 1}}],
  });
  const withoutBestRound = visualize.generateHTML({
    target_name: 'missing-best-demo',
    rounds: [],
  });

  assert.match(withBestRound, /<div class="stat-value">5<\/div><div class="stat-label">Best round<\/div>/);
  assert.match(withoutBestRound, /<div class="stat-value">Not set<\/div><div class="stat-label">Best round<\/div>/);
});

test('generateHTML removes extra top margin from panel headings', () => {
  const html = visualize.generateHTML({
    target_name: 'spacing-demo',
    rounds: [{round: 1, elapsed_ms: 1000, metrics: {score: 1}}],
  });

  assert.match(html, /\.panel > h2:first-child \{ margin-top: 0; \}/);
});

test('detectBreakthroughs respects min metric directions', () => {
  const model = visualize.normalizeHistory({
    metric_directions: {latency_ms: 'min'},
    rounds: [
      {round: 1, metrics: {latency_ms: 100}},
      {round: 2, metrics: {latency_ms: 120}},
      {round: 3, metrics: {latency_ms: 90}},
    ],
  });
  const metricNames = visualize.collectMetricNames(
    model.rounds,
    model.targetMetrics,
  );

  const breakthroughs = visualize.detectBreakthroughs(model, metricNames);

  assert.equal(breakthroughs.has(2), false);
  assert.deepEqual(breakthroughs.get(3), [
    {
      metric: 'latency_ms',
      value: 90,
      direction: 'min',
      previousBest: 100,
    },
  ]);
});

test('generateHTML handles empty history', () => {
  const html = visualize.generateHTML({
    target_name: 'empty',
    rounds: [],
    status: 'not_started',
  });

  assert.match(html, /No optimization rounds recorded yet/);
  assert.doesNotMatch(html, /metricsChart/);
});

test('parseArgs supports target, skill alias, output, port, and open', () => {
  assert.deepEqual(visualize.parseArgs(['--target', 'a']), {
    targetPath: 'a',
    outputPath: null,
    port: 8080,
    open: false,
    help: false,
  });
  assert.deepEqual(
    visualize.parseArgs([
      '--skill',
      'b',
      '--output',
      'out.html',
      '--port',
      '3000',
      '--open',
    ]),
    {
      targetPath: 'b',
      outputPath: 'out.html',
      port: 3000,
      open: true,
      help: false,
    },
  );
});

test('parseArgs rejects missing values and invalid ports', () => {
  assert.throws(() => visualize.parseArgs(['--target']), /requires a value/);
  assert.throws(() => visualize.parseArgs(['--port', '0']), /Invalid port/);
  assert.throws(() => visualize.parseArgs(['--unknown']), /Unknown argument/);
});

test('loadHistory reads JSON and reports parse failures', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visualize-test-'));
  try {
    fs.writeFileSync(
      path.join(tempDir, 'optimization_history.json'),
      '{"rounds":[]}',
      'utf8',
    );
    assert.deepEqual(visualize.loadHistory(tempDir), {rounds: []});

    fs.writeFileSync(
      path.join(tempDir, 'optimization_history.json'),
      '{invalid',
      'utf8',
    );
    assert.throws(() => visualize.loadHistory(tempDir), /Failed to parse/);
  } finally {
    fs.rmSync(tempDir, {recursive: true, force: true});
  }
});

test('example history renders successfully', () => {
  const historyPath = path.join(
    __dirname,
    '..',
    'auto-optimize',
    'example_history.json',
  );
  const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  const html = visualize.generateHTML(history);

  assert.match(html, /auto-optimize Optimization History/);
  assert.match(html, /<div class="stat-value">5<\/div><div class="stat-label">Best round<\/div>/);
  assert.match(html, /Metric trend/);
  assert.match(html, /Karpathy&#39;s NEVER STOP principle/);
});
