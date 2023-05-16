import { SearchParams, scoreText } from "./score";
import { ALL_TEXT_PROMISE } from "./preprocessing";
import { ChapterName, URL, ChapterSearchData } from "./types";

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
): Promise<Array<ChapterSearchData>> {
    const numChapters = (await ALL_TEXT_PROMISE).length;
    const ret = parseChapters(0, numChapters, searchWords, searchParams);
    console.log("search concluded");
    return ret;
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
): Promise<Array<ChapterSearchData>> {
    const allText = await ALL_TEXT_PROMISE;
    const data: Array<ChapterSearchData> = [];
    for (let i = 0; i < numChapters; i++) {
        const chapter = allText[start + i];
        if (chapter) {
            const [name, url, text] = chapter;
            const { score, excerpts } = scoreText(
                text,
                searchWords,
                searchParams
            );
            data.push({ name, url, score, excerpts });
        }
    }
    return data;
}
