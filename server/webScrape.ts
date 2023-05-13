import assert from "assert";
import fs from "fs";
import path from "path";
import { DATA_PATH, ALL_TEXT_PROMISE, resetText } from "./preprocessing";

const TABLE_OF_CONTENTS = "https://wanderinginn.com/table-of-contents/";
const URL_BASE = "https://wanderinginn.com";
const ignore = ["/vol-1-archive", "/contacts/"];

/**
 * Fetches and writes all chapters to files of the form data/i.txt
 *
 * @param rateLimit maximum number of chapters to handle at a time
 * @param pauseTime seconds to pause between batches of requests
 */
export async function writeAll(
    rateLimit = 10000,
    pauseTime = 0
): Promise<void> {
    const urls = await chapterToURL();
    const chapterNames: string[] = [];
    const promises: Promise<string>[] = [];

    /** can't do this all concurrently; run into 429 too many requests */
    for (const [i, [chapterName, url]] of urls.entries()) {
        console.log("starting chapter", i);
        chapterNames.push(chapterName);
        promises.push(fetchChapter(url));
        if ((i + 1) % rateLimit === 0 || i + 1 === urls.length) {
            await writeToFile(
                rateLimit * Math.floor(i / rateLimit),
                promises,
                chapterNames
            );
            console.log("finished batch, waiting now...");
            await wait(pauseTime * 1000);
            chapterNames.length = 0;
            promises.length = 0;
        }
    }
    resetText();
}

/**
 * Updates file storage by (i) fetching and writing existing chapters (files)
 * that are missing text, and (ii) fetching and writing new chapters.
 * After doing so, resets the in-memory text storage
 */
export async function writeUpdate(): Promise<void> {
    const promise = chapterToURL();
    const currText = await ALL_TEXT_PROMISE;
    const urls = new Map(await promise);
    for (const [i, [chapterName, text]] of currText.entries()) {
        // patch missing chapters
        if (text.length === 0) {
            console.log("patching missing chapter:", chapterName);
            const url = urls.get(chapterName);
            if (url === undefined) console.log("unknown url");
            else await writeToFile(i, [fetchChapter(url)], [chapterName]);
        }
    }
    // write new chapter
    const chapterNames = new Set(
        currText.map(([chapterName, text]) => chapterName)
    );
    let i = 0;
    for (const [newChapterName, url] of urls.entries()) {
        if (!chapterNames.has(newChapterName)) {
            console.log("writing new chapter:", newChapterName);
            await writeToFile(
                currText.length + i,
                [fetchChapter(url)],
                [newChapterName]
            );
            i++;
        }
    }
    resetText();
}

/**
 * Writes a batch of chapter texts to files `${startIndex}.txt`, `${startIndex+1}.txt`, ...
 *
 * @param startIndex index of the file to start writing
 * @param chapterTexts array of (promises) to chapter texts to be written in that order
 * @param chapterNames array of chapter names, order aligned with `chapterTexts`
 * @returns
 */
async function writeToFile(
    startIndex: number,
    chapterTexts: Promise<string>[],
    chapterNames: string[]
): Promise<void[]> {
    console.log("writing batch to file starting at", startIndex);
    return (
        Promise.all(chapterTexts)
            // format chapter text by appending chapter name to the top
            .then((res) => {
                return res.map((text, i) => {
                    const name = chapterNames[i];
                    assert(name);
                    return name + "\n" + text;
                });
            })
            .then((res) =>
                Promise.all(
                    res.map((chapter, i) =>
                        fs.writeFile(
                            path.resolve(DATA_PATH, `${startIndex + i}.txt`),
                            chapter,
                            (err) => {
                                if (err !== null) console.log(err);
                            }
                        )
                    )
                )
            )
    );
}

/**
 * @returns a promise to a list of pairs of the form [chapterName, URL]
 */
async function chapterToURL(): Promise<Array<[string, string]>> {
    const regex = /<a[\s]+href="(\/[-\w\/]+)">([\w\-\u2013\(\). ]+)<\/a>/g;
    const res = await fetch(TABLE_OF_CONTENTS);
    const rawHTML = await res.text();
    const matches = [...rawHTML.matchAll(regex)];
    const ret: Array<[string, string]> = [];
    matches.forEach((match) => {
        assert(match[1] && match[2]);
        if (ignore.includes(match[1])) return;
        ret.push([match[2], match[1]]);
    });
    return ret;
}

/**
 *
 * @param url a relative url to a chapter
 * @returns a promise for the text of the corresponding chapter as a single string,
 *      paragraphs separated by double newlines
 */
async function fetchChapter(url: string): Promise<string> {
    console.log("looking at url:", url);
    const regex = new RegExp(
        /<div[\s]+class[\s]*=[\s]*"entry-content">(.*?)<\/div>/,
        "s"
    );
    try {
        const res = await fetch(URL_BASE + url);
        const rawHTML = await res.text();
        const match = rawHTML.match(regex);
        if (!match || !match[1]) {
            throw new Error(`failed to get content div`);
        }
        return extractText(match[1]);
    } catch (err) {
        console.log("errored on:", url, err);
        return "";
    }
}

/**
 * @param rawHTML raw HTML between the <div class="entry-content"> of a chapter's source HTML
 * @returns the text of the chapter as a single string with paragraps separated by double newlines
 */
function extractText(rawHTML: string): string {
    const regex = new RegExp(/<p>(.*?)<\/p>/, "sg");
    const m = [...rawHTML.matchAll(regex)];
    return m
        .map((match) => {
            assert(match[1]);
            return match[1];
        })
        .join("\n\n");
}

function wait(msec: number): Promise<void> {
    return new Promise((resolve, _) => setTimeout(resolve, msec));
}
