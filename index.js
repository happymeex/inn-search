const BASE_URL = "https://wanderinginn.com";
const RESULTS_PER_PAGE = 10;
const NUM_PREVIEWS = 3;
let currPage = undefined; // current page number of search results

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const resultsHolder = document.querySelector("#results-holder");
const resultCounter = document.querySelector("#num-results");
const prevButton = document.querySelector("#prev-button");
let prevClickHandler;
const nextButton = document.querySelector("#next-button");
let nextClickHandler;
const noResults = document.querySelector("#no-results");

//history.pushState({ input: false }, "");

function handleHistory() {
    console.log("history state:", history.state);
    const input = history.state?.input;
    if (input) {
        searchInput.value = input;
        handleSearch(input);
    } else if (history.state === null) {
        searchInput.value = "";
        clearSearchResults();
    }
}

window.addEventListener("popstate", handleHistory);

function setPlaceholder() {
    const index = Math.floor(0.99 * Math.random() * placeholders.length);
    searchInput.setAttribute("placeholder", placeholders[index]);
}

const placeholders = [
    "No killing Goblins!",
    "Seek and ye shall find.",
    "Scry! Scry!",
    "Welcome, [Searcher].",
];

setPlaceholder();
searchInput.focus();

/**
 * Carries out the search given the raw input `input` and updates the UI
 * accordingly once the results are fetched.
 *
 * @param {string} input
 */
async function handleSearch(input) {
    const query = parseSearch(input);
    if (query.length === 0) {
        // TODO: notify user of bad query
        return;
    }
    console.log("querying:", query);
    const qParams = formatParams({ query });
    const res = await fetch(`/search?${qParams}`);
    const data = JSON.parse(await res.text());
    data.forEach((ch, i) => {
        ch.index = i;
    });
    displayResults(data);
    currPage = 0;
    setPlaceholder();
}

searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(searchForm);
    const input = formData.get("input");

    history.pushState({ input }, "");
    handleEasterEgg();

    void handleSearch(input);
});

/**
 * Displays the `page`th page of results.
 *
 * @param {Array<{name: string, url: string, score: number, excerpts: string[]}>} data
 *      array of chapter search results, sorted from earliest to latest
 * @param {boolean} sort if true, sorts the data according to the radio input's value, true by default
 * @param {number} page zero-indexed page number, 0 by default
 */
function displayResults(data, sort = true, page = 0) {
    if (sort) {
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
    }

    prevButton.removeEventListener("click", prevClickHandler);
    nextButton.removeEventListener("click", nextClickHandler);
    const numPages = Math.ceil(data.length / RESULTS_PER_PAGE);
    const isFirstPage = page === 0;
    const isLastPage = page === numPages - 1;
    prevClickHandler = () => {
        makePageHandler(page > 0, page - 1)(data);
    };
    nextClickHandler = () => {
        makePageHandler(page < numPages - 1, page + 1)(data);
    };
    clearSearchResults();
    if (numPages === 0) {
        noResults.classList.remove("display-none");
        return;
    }
    data.slice(page * RESULTS_PER_PAGE, (page + 1) * RESULTS_PER_PAGE).forEach(
        makeSearchResultDiv
    );
    displayResultCount(data.length);
    for (const [isEdgeCase, button, handler] of [
        [isFirstPage, prevButton, prevClickHandler],
        [isLastPage, nextButton, nextClickHandler],
    ]) {
        if (isEdgeCase) button.setAttribute("disabled", "");
        else button.removeAttribute("disabled");
        button.addEventListener("click", handler);
    }
}

/**
 * Adds a search result (corresponding to a single chapter) to the DOM
 *
 * @param {{name: string, url: string, score: number, excerpts: string[]}} chapter
 */
function makeSearchResultDiv(chapter) {
    const div = document.createElement("div");
    div.classList.add("result-singleChapter");
    div.setAttribute("all-results", "false");
    div.id = chapter.url;
    div.innerHTML = `
        <a href="${BASE_URL}${
        chapter.url
    }" target="_blank" class="results-chapterName">${chapter.name}</a>
        ${chapter.excerpts.slice(0, NUM_PREVIEWS).join("<hr />")}<hr />
    `;
    if (chapter.excerpts.length > NUM_PREVIEWS) {
        const rest = `${chapter.excerpts
            .slice(NUM_PREVIEWS)
            .join("<hr />")}<hr />`;
        const initial = div.innerHTML;
        div.addEventListener("click", () => {
            toggleFullSearchResult(div, initial, rest);
        });
    }
    resultsHolder.append(div);
}

/**
 * If the `all-results` attribute of `div` is `" false"`,
 * appends `rest` to the innerHTML of `div`. Otherwise,
 * sets the innerHTML to `initial`
 *
 * @param {HTMLDivElement} div
 * @param {string} initial
 * @param {string} rest
 */
function toggleFullSearchResult(div, initial, rest) {
    const state = div.getAttribute("all-results");
    if (state === "false") {
        div.innerHTML += rest;
    } else if (state === "true") {
        div.innerHTML = initial;
    }
    div.setAttribute("all-results", state === "false" ? "true" : "false");
}

/**
 * Removes all search results from DOM
 */
function clearSearchResults() {
    noResults.classList.add("display-none");
    while (resultsHolder.lastElementChild) {
        resultsHolder.lastElementChild.remove();
    }
    resultCounter.innerHTML = "";
    prevButton.setAttribute("disabled", "");
    nextButton.setAttribute("disabled", "");
}

/**
 * Updates DOM info span with information on number of results and current page number
 *
 * @param {number} numResults
 */
function displayResultCount(numResults) {
    const numPages = Math.ceil(numResults / RESULTS_PER_PAGE);
    resultCounter.innerHTML =
        currPage !== undefined
            ? `Showing results from ${numResults} chapters, page ${
                  currPage + 1
              } of ${numPages}`
            : "";
}

/**
 * Creates a handler function for clicking either "Previous" or "Next" page.
 * The handler takes in search data as an input.
 *
 * @param {boolean} condition if false, handler does nothing
 * @param {number} page page number to jump to on click
 * @returns {(data: Array<{
 *      name: string,
 *      url: string,
 *      score: number,
 *      index: number,
 *      excerpts: string[]
 *  }>) => void} handler function
 */
function makePageHandler(condition, page) {
    return (data) => {
        if (condition) {
            currPage = page;
            displayResults(data, false, page);
            displayResultCount(data.length);
        }
    };
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

function handleEasterEgg() {
    let numSearches = localStorage.getItem("numSearches");
    if (numSearches === null) {
        numSearches = 0;
    } else numSearches = parseInt(numSearches);
    console.log(numSearches + 1, "searches now");
    localStorage.setItem("numSearches", (numSearches + 1).toString());
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
