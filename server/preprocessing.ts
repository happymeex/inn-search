import fs from "fs";
import path from "path";
import { URL, ChapterName, Text } from "./types";
import assert from "assert";

const RATE_LIMIT = 20;
const PAUSE_TIME = 5;
const TABLE_OF_CONTENTS = "https://wanderinginn.com/table-of-contents/";
const URL_BASE = "https://wanderinginn.com";
export const PARAGRAPH_DELIMITER = "\n\n";
const IGNORE_URLS = ["/vol-1-archive", "/contacts/"];

export const DATA_PATH = path.resolve(__dirname, "..", "..", "data");

async function loadFiles(
    forceReload = false
): Promise<Array<[ChapterName, URL, Text]>> {
    console.log("loading files...");
    const promises: Promise<Buffer>[] = [];
    let numChapters = fs.readdirSync(DATA_PATH).length - 1; // exclude .gitkeep
    console.log("found", numChapters, "chapters");
    if (numChapters === 0 || forceReload) {
        console.log("fetching and writing all chapters to filesys");
        await writeAll(RATE_LIMIT, PAUSE_TIME);
    }
    numChapters = fs.readdirSync(DATA_PATH).length - 1;
    for (let i = 0; i < numChapters; i++) {
        promises.push(
            fs.promises.readFile(path.resolve(DATA_PATH, `${i}.txt`))
        );
    }
    return Promise.all(promises).then((res) =>
        res.map((buffer) => buffer.toString()).map(splitFirstLines)
    );
}

/**
 * Splits a string into three at its first two newline characters
 *
 * @param str string to split
 */
function splitFirstLines(str: string): [ChapterName, URL, Text] {
    const firstLineBreak = str.indexOf("\n");
    const rest = str.slice(firstLineBreak + 1);
    const secondLineBreak = rest.indexOf("\n");
    return [
        str.slice(0, firstLineBreak),
        rest.slice(0, secondLineBreak),
        rest.slice(secondLineBreak + 1),
    ];
}

/**
 * Promise to an array whose elements take the form [chapterName, url, text],
 * in the correct chapter order.
 */
export let ALL_TEXT_PROMISE: Promise<Array<[ChapterName, URL, Text]>> =
    loadFiles();

/**
 * Rereads the text from files.
 */
export function resetText(forceReload = false): void {
    ALL_TEXT_PROMISE = loadFiles(forceReload);
}

/**
 * Fetches and writes all chapters to files of the form `DATA_PATH/i.txt`.
 * Executes in batches, since fetching all chapters concurrently runs into 429 error
 * too many requests.
 *
 * @param rateLimit maximum number of chapters to handle at a time, default 1000
 * @param pauseTime minutes to pause between batches of requests, default 0
 */
export async function writeAll(
    rateLimit = 1000,
    pauseTime = 0,
    start = 0
): Promise<void> {
    const urls = await chapterToURL();
    const chapterNames: ChapterName[] = [];
    const chapterURLs: URL[] = [];
    const promises: Promise<Text>[] = [];

    for (const [i, [chapterName, url]] of urls.entries()) {
        if (i < start) continue;
        console.log(`starting chapter ${i}: ${chapterName}`);
        chapterNames.push(chapterName);
        chapterURLs.push(url);
        promises.push(fetchChapter(url));
        if ((i + 1) % rateLimit === 0 || i + 1 === urls.length) {
            await writeToFile(
                rateLimit * Math.floor(i / rateLimit),
                promises,
                chapterURLs,
                chapterNames
            );
            console.log("finished batch, waiting now...");
            await wait(pauseTime * 60 * 1000);
            chapterNames.length = 0;
            chapterURLs.length = 0;
            promises.length = 0;
        }
    }
    console.log("finished fetching and writing all chapters");
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
    for (const [i, [chapterName, url, text]] of currText.entries()) {
        // patch missing chapters
        if (text.length === 0) {
            console.log("patching missing chapter:", chapterName);
            const url = urls.get(chapterName);
            if (url === undefined) console.log("unknown url");
            else
                await writeToFile(i, [fetchChapter(url)], [url], [chapterName]);
        }
    }
    // write new chapter
    const chapterNames = new Set(
        currText.map(([chapterName, url, text]) => chapterName)
    );
    let i = 0;
    for (const [newChapterName, url] of urls.entries()) {
        if (!chapterNames.has(newChapterName)) {
            console.log("writing new chapter:", newChapterName);
            await writeToFile(
                currText.length + i,
                [fetchChapter(url)],
                [url],
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
    chapterTexts: Promise<Text>[],
    chapterURLs: URL[],
    chapterNames: ChapterName[]
): Promise<void[]> {
    console.log("writing batch to file starting at chapter", startIndex);
    return (
        Promise.all(chapterTexts)
            // format chapter text by appending chapter name to the top
            .then((res) => {
                return res.map((text, i) => {
                    const name = chapterNames[i];
                    const url = chapterURLs[i];
                    assert(name && url);
                    return name + "\n" + url + "\n" + text;
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
async function chapterToURL(): Promise<Array<[ChapterName, URL]>> {
    const regex = /<a[\s]+href="(\/[-\w\/]+)">([\w\-\u2013\(\). ]+)<\/a>/g;
    const res = await fetch(TABLE_OF_CONTENTS);
    const rawHTML = await res.text();
    const matches = [...rawHTML.matchAll(regex)];
    const ret: Array<[string, string]> = [];
    matches.forEach((match) => {
        assert(match[1] && match[2]);
        if (IGNORE_URLS.includes(match[1])) return;
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
async function fetchChapter(url: URL): Promise<Text> {
    const regex = new RegExp(
        /<div[\s]+class[\s]*=[\s]*"entry-content">(.*?)<\/div>/,
        "s"
    );
    try {
        const res = await fetch(URL_BASE + url);
        const rawHTML = await res.text();
        const match = rawHTML.match(regex);
        if (!match || !match[1]) {
            throw new Error(
                `failed to get content div\nraw html: ${rawHTML.slice(0, 300)}`
            );
        }
        return extractText(match[1]);
    } catch (err) {
        console.log("errored on:", url, String(err));
        return "";
    }
}

/**
 * @param rawHTML raw HTML between the <div class="entry-content"> of a chapter's source HTML
 * @returns the text of the chapter as a single string with paragraps separated by double newlines
 */
function extractText(rawHTML: string): Text {
    const regex = new RegExp(/<p>(.*?)<\/p>/, "sg");
    const m = [...rawHTML.matchAll(regex)];
    const rawText = m
        .map((match) => {
            assert(match[1]);
            return match[1];
        })
        .join(PARAGRAPH_DELIMITER);
    return sanitizeText(rawText);
}

function sanitizeText(text: string): string {
    // match "Previous Chapter" and "Next Chapter" buttons
    const regex = /<a href=.*?>.*?Chapter.*?<\/a>/g;
    return text
        .replaceAll(regex, "")
        .replaceAll(`\u2018`, "'")
        .replaceAll(`\u2019`, "'")
        .replaceAll(`\u201c`, `"`)
        .replaceAll(`\u201d`, `"`)
        .replaceAll(`\u2026`, "...");
}

function wait(msec: number): Promise<void> {
    return new Promise((resolve, _) => setTimeout(resolve, msec));
}
