import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

function renderTooltipContent(commit) {
    if (Object.keys(commit).length === 0) return;
  
    document.getElementById('commit-link').href = commit.url;
    document.getElementById('commit-link').textContent = commit.id;
    document.getElementById('commit-date').textContent = commit.datetime?.toLocaleDateString('en', { dateStyle: 'full' });
    document.getElementById('commit-time').textContent = commit.datetime?.toLocaleTimeString('en', { timeStyle: 'short' });
    document.getElementById('commit-author').textContent = commit.author;
    document.getElementById('commit-lines').textContent = commit.totalLines;
  }
  

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false, 
        writable: true,
        configurable: true,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
    // === Basic Aggregates ===
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);
  
    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);
  
    // === Number of Distinct Values ===
    const fileCount = d3.group(data, d => d.file).size;
    const authorCount = d3.group(data, d => d.author).size;
    dl.append('dt').text('Number of files');
    dl.append('dd').text(fileCount);
  
    dl.append('dt').text('Number of authors');
    dl.append('dd').text(authorCount);
  
    // === Aggregates over whole dataset ===
    const maxDepth = d3.max(data, d => d.depth);
    const avgDepth = d3.mean(data, d => d.depth);
    dl.append('dt').text('Maximum depth');
    dl.append('dd').text(maxDepth);
  
    dl.append('dt').text('Average depth');
    dl.append('dd').text(avgDepth.toFixed(1));
  
    // === Grouped Aggregates ===
    const fileLengths = d3.rollups(
      data,
      v => d3.max(v, d => d.line), // longest line number in each file
      d => d.file
    );
    const avgFileLength = d3.mean(fileLengths, d => d[1]);
    dl.append('dt').text('Average file length');
    dl.append('dd').text(avgFileLength.toFixed(1) + ' lines');
  
    // === Time of Day Most Work Done ===
    const periodGroups = d3.rollups(
      data,
      v => v.length,
      d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }) // 'morning', 'afternoon', etc.
    );
    const topPeriod = d3.greatest(periodGroups, d => d[1])?.[0];
    dl.append('dt').text('Most active time of day');
    dl.append('dd').text(topPeriod);
  
    // === Day of Week Most Work Done ===
    const dayGroups = d3.rollups(
      data,
      v => v.length,
      d => new Date(d.datetime).toLocaleString('en-US', { weekday: 'long' })
    );
    const topDay = d3.greatest(dayGroups, d => d[1])?.[0];
    dl.append('dt').text('Most active day');
    dl.append('dd').text(topDay);
  }
  

  function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;

    const colorScale = d3.scaleLinear()
  .domain([0, 6, 12, 18, 24])  // Midnight → Morning → Noon → Evening → Midnight
  .range(['#1e3a8a', '#60a5fa', '#facc15', '#2b5e92', '#1e3a8a']); 

    const svg = d3
  .select('#chart')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .style('overflow', 'visible');

  const xScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, width])
  .nice();

  const yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

  const dots = svg.append('g').attr('class', 'dots');

  dots
  .selectAll('circle')
  .data(commits)
  .join('circle')
  .attr('cx', d => xScale(d.datetime))
  .attr('cy', d => yScale(d.hourFrac))
  .attr('r', 5)
  .attr('fill', d => colorScale(d.hourFrac))
  .on('mouseenter', (event, commit) => {
    renderTooltipContent(commit);
    updateTooltipVisibility(true);
    updateTooltipPosition(event);
  })
  .on('mousemove', (event) => {
    updateTooltipPosition(event);
  })
  .on('mouseleave', () => {
    updateTooltipVisibility(false);
  });

  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  
  // Update scales with new ranges
  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  // Add gridlines BEFORE the axes
const gridlines = svg
.append('g')
.attr('class', 'gridlines')
.attr('transform', `translate(${usableArea.left}, 0)`);

// Create gridlines as an axis with no labels and full-width ticks
gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Create the axes
const xAxis = d3.axisBottom(xScale);
const yAxis = d3
  .axisLeft(yScale)
  .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

// Add X axis
svg
  .append('g')
  .attr('transform', `translate(0, ${usableArea.bottom})`)
  .call(xAxis);

// Add Y axis
svg
  .append('g')
  .attr('transform', `translate(${usableArea.left}, 0)`)
  .call(yAxis);

  
   }
   
   

   function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
  }
  
  function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 12}px`; // add offset so it doesn’t block cursor
    tooltip.style.top = `${event.clientY + 12}px`;
  }
  
  document.addEventListener('DOMContentLoaded', async () => {
    const data = await loadData();
    const commits = processCommits(data);
  
    renderScatterPlot(data, commits);
  });