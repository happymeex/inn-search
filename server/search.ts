import { SearchParams, scoreText } from "./score";
import { ALL_TEXT_PROMISE } from "./preprocessing";

/**
 * Search all chapters currently stored in the file system.
 *
 * @param rawSearch list of search words
 * @param searchParams search parameters
 * @returns a list of pairs [chapterName, chapterData] where the data consists
 *      of a score and a list of excerpts
 */
export async function search(
    searchWords: string[],
    searchParams: SearchParams
): Promise<Array<[string, { score: number; excerpts: string[] }]>> {
    const numChapters = (await ALL_TEXT_PROMISE).length;
    return parseChapters(0, numChapters, searchWords, searchParams);
}

/**
 * Search a batch of chapters.
 *
 * @param start index of chapter to begin search
 * @param numChapters number of chapters to search
 * @param searchWords list of search words
 * @param searchParams search parameters
 * @returns a list of pairs [chapterName, chapterData] where the data consists
 *      of a score and a list of excerpts
 */
export async function parseChapters(
    start: number,
    numChapters: number,
    searchWords: string[],
    searchParams: SearchParams
): Promise<Array<[string, { score: number; excerpts: string[] }]>> {
    const allText = await ALL_TEXT_PROMISE;
    const data: Array<[string, { score: number; excerpts: string[] }]> = [];
    for (let i = 0; i < numChapters; i++) {
        const chapter = allText[start + i];
        if (chapter) {
            const [chapterName, text] = chapter;
            data.push([
                chapterName,
                scoreText(text, searchWords, searchParams),
            ]);
        }
    }
    return data;
}

/**
 * Parses the raw search string.
 *
 * @param rawSearch input search text
 * @returns array of nonempty search strings
 */
function parseSearchInput(rawSearch: string): string[] {
    return rawSearch.split(" ").filter((word) => word.length > 0);
}
