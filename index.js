const searchForm = document.querySelector("#search-form");

searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(searchForm);
    const input = formData.get("input");
    const caseSensitive = formData.get("caseSensitive") === "true";
    const qParams = formatParams({
        query: parseSearch(input),
        caseSensitive: caseSensitive,
    });
    console.log(qParams);
    const res = await fetch(`/search?${qParams}`);
    const text = await res.text();
    JSON.parse(text);
    console.log(text);
});

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
