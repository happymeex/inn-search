import { SearchParams, scoreText } from "./score";
import { ALL_TEXT_PROMISE } from "./preprocessing";
import { ChapterName, URL, ChapterSearchData } from "./types";

/** Upper bound on allowable query length (separating commas included) */
const MAX_LENGTH = 200;

/**
 * Search all chapters currently stored in the file system.
 *
 * @param rawSearch raw search query input; comma-separated list of keywords
 * @returns a list of search results, or undefined if the search query exceeds
 *      the size limits on the number of words or query length.
 */
export async function search(
    query: string
): Promise<Array<ChapterSearchData> | undefined> {
    const searchWords = query.split(",");
    const filteredWords = searchWords
        .filter(
            (word) =>
                searchWords.length < SEARCH_LENGTH_TO_TRIGGER_FILLER ||
                !FILLER.has(word.toLowerCase())
        )
        .filter((word) => word.length > 0);
    if (query.length > MAX_LENGTH) {
        return undefined;
    }
    const numChapters = (await ALL_TEXT_PROMISE).length;
    const ret = parseChapters(0, numChapters, filteredWords);
    return ret;
}

/**
 * Search a batch of chapters.
 *
 * @param start index of chapter to begin search
 * @param numChapters number of chapters to search
 * @param searchWords list of search words
 * @returns a list of search results for the `numChapters` chapters starting at chapter `start`
 */
export async function parseChapters(
    start: number,
    numChapters: number,
    searchWords: string[]
): Promise<Array<ChapterSearchData>> {
    const allText = await ALL_TEXT_PROMISE;
    const data: Array<ChapterSearchData> = [];
    for (let i = 0; i < numChapters; i++) {
        const chapter = allText[start + i];
        if (chapter) {
            const [name, url, text] = chapter;
            const { score, excerpts } = scoreText(text, searchWords);
            data.push({ name, url, score, excerpts });
        }
    }
    return data;
}

const SEARCH_LENGTH_TO_TRIGGER_FILLER = 3;
const FILLER = new Set([
    "a",
    "an",
    "and",
    "at",
    "be",
    "by",
    "did",
    "do",
    "does",
    "for",
    "go",
    "goes",
    "if",
    "in",
    "is",
    "it",
    "the",
    "to",
    "that",
    "was",
    "what",
    "then",
    "than",
    "not",
    "ok",
    "from",
    "isn't",
    "has",
    "have",
    "get",
]);
