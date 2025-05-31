import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

let data;
let commits;
let filteredCommits;
let hideTooltipTimeout;
let xScale = d3.scaleTime();
let yScale = d3.scaleLinear().domain([0, 24]);
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let colors = d3.scaleOrdinal(d3.schemeTableau10);



async function loadData() {
  const csvData = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return csvData;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: "https://github.com/jordipham/portfolio/commit/" + commit,
        author: author,
        date: date,
        time: time,
        timezone: timezone,
        datetime: datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });
}


function updateSummaryStats(filteredCommits, filteredData) {
  // Clear the previous stats grid
  d3.select("#stats .summary-stats-grid").remove();

  // If there are no commits, do nothing further.
  if (filteredCommits.length === 0) {
    return;
  }

  // Calculate stats based on the filtered data
  const numFiles = new Set(filteredData.map((d) => d.file)).size;
  const totalLoc = filteredData.length;
  const maxDepth = d3.max(filteredData, (d) => d.depth) || 0;
  const maxLinesInFile =
    d3.max(
      d3
        .rollup(
          filteredData,
          (v) => v.length,
          (d) => d.file
        )
        .values()
    ) || 0;
  const timeOfDayCounts = d3.rollup(
    filteredCommits,
    (v) => v.length,
    (d) => {
      const hour = d.datetime.getHours();
      if (hour >= 6 && hour < 12) return "Morning";
      if (hour >= 12 && hour < 18) return "Afternoon";
      if (hour >= 18 && hour < 24) return "Evening";
      return "Night";
    }
  );
  const mostActiveTimeOfDay = d3.greatest(
    timeOfDayCounts,
    ([, value]) => value
  )?.[0];

  const dayOfWeekCounts = d3.rollup(
    filteredCommits,
    (v) => v.length,
    (d) => d.datetime.getDay()
  );
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const mostActiveDayOfWeekIndex = d3.greatest(
    dayOfWeekCounts,
    ([, value]) => value
  )?.[0];
  const mostActiveDayOfWeek = days[mostActiveDayOfWeekIndex];
  const daysWorked = new Set(
    filteredData.map((d) => d.date.toISOString().split("T")[0])
  ).size;

  // Render the new stats
  renderCommitInfo(
    filteredCommits,
    numFiles,
    totalLoc,
    maxDepth,
    maxLinesInFile,
    mostActiveTimeOfDay,
    mostActiveDayOfWeek,
    daysWorked
  );
}

function updateFileDisplay(filteredCommits) {
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join(
      // This code only runs when the div is initially rendered
      (enter) =>
        enter.append("div").call((div) => {
          div.append("dt").append("code");
          div.append("dd");
        })
    );
  // This code updates the div info
  filesContainer
    .select("dt > code")
    .html(
      (d) =>
        `${d.name} <small style="display: block; font-size: 0.8em; opacity: 0.7;">${d.lines.length} lines</small>`
    );
  filesContainer
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc")
    .attr("style", (d) => `--color: ${colors(d.type)}`);
}

function renderCommitInfo(
  commits,
  numFiles,
  totalLoc,
  maxDepth,
  maxLinesInFile,
  mostActiveTimeOfDay,
  mostActiveDayOfWeek,
  daysWorked
) {
  const statsContainer = d3
    .select("#stats")
    .append("div")
    .attr("class", "summary-stats-grid");

  const statPairs = [
    { label: "COMMITS", value: commits.length },
    { label: "FILES", value: numFiles },
    { label: "TOTAL LOC", value: totalLoc },
    { label: "MAX DEPTH", value: maxDepth },
    { label: "MAX LINES", value: maxLinesInFile },
    { label: "PRODUCTIVE TIME OF DAY", value: mostActiveTimeOfDay || "N/A" },
    { label: "PRODUCTIVE DAY OF WEEK", value: mostActiveDayOfWeek || "N/A" },
    { label: "DAYS WORKED ON SITE", value: daysWorked },
  ];

  statPairs.forEach((stat) => {
    const statDiv = statsContainer.append("div").attr("class", "stat-item");
    statDiv.append("div").attr("class", "stat-label").text(stat.label);
    statDiv.append("div").attr("class", "stat-value").text(stat.value);
  });
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  xScale
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  yScale.range([usableArea.bottom, usableArea.top]);

  const dots = svg.append("g").attr("class", "dots");
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("fill", "steelblue")
    .attr("r", (d) => rScale(d.totalLines))
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      clearTimeout(hideTooltipTimeout);
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      hideTooltipTimeout = setTimeout(() => {
        updateTooltipVisibility(false);
      }, 300);
    });

  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left},0)`);

  gridlines.call(
    d3
      .axisLeft(yScale)
      .tickFormat("")
      .tickSize(-usableArea.width)
      .ticks(yScale.ticks().length)
  );

  const xAxis = d3.axisBottom(xScale);
  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .attr("class", "x-axis")
    .call(xAxis);

  const yAxis = d3.axisLeft(yScale);
  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .attr("class", "y-axis")
    .call(yAxis);

  createBrushSelector(svg);
}

function updateScatterPlot(data, commits) {
  const svg = d3.select("#chart").select("svg");

  xScale.domain(d3.extent(commits, (d) => d.datetime));

  const xAxis = d3.axisBottom(xScale);
  svg.select("g.x-axis").transition().call(xAxis);

  const dots = svg.select("g.dots");
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([5, 30]);
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("cx", (d) => xScale(d.datetime))
          .attr("cy", (d) => yScale(d.hourFrac))
          .attr("r", 0)
          .attr("fill", "steelblue")
          .style("fill-opacity", 0.7)
          .on("mouseenter", (event, commit) => {
            clearTimeout(hideTooltipTimeout);
            d3.select(event.currentTarget).style("fill-opacity", 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
          })
          .on("mouseleave", (event) => {
            d3.select(event.currentTarget).style("fill-opacity", 0.7);
            hideTooltipTimeout = setTimeout(() => {
              updateTooltipVisibility(false);
            }, 300);
          }),
      (update) => update,
      (exit) => exit.transition().duration(300).attr("r", 0).remove()
    )
    .transition()
    .duration(500)
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .style("--r", (d) => rScale(d.totalLines));
}

// -----------------
// Tooltip Functions
// -----------------

function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString("en", {
    dateStyle: "full",
    timeStyle: "long",
  });
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = `${event.pageX + 10}px`;
  tooltip.style.top = `${event.pageY + 10}px`;
}


function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector("#selection-count");
  countElement.textContent = `${
    selectedCommits.length || "No"
  } commits selected`;

  return selectedCommits;
}

function createBrushSelector(svg) {
  const brush = d3
    .brush()
    .extent([
      [xScale.range()[0], yScale.range()[1]],
      [xScale.range()[1], yScale.range()[0]],
    ])
    .on("start brush end", brushed);

  svg.append("g").attr("class", "brush").call(brush);
  svg.selectAll(".dots, .overlay ~ *").raise();
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll("circle").classed("selected", (d) =>
    isCommitSelected(selection, d)
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById("language-breakdown");
  container.innerHTML = "";

  if (selectedCommits.length === 0) {
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);
    const dt = document.createElement("dt");
    dt.textContent = language;
    const dd = document.createElement("dd");
    dd.textContent = `${count} lines (${formatted})`;
    container.append(dt, dd);
  }
}



function onTimeSliderChange() {
  const slider = document.getElementById("commit-progress");
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  const timeElem = document.getElementById("commit-time");
  timeElem.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  const filteredData = data.filter((d) => d.datetime <= commitMaxTime);

  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
  updateSummaryStats(filteredCommits, filteredData);
}


async function main() {
  data = await loadData();
  commits = processCommits(data);
  filteredCommits = commits;

  commits = d3.sort(commits, (d) => d.datetime);

  timeScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, 100]);

  renderScatterPlot(data, filteredCommits);

  // Set up event listeners
  document
    .getElementById("commit-progress")
    .addEventListener("input", onTimeSliderChange);

  // Initial call to set time display and render all components
  onTimeSliderChange();

  d3.select("#scatter-story")
    .selectAll(".step")
    .data(commits)
    .join("div")
    .attr("class", "step")
    .html(
      (d, i) => `
        <p>
          On ${d.datetime.toLocaleString("en", {
            dateStyle: "full",
            timeStyle: "short",
          })},
          I made <a href="${d.url}" target="_blank">${
        i > 0 ? "another commit" : "my first commit"
      }</a>,
          editing ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (d) => d.file
        ).length
      } files.
        </p>
      `
    );

  const scroller = scrollama();

  scroller
    .setup({
      container: "#scrolly-1",
      step: "#scrolly-1 .step",
      offset: 0.5, // Trigger when step is at the midpoint of the screen
      debug: false, // Set to true for debugging scrollama
    })
    .onStepEnter((response) => {
      const currentCommitDatetime = response.element.__data__.datetime;

      const newFilteredCommits = commits.filter(
        (d) => d.datetime <= currentCommitDatetime
      );
      const newFilteredData = data.filter(
        (d) => d.datetime <= currentCommitDatetime
      ); 
      updateScatterPlot(data, newFilteredCommits);
      updateFileDisplay(newFilteredCommits);
      updateSummaryStats(newFilteredCommits, newFilteredData);
    })
    .onStepExit((response) => {
      if (response.direction === "up" && response.index === 0) {
        updateScatterPlot(data, []); // Clear plot or show only initial state
        updateFileDisplay([]);
        updateSummaryStats([], []);
      }
    });
}

main();