function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// let navLinks = $$("nav a")

// let currentLink = navLinks.find(
//     (a) => a.host === location.host && a.pathname === location.pathname,
//   );

// currentLink?.classList.add('current');

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'resume/', title: 'Resume' },
  ];

let nav = document.createElement('nav');
document.body.prepend(nav);

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/" 
    : "/portfolio/"; 

for (let p of pages) {
    let url = p.url;
    let title = p.title;

    url = !url.startsWith('http') ? BASE_PATH + url : url;

    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;

    // Highlight current page
    a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname
    );

    // Open external links in a new tab
    a.toggleAttribute('target', a.host !== location.host);

    nav.append(a);

  }

  // Create and insert color scheme switcher at top right
document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
      Theme:
      <select id="color-scheme-select">
        <option value="auto">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    `
  );
  
  let select = document.querySelector('#color-scheme-select');
  
  if ('colorScheme' in localStorage) {
    document.documentElement.style.setProperty('color-scheme', localStorage.colorScheme);
    select.value = localStorage.colorScheme;
  }
  
  select.addEventListener('input', function (event) {
    const scheme = event.target.value;
    console.log('color scheme changed to', scheme);
  
    document.documentElement.style.setProperty('color-scheme', scheme);
  
    localStorage.colorScheme = scheme;
  });
  
  export async function fetchJSON(url) {
    try {
      // Fetch the JSON file from the given URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
      console.log(response)
    } catch (error) {
      console.error('Error fetching or parsing JSON data:', error);
    }
  }

  export function renderProjects(projects, containerElement, headingLevel = 'h2') {
    if (!(containerElement instanceof HTMLElement)) {
      console.error('Invalid containerElement provided to renderProjects');
      return;
    }
      const validHeadingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    if (!validHeadingTags.includes(headingLevel)) {
      console.warn(`Invalid heading level "${headingLevel}" passed. Falling back to "h2".`);
      headingLevel = 'h2';
    }
      containerElement.innerHTML = '';
  
    if (!Array.isArray(projects)) {
      console.error('Projects must be an array');
      return;
    }
  
    for (let project of projects) {
      const article = document.createElement('article');
  
      const title = project?.title ?? 'Untitled Project';
      const image = project?.image ?? '';
      const description = project?.description ?? 'No description available.';
      const year = project?.year ?? '';
  
      article.innerHTML = `
        <${headingLevel}>${title}</${headingLevel}>
        ${image ? `<img src="${image}" alt="${title}">` : ''}
        <p>${description}
        <br>
        <small><em>${year}</em></small></p>
      `;
  
      containerElement.appendChild(article);
    }
  }

  export async function fetchGitHubData(username) {
    return fetchJSON(`https://api.github.com/users/${username}`);
  }