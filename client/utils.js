/**
 * Tokenizes a raw search input.
 *
 * @param {string} rawSearch
 * @returns {string[]}
 */
function parseSearch(rawSearch) {
    const quotedRegex = /"(.*?)"/g;
    const quotesRemoved = rawSearch.replace(quotedRegex, " ");
    const quoted = [...rawSearch.matchAll(quotedRegex)].map((item) => item[1]);
    return quotesRemoved
        .replace(/[.,"*]/g, " ")
        .split(" ")
        .concat(quoted)
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

/**
 * Sets the placeholder of an HTML input element to a randomly selected
 * string from `placeholders`
 *
 * @param {HTMLInputElement} searchInput
 */
function setPlaceholder(searchInput) {
    const index = Math.floor(0.99 * Math.random() * placeholders.length);
    searchInput.setAttribute("placeholder", placeholders[index]);
}

const placeholders = [
    "No killing Goblins!",
    "Seek and ye shall find.",
    "Scry! Scry!",
    "Welcome, [Searcher].",
];

/** Tee-hee! */
function handleEasterEgg() {
    let numSearches = localStorage.getItem("numSearches");
    if (numSearches === null) {
        numSearches = 0;
    } else numSearches = parseInt(numSearches);
    console.log(numSearches + 1, "searches now");
    localStorage.setItem("numSearches", (numSearches + 1).toString());
}

export { parseSearch, formatParams, setPlaceholder, handleEasterEgg };
