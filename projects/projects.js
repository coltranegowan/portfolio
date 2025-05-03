import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const titleElement = document.querySelector('.projects-title');
if (titleElement) {
titleElement.textContent = `${Array.isArray(projects) ? projects.length : 0} Projects`;
}



  





let query = '';
let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;

  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);

  const titleElement = document.querySelector('.projects-title');
  if (titleElement) {
    titleElement.textContent = `${filteredProjects.length} Projects`;
  }
});

let selectedIndex = -1;

function renderPieChart(projectsGiven) {
    let rolledData = d3.rollups(
      projectsGiven.filter((d) => d.year != null && d.year !== ''),
      (v) => v.length,
      (d) => d.year
    ).sort((a, b) => +a[0] - +b[0]);
  
    let data = rolledData.map(([year, count]) => {
      return { value: count, label: year };
    });
  
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let sliceGenerator = d3.pie().value((d) => d.value);
    let arcData = sliceGenerator(data);
    let arcs = arcData.map((d) => arcGenerator(d));
    let colors = d3.scaleOrdinal(d3.schemeTableau10);
  
    let svg = d3.select('svg');
    svg.selectAll('*').remove();
    let legend = d3.select('.legend');
    legend.selectAll('*').remove();
  
    arcs.forEach((arc, i) => {
        svg.append('path')
          .attr('d', arc)
          .attr('fill', colors(i))
          .attr('class', selectedIndex === i ? 'selected' : '')
          .on('click', () => {
            selectedIndex = selectedIndex === i ? -1 : i;
          
            svg.selectAll('path')
              .attr('class', (_, idx) => (selectedIndex === idx ? 'selected' : ''));
          
            d3.select('.legend')
              .selectAll('li')
              .attr('class', (_, idx) =>
                selectedIndex === idx ? 'legend-item selected' : 'legend-item'
              );
          
              let filtered = projects
              .filter((p) => {
                let values = Object.values(p).join('\n').toLowerCase();
                return values.includes(query.toLowerCase());
              })
              .filter((p) => {
                return selectedIndex === -1 || p.year === data[selectedIndex].label;
              });
          
            renderProjects(filtered, projectsContainer, 'h2');
          
            const titleElement = document.querySelector('.projects-title');
            if (titleElement) {
              titleElement.textContent = `${filtered.length} Projects`;
            }
          });
          
      });
      
  
      data.forEach((d, idx) => {
        legend
          .append('li')
          .attr('class', selectedIndex === idx ? 'legend-item selected' : 'legend-item')
          .attr('style', `--color:${colors(idx)}`)
          .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
          .on('click', () => {
            selectedIndex = selectedIndex === idx ? -1 : idx;
          
            svg.selectAll('path')
              .attr('class', (_, i) => (selectedIndex === i ? 'selected' : ''));
          
            legend.selectAll('li')
              .attr('class', (_, i) =>
                selectedIndex === i ? 'legend-item selected' : 'legend-item'
              );
          
              let filtered = projects
              .filter((p) => {
                let values = Object.values(p).join('\n').toLowerCase();
                return values.includes(query.toLowerCase());
              })
              .filter((p) => {
                return selectedIndex === -1 || p.year === data[selectedIndex].label;
              });
            
          
            renderProjects(filtered, projectsContainer, 'h2');
          
            const titleElement = document.querySelector('.projects-title');
            if (titleElement) {
              titleElement.textContent = `${filtered.length} Projects`;
            }
          });
          
      
  });
}
  renderPieChart(projects);
