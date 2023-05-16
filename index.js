const BASE_URL = "https://wanderinginn.com";
const RESULTS_PER_PAGE = 10;
let currPage = undefined; // current page number of search results

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const resultsHolder = document.querySelector("#results-holder");
const resultCounter = document.querySelector("#num-results");

function setPlaceholder() {
    const index = Math.floor(0.99 * Math.random() * placeholders.length);
    searchInput.setAttribute("placeholder", placeholders[index]);
}

const placeholders = [
    "No killing Goblins!",
    "Seek and ye shall find.",
    "Scry! Scry!",
    "[Searcher] at your service.",
];

setPlaceholder();
searchInput.focus();

searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(searchForm);
    const input = formData.get("input");
    //const caseSensitive = formData.get("caseSensitive") === "true";
    const query = parseSearch(input);
    if (query.length === 0) {
        // TODO: notify user of bad query
        return;
    }
    const qParams = formatParams({
        query,
        caseSensitive: false,
    });
    console.log(qParams);
    const res = await fetch(`/search?${qParams}`);
    const data = JSON.parse(await res.text());
    data.forEach((ch, i) => {
        ch.index = i;
    });
    console.log(data);
    displayResults(data);
    currPage = 1;
    displayResultCount();
    setPlaceholder();
});

/**
 * Displays search results.
 *
 * @param {Array<{name: string, url: string, score: number, excerpts: string[]}>} data
 *      array of chapter search results, sorted from earliest to latest
 */
function displayResults(data) {
    const sortType = document.querySelector(
        `input[name="sortType"]:checked`
    ).value;
    console.log(sortType);
    if (sortType === "relevance") {
        data.sort((ch1, ch2) => ch2.score - ch1.score);
    } else if (sortType === "latest") {
        data.sort((ch1, ch2) => ch2.index - ch1.index);
    } else if (sortType === "earliest") {
        data.sort((ch1, ch2) => ch1.index - ch2.index);
    }
    clearSearchResults();
    data.forEach(makeSearchResultDiv);
}

/**
 * Adds a search result (corresponding to a single chapter) to the DOM
 *
 * @param {{name: string, url: string, score: number, excerpts: string[]}} chapter
 */
function makeSearchResultDiv(chapter) {
    const div = document.createElement("div");
    div.innerHTML = `
        <a href="${BASE_URL}${chapter.url}" target="_blank">${chapter.name}</a>
        ${chapter.excerpts.join("<hr />")}
    `;
    resultsHolder.append(div);
}

/**
 * Removes all search results from DOM
 */
function clearSearchResults() {
    while (resultsHolder.firstElementChild) {
        resultsHolder.firstElementChild.remove();
    }
}

/**
 * Updates DOM info span with information on number of results and current page number
 */
function displayResultCount() {
    const numResults = resultsHolder.children.length;
    const numPages = Math.ceil(numResults / RESULTS_PER_PAGE);
    resultCounter.innerHTML =
        currPage !== undefined
            ? `Showing results from ${numResults} chapters, page ${currPage} of ${numPages}`
            : "";
}

/**
 * Tokenizes a raw search input.
 *
 * @param {string} rawSearch
 * @returns {string[]}
 */
function parseSearch(rawSearch) {
    return rawSearch
        .replace(",", " ")
        .split(" ")
        .filter((word) => word.length > 0);
}

/**
 * Formats JSON-like parameter object
 *
 * @param {Object} params
 * @returns {string}
 */
function formatParams(params) {
    return Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
}
