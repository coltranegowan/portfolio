import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let xScale;
let yScale;
let commits;
let filteredCommits = [];


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
      .domain([0, 6, 12, 18, 24])
      .range(['#1e3a8a', '#60a5fa', '#facc15', '#2b5e92', '#1e3a8a']); 
  
    // Radius scale — use square root for accurate area perception
    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);
  
    // Sort commits so larger circles go first
    const sortedCommits = d3.sort(commits, d => -d.totalLines);
  
    const svg = d3.select('#chart')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');
  
    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    const usableArea = {
      top: margin.top,
      right: width - margin.right,
      bottom: height - margin.bottom,
      left: margin.left,
      width: width - margin.left - margin.right,
      height: height - margin.top - margin.bottom,
    };
  
    xScale = d3.scaleTime()
  .domain(d3.extent(commits, d => d.datetime))
  .range([usableArea.left, usableArea.right])
  .nice();

    yScale = d3.scaleLinear()
  .domain([0, 24])
  .range([usableArea.bottom, usableArea.top]);

  
    // Gridlines
    svg.append('g')
      .attr('class', 'gridlines')
      .attr('transform', `translate(${usableArea.left}, 0)`)
      .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
  
    // Axes
    svg
  .append('g')
  .attr('transform', `translate(0, ${usableArea.bottom})`)
  .attr('class', 'x-axis') // ✅ add this
  .call(d3.axisBottom(xScale));

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis') // ✅ optional, good for future updates
    .call(d3.axisLeft(yScale).tickFormat(d => String(d).padStart(2, '0') + ':00'));
  
    // Dots
    const dots = svg.append('g').attr('class', 'dots');
  
    dots.selectAll('circle')
      dots.selectAll('circle')
    .data(sortedCommits, d => d.id)
      .join('circle')
      .attr('cx', d => xScale(d.datetime))
      .attr('cy', d => yScale(d.hourFrac))
      .attr('r', d => rScale(d.totalLines))
      .attr('fill', d => colorScale(d.hourFrac))
      .style('fill-opacity', 0.7)
      .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
      })
      .on('mousemove', (event) => {
        updateTooltipPosition(event);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipVisibility(false);
      });

      const brush = d3.brush()
  .on('start brush end', brushed);

svg.call(brush);

// Fix tooltip layering
svg.selectAll('.dots, .overlay ~ *').raise();

  }
  
   function updateScatterPlot(commits) {
  const svg = d3.select('#chart').select('svg');

  // Update X scale + axis
  xScale.domain(d3.extent(commits, d => d.datetime));
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  // Recalculate radius scale (optional)
  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Update dots
  const dots = svg.select('g.dots');
  const sorted = d3.sort(commits, d => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sorted, d => d.id)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', d => d3.scaleLinear()
    .domain([0, 6, 12, 18, 24])
    .range(['#1e3a8a', '#60a5fa', '#facc15', '#2b5e92', '#1e3a8a'])(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
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
  commits = processCommits(data);  // ← assign to global variable
  renderScatterPlot(data, commits);

  

  // Create timeScale once commits are loaded
  let timeScale = d3
    .scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([0, 100]);
  
    let commitProgress = 100;
  let commitMaxTime = timeScale.invert(commitProgress);
  // Update global max time
  function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);
  document.getElementById('commit-time-slider').textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
}


  // Initialize and hook up slider
  onTimeSliderChange();
  document.getElementById('commit-progress').addEventListener('input', onTimeSliderChange);
});


  function isCommitSelected(selection, commit) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }
  
  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? commits.filter(d => isCommitSelected(selection, d))
      : [];
  
    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
  }
  
  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
  
    const container = document.getElementById('language-breakdown');
  
    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }
  
    const lines = selectedCommits.flatMap(d => d.lines);
  
    const breakdown = d3.rollup(
      lines,
      v => v.length,
      d => d.type
    );
  
    container.innerHTML = '';
  
    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);
      container.innerHTML += `
        <dt>${language}</dt>
        <dd>${count} lines (${formatted})</dd>
      `;
    }
  }
  
  function brushed(event) {
    const selection = event.selection;
  
    d3.selectAll('circle')
      .classed('selected', d => isCommitSelected(selection, d));
  
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }
  
  

  
