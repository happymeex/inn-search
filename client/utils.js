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
    return quoted
        .concat(quotesRemoved.replace(/[.,"*]/g, " ").split(" "))
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
 * Wraps each occurrence of a word in `words` with <b></b> tags
 * and returns the result
 *
 * @param {string} text
 * @param {string[]} words
 * @returns {string}
 */
function boldKeywords(text, words) {
    let ret = text;
    words.forEach((word) => {
        const regex = new RegExp(cleanWord(word), "gi");
        ret = ret.replaceAll(
            regex,
            (word) => `<b class="highlighted-keyword">${word}</b>`
        );
    });
    return ret;
}

/**
 * Sanitizes a word so that a RegExp constructed from the result does not throw an error
 *
 * @param word string to clean
 * @returns string with special regex-breaking characters escaped with double backslashes
 */
function cleanWord(word) {
    return word.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

/**
 * Reveals a div with a given message written in it
 *
 * @param {HTMLDivElement} div
 * @param {string} message
 */
function displayMessageDiv(div, message) {
    div.innerHTML = message;
    div.classList.remove("display-none");
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

export {
    parseSearch,
    formatParams,
    setPlaceholder,
    displayMessageDiv,
    boldKeywords,
    handleEasterEgg,
};
