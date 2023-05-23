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
 * @param {string[]} words list sorted in order of decreasing length
 * @returns {string}
 */
function boldKeywords(text, words) {
    let ret = text;
    words.forEach((word) => {
        const regex = new RegExp(cleanWord(word), "gi");
        ret = ret.replaceAll(regex, (word, index) => {
            // try to avoid boldfacing substrings of HTML formatting
            const neighborhood = ret.slice(index - 8, index + 12);
            const left = ret.slice(Math.max(0, index - 4), index);
            const right = ret.slice(index + 1, index + 4);
            if (left.includes("<") && right.includes(">")) return word;
            //if (left.includes("&") && right.includes(";")) return word; // handle &nbsp;
            if (neighborhood.includes(`="hkw"`) || neighborhood.includes("b>"))
                return word;
            else return `<b class="hkw">${word}</b>`;
        });
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
    localStorage.setItem("numSearches", (numSearches + 1).toString());
    const level = numSearchesToLevel.get(numSearches + 1);
    if (level !== undefined) {
        let message = "";
        if (level === 1) {
            message = `<p>[Searcher Class Obtained!]</p>`;
        }
        message += `<p>[Searcher Level ${level}!]</p>`;
        displayBottomRightPopup(message);
    }
}

const popup = document.querySelector("#level-popup");

/**
 * Displays a popup in the bottom right corner of the screen, containing
 * `message` as innerHTML. The popup fades in, stays for 3.5 seconds, and fades out.
 *
 * @param {number} message HTML-formatted message to display
 */
function displayBottomRightPopup(message) {
    popup.innerHTML = message;
    popup.classList.add("visible");
    setTimeout(() => {
        popup.classList.remove("visible");
    }, 3500);
}

const numSearchesToLevel = new Map([
    [1, 1],
    [10, 5],
    [30, 10],
    [60, 20],
    [120, 30],
    [240, 40],
    [480, 50],
    [960, 60],
    [1920, 70],
]);

export {
    parseSearch,
    formatParams,
    setPlaceholder,
    displayMessageDiv,
    boldKeywords,
    handleEasterEgg,
};
