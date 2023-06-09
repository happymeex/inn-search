import {
    parseSearch,
    formatParams,
    setPlaceholder,
    displayMessageDiv,
    boldKeywords,
    handleEasterEgg,
} from "./utils.js";
const RESULTS_PER_PAGE = 10;
const NUM_PREVIEWS = 3; // number of excerpts shown per search result
const NO_RESULTS_MESSAGE = "No results found. Check the incantation?";
let currPage = undefined; // current page number of search results

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const resultsHolder = document.querySelector("#results-holder");
const resultCounter = document.querySelector("#num-results");
const prevButton = document.querySelector("#prev-button");
let prevClickHandler;
const nextButton = document.querySelector("#next-button");
let nextClickHandler;
const messageHolder = document.querySelector("#message-holder");
const backToTop = document.querySelector("#back-to-top-holder");
let query = undefined; // track current array of search keywords
const title = document.querySelector("#title");
const aboutButton = document.querySelector("#about-button");
const modalBackground = document.querySelector("#modal-background");

window.addEventListener("popstate", handleHistory);

setPlaceholder(searchInput);
searchInput.focus();
backToTop.addEventListener("click", () => {
    document.documentElement.scrollTop = 0;
});
title.addEventListener("click", () => {
    clearSearchResults();
    searchInput.value = "";
    history.pushState({ input: undefined }, "");
});
aboutButton.addEventListener("click", () => {
    modalBackground.classList.add("visible");
});
modalBackground.addEventListener("click", (e) => {
    if (e.target === modalBackground)
        modalBackground.classList.remove("visible");
});

/**
 * Carries out the search given the raw input `input` and updates the UI
 * accordingly once the results are fetched.
 *
 * @param {string} input
 */
async function handleSearch(input) {
    clearSearchResults();
    displayMessageDiv(messageHolder, `<div id="loader"></div>`); // loading...
    query = parseSearch(input).sort((w1, w2) => w2.length - w1.length);
    const qParams = formatParams({ query });
    const res = await fetch(`/search?${qParams}`);
    if (!isOK(res.status)) return;
    const data = JSON.parse(await res.text());
    data.forEach((ch, i) => {
        ch.index = i;
    });
    currPage = 0;
    displayResults(data);
    setPlaceholder(searchInput);
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
 *      array of chapter search results
 * @param {boolean} sort if true, sorts the data according to the radio input's value, true by default
 * @param {number} page zero-indexed page number, 0 by default
 */
function displayResults(data, sort = true, page = 0) {
    if (sort) {
        const sortType = document.querySelector(
            `input[name="sortType"]:checked`
        ).value;
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
        displayMessageDiv(messageHolder, NO_RESULTS_MESSAGE);
        return;
    }
    data.slice(page * RESULTS_PER_PAGE, (page + 1) * RESULTS_PER_PAGE).forEach(
        makeSearchResultDiv
    );
    displayResultCount(data.length);
    backToTop.classList.remove("display-none");
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
    const contentString = boldKeywords(
        chapter.excerpts.slice(0, NUM_PREVIEWS).join("<hr />"),
        query
    );
    div.innerHTML = `
        <a href="${chapter.url}" target="_blank" class="results-chapterName">${chapter.name}</a>
        ${contentString}<hr />
    `;
    if (chapter.excerpts.length > NUM_PREVIEWS) {
        div.classList.add("expandable");
        const rest = `${boldKeywords(
            chapter.excerpts.slice(NUM_PREVIEWS).join("<hr />"),
            query
        )}<hr />`;
        const initial = div.innerHTML;
        div.addEventListener("click", (e) => {
            if (e.target === div) toggleFullSearchResult(div, initial, rest);
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
 * Removes all search results from DOM (but does not clear searchbar)
 */
function clearSearchResults() {
    backToTop.classList.add("display-none");
    messageHolder.classList.add("display-none");
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
            ? `Results from ${numResults} chapters, page ${
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
 * Checks whether the given status code is OK (200) and displays an appropriate
 * message in the UI if not
 *
 * @param {number} statusCode status code of search response
 * @returns {boolean} true if `statusCode` is 200, false otherwise
 */
function isOK(statusCode) {
    let message = "";
    switch (statusCode) {
        case 200:
            return true;
        case 400:
            message =
                "The server didn't like your search input. Try reformatting it.";
            break;
        case 500:
            message = "Internal server error. Apologies!";
            break;
        default:
            message = "Mysterious unknown error";
    }
    displayMessageDiv(messageHolder, message);
    return false;
}

function handleHistory() {
    const input = history.state?.input;
    if (history.state === null || input === undefined) {
        // should take us back to empty search *without* "no results" message
        searchInput.value = "";
        clearSearchResults();
    } else if (input !== undefined) {
        searchInput.value = input;
        handleSearch(input);
    }
}
