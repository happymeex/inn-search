import { scoreText } from "./score";
import { Inventory } from "./preprocessing";
import { ChapterName, URL, ChapterSearchData } from "./types";

/** Upper bound on allowable query length (separating commas included) */
const MAX_LENGTH = 200;
const SEARCH_BATCH_SIZE = 150;

export const chapterData = new Inventory();

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

    const ret: ChapterSearchData[][] = [];
    const numChapters = chapterData.numChapters;
    const numBatches = Math.ceil(numChapters / SEARCH_BATCH_SIZE);
    for (let i = 0; i < numBatches; i++) {
        const batchResults = await searchChapters(
            SEARCH_BATCH_SIZE * i,
            SEARCH_BATCH_SIZE,
            filteredWords
        );
        ret.push(batchResults);
    }
    return ret.flat();
}

/**
 * Searches a batch of chapters starting at chapter `start` until either `numChapters`
 * chapters have been searched or until the last chapter has been searched
 *
 * @param start index of chapter to begin search
 * @param numChapters upper bound on number of chapters to search
 * @param searchWords list of search words
 * @returns a list of search results for the `numChapters` chapters starting at chapter `start`,
 *      ignoring chapter indices beyond the last one.
 */
async function searchChapters(
    start: number,
    numChapters: number,
    searchWords: string[]
): Promise<Array<ChapterSearchData>> {
    const chapters = await chapterData.loadChapters(start, numChapters);
    const data: Array<ChapterSearchData> = [];
    for (const chapter of chapters) {
        const [name, url, text] = chapter;
        const { score, excerpts } = scoreText(text, searchWords);
        data.push({ name, url, score, excerpts });
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
